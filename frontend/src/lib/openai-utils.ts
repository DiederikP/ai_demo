import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Safely calls OpenAI API with automatic token management and error handling
 * @param messages - Array of message objects for the conversation
 * @param options - Optional configuration for the API call
 * @returns Promise with the completion result or error
 */
export async function callOpenAISafe(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    maxRetries?: number;
    retryDelay?: number;
  } = {}
): Promise<{
  success: boolean;
  result?: OpenAI.Chat.Completions.ChatCompletion;
  error?: string;
  tokensUsed?: number;
}> {
  const {
    model = 'gpt-4',
    maxTokens = 1000,
    temperature = 0.1,
    maxRetries = 3,
    retryDelay = 1000,
  } = options;

  // Estimate token count (rough approximation: 1 token ≈ 4 characters)
  const estimatedTokens = messages.reduce((total, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return total + Math.ceil(content.length / 4);
  }, 0);

  // If estimated tokens exceed limit, truncate the last user message
  if (estimatedTokens > 6000) { // Leave buffer for system prompt and response
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && typeof lastMessage.content === 'string') {
      const maxContentLength = 2000; // Conservative limit
      if (lastMessage.content.length > maxContentLength) {
        messages[messages.length - 1] = {
          ...lastMessage,
          content: lastMessage.content.substring(0, maxContentLength) + '\n\n[Content truncated for token limits...]'
        };
      }
    }
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      });

      return {
        success: true,
        result: completion,
        tokensUsed: completion.usage?.total_tokens || 0,
      };
    } catch (error: any) {
      console.error(`OpenAI API attempt ${attempt} failed:`, error.message);

      // Handle specific error types
      if (error.code === 'context_length_exceeded') {
        // Further reduce content if context length exceeded
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && typeof lastMessage.content === 'string') {
          messages[messages.length - 1] = {
            ...lastMessage,
            content: lastMessage.content.substring(0, 1000) + '\n\n[Content further truncated due to context limits...]'
          };
        }
      } else if (error.code === 'rate_limit_exceeded') {
        // Wait longer for rate limit errors
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt * 2));
          continue;
        }
      } else if (error.code === 'invalid_request_error') {
        // Don't retry invalid requests
        break;
      }

      if (attempt === maxRetries) {
        return {
          success: false,
          error: `OpenAI API failed after ${maxRetries} attempts: ${error.message}`,
        };
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  return {
    success: false,
    error: 'Unexpected error in OpenAI API call',
  };
}

/**
 * Extracts text from uploaded file with multiple fallback strategies
 * @param file - The uploaded file
 * @returns Promise with extracted text or error
 */
export async function extractTextFromFile(file: File): Promise<{
  success: boolean;
  text?: string;
  error?: string;
}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // First, try to read as plain text (works for TXT files and some others)
    try {
      const text = buffer.toString('utf-8');
      if (text.trim() && text.length > 10) {
        return { success: true, text };
      }
    } catch (textError) {
      console.log('Plain text extraction failed, trying AI extraction...');
    }
    
    // If plain text fails, use AI to extract from base64
    try {
      const base64File = buffer.toString('base64');
      
      const extractionPrompt = `You are an expert at extracting text from various file formats. 
      
      I'm sending you a file encoded in base64. Please extract ALL readable text content and return it as plain text.
      
      File details:
      - Name: ${file.name}
      - Type: ${file.type}
      - Size: ${file.size} bytes
      
      IMPORTANT: Return ONLY the extracted text content, no explanations, no formatting, no JSON structure. Just the raw text that a human would see when reading this document.
      
      If this is a CV/resume, extract all candidate information including name, contact details, experience, skills, education, etc.`;
      
      const result = await callOpenAISafe([
        { role: 'system', content: extractionPrompt },
        { role: 'user', content: `Please extract text from this base64 encoded file:\n\n${base64File}` }
      ], {
        maxTokens: 2000,
        temperature: 0.1
      });
      
      if (result.success && result.result?.choices[0]?.message?.content) {
        return { success: true, text: result.result.choices[0].message.content };
      }
    } catch (aiError) {
      console.error('AI text extraction failed:', aiError);
    }
    
    return { success: false, error: 'Could not extract text from file' };
  } catch (error: any) {
    return { success: false, error: `File processing error: ${error.message}` };
  }
}

/**
 * Safely truncates text to stay within token limits
 * @param text - The text to truncate
 * @param maxLength - Maximum character length (default: 3000)
 * @returns Truncated text with indicator
 */
export function truncateTextSafely(text: string, maxLength: number = 3000): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength) + '\n\n[Content truncated for processing...]';
}
