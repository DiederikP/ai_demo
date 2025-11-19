# Barnes AI Candidate Evaluation Platform

A professional AI-powered candidate evaluation platform built for Barnes.nl, featuring multi-expert persona evaluations and intelligent debate functionality.

## 🚀 Features

- **Multi-Format File Support**: PDF, DOC, DOCX, TXT file uploads
- **AI-Powered Text Extraction**: Intelligent extraction from any file format
- **Three Expert Personas**: Finance Director, Hiring Manager, Tech Lead
- **Professional Evaluations**: Structured analysis with strengths, weaknesses, risk, and verdict
- **Expert Debates**: Multi-perspective AI discussions
- **Token-Safe Processing**: Never exceeds OpenAI's 8192 token limit
- **Barnes Branding**: Complete professional styling and branding

## 🏗️ Architecture

### Frontend (Next.js 15.5.6)
- **Framework**: Next.js with App Router
- **Styling**: Tailwind CSS with custom Barnes color scheme
- **Language**: TypeScript
- **State Management**: React hooks (in-memory)

### Backend (API Routes)
- **AI Integration**: OpenAI GPT-4 with safe token management
- **File Processing**: Multi-strategy text extraction
- **Error Handling**: Comprehensive error management with retries

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── review/route.ts      # Single persona evaluation
│   │   │   └── debate/route.ts      # Multi-expert debate
│   │   ├── globals.css              # Barnes styling and Tailwind
│   │   ├── layout.tsx               # Root layout with Barnes branding
│   │   └── page.tsx                 # Main evaluation interface
│   └── lib/
│       └── openai-utils.ts          # Safe OpenAI utilities
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── .env.local                       # OpenAI API key
```

## 🔧 Core Functions

### OpenAI Utilities (`src/lib/openai-utils.ts`)

#### `callOpenAISafe(messages, options)`
**Purpose**: Safely calls OpenAI API with automatic token management and error handling.

**Parameters**:
- `messages`: Array of message objects for the conversation
- `options`: Configuration object with:
  - `model`: OpenAI model (default: 'gpt-4')
  - `maxTokens`: Maximum tokens for response (default: 1000)
  - `temperature`: Response creativity (default: 0.1)
  - `maxRetries`: Number of retry attempts (default: 3)
  - `retryDelay`: Delay between retries in ms (default: 1000)

**Returns**: Promise with:
- `success`: Boolean indicating success
- `result`: OpenAI completion object (if successful)
- `error`: Error message (if failed)
- `tokensUsed`: Number of tokens consumed

**Features**:
- Automatic token estimation and truncation
- Retry logic for rate limits and temporary failures
- Context length management
- Professional error handling

#### `extractTextFromFile(file)`
**Purpose**: Extracts text from uploaded files using multiple strategies.

**Parameters**:
- `file`: File object from form upload

**Returns**: Promise with:
- `success`: Boolean indicating success
- `text`: Extracted text content (if successful)
- `error`: Error message (if failed)

**Strategies**:
1. Plain text extraction (for TXT files)
2. AI-powered extraction (for PDF, DOC, DOCX)
3. Fallback error handling

#### `truncateTextSafely(text, maxLength)`
**Purpose**: Safely truncates text to stay within token limits.

**Parameters**:
- `text`: Text to truncate
- `maxLength`: Maximum character length (default: 3000)

**Returns**: Truncated text with truncation indicator

### API Routes

#### `/api/review` (POST)
**Purpose**: Single persona evaluation of a candidate.

**Request Body** (FormData):
- `file`: CV file (PDF, DOC, DOCX, TXT)
- `persona`: 'finance', 'hiringManager', or 'techLead'
- `prompt`: Custom evaluation prompt

**Response**:
```json
{
  "strengths": "Detailed analysis of candidate's strengths",
  "weaknesses": "Areas of concern or improvement needed",
  "risk": "Risk assessment and potential issues",
  "verdict": "Final hiring recommendation with reasoning"
}
```

**Process Flow**:
1. Extract text from uploaded file
2. Truncate text to safe length (3000 chars)
3. Create persona-specific evaluation prompt
4. Call OpenAI safely with token management
5. Parse and return structured evaluation

#### `/api/debate` (POST)
**Purpose**: Multi-expert debate between all three personas.

**Request Body** (FormData):
- `file`: CV file (PDF, DOC, DOCX, TXT)
- `financePrompt`: Finance Director evaluation prompt
- `hiringManagerPrompt`: Hiring Manager evaluation prompt
- `techLeadPrompt`: Technical Lead evaluation prompt

**Response**:
```json
{
  "transcript": "Multi-persona debate transcript"
}
```

**Process Flow**:
1. Extract text from uploaded file
2. Truncate text to safe length (3000 chars)
3. Create multi-persona debate prompt
4. Call OpenAI safely with token management
5. Return debate transcript

### Frontend Components

#### Main Page (`src/app/page.tsx`)
**Purpose**: Main evaluation interface with file upload and persona selection.

**State Management**:
- `selectedFile`: Currently selected file
- `selectedPersona`: Active evaluation persona
- `personaPrompts`: Custom prompts for each persona
- `evaluationResult`: Single evaluation results
- `debateResult`: Multi-expert debate results
- `isEvaluating`: Loading state for evaluation
- `isDebating`: Loading state for debate

**Key Functions**:
- `handleFileChange()`: File selection handler
- `handlePersonaChange()`: Persona selection handler
- `handlePromptChange()`: Custom prompt editor
- `handleEvaluate()`: Single evaluation trigger
- `handleDebate()`: Multi-expert debate trigger

**UI Features**:
- Drag-and-drop file upload
- Persona selection with visual indicators
- Custom prompt editing
- Real-time evaluation display
- Professional Barnes branding

### Styling (`src/app/globals.css`)

#### Barnes Color Scheme
```css
:root {
  --barnes-orange: #fe5300;
  --barnes-orange-red: #f53c57;
  --barnes-violet: #ba28dd;
  --barnes-dark-violet: #1a0d47;
  --barnes-light-gray: #f8f9fa;
  --barnes-dark-gray: #2c3e50;
}
```

#### Custom Classes
- `.barnes-button`: Primary action buttons with hover effects
- `.barnes-card`: Content containers with Barnes styling
- `.barnes-input`: Form inputs with Barnes color scheme

#### Typography
- **Headings**: Libre Baskerville (serif)
- **Body Text**: Lato (sans-serif)
- **Brand Colors**: Barnes orange and violet palette

## 🛡️ Safety Features

### Token Management
- **Automatic Estimation**: Rough token counting (1 token ≈ 4 characters)
- **Smart Truncation**: Content truncation before API calls
- **Buffer Management**: Leaves room for system prompts and responses
- **Context Limits**: Never exceeds 8192 token limit

### Error Handling
- **Retry Logic**: Automatic retries for temporary failures
- **Rate Limit Handling**: Exponential backoff for rate limits
- **Graceful Degradation**: Fallback responses for API failures
- **User Feedback**: Clear error messages for users

### File Processing
- **Multiple Strategies**: Plain text and AI extraction
- **Format Support**: PDF, DOC, DOCX, TXT files
- **Size Limits**: Automatic truncation for large files
- **Validation**: File type and content validation

## 🚀 Deployment

### Prerequisites
- Node.js 18+
- OpenAI API key
- Vercel account (for deployment)

### Environment Setup
```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Add your OpenAI API key to .env.local

# Start development server
npm run dev
```

### Production Deployment
```bash
# Build for production
npm run build

# Deploy to Vercel
npm run deploy
```

## 🔧 Configuration

### Tailwind Config (`tailwind.config.js`)
- Barnes color palette
- Custom font families
- Responsive breakpoints
- Component styling

### PostCSS Config (`postcss.config.js`)
- Tailwind CSS processing
- Autoprefixer for browser compatibility

### Package Dependencies
- **Next.js 15.5.6**: React framework
- **OpenAI 4.0.0**: AI integration
- **Tailwind CSS 3.4.1**: Styling
- **TypeScript 5**: Type safety

## 📊 Performance

### Optimization Features
- **Code Splitting**: Automatic Next.js optimization
- **Image Optimization**: Built-in Next.js image handling
- **Bundle Analysis**: Optimized JavaScript bundles
- **Caching**: API response caching

### Monitoring
- **Error Logging**: Comprehensive error tracking
- **Token Usage**: OpenAI token consumption monitoring
- **Performance Metrics**: Response time tracking

## 🧪 Testing

### API Testing
```bash
# Test single evaluation
curl -X POST http://localhost:3000/api/review \
  -F "file=@cv.pdf" \
  -F "persona=finance" \
  -F "prompt=Evaluate this candidate"

# Test multi-expert debate
curl -X POST http://localhost:3000/api/debate \
  -F "file=@cv.pdf" \
  -F "financePrompt=Finance evaluation" \
  -F "hiringManagerPrompt=HR evaluation" \
  -F "techLeadPrompt=Technical evaluation"
```

## 🔍 Troubleshooting

### Common Issues

#### Token Limit Exceeded
- **Cause**: Content too long for OpenAI context
- **Solution**: Automatic truncation in `callOpenAISafe()`
- **Prevention**: Conservative 3000 character limit

#### File Upload Errors
- **Cause**: Unsupported file format or corruption
- **Solution**: Multiple extraction strategies
- **Fallback**: Plain text reading

#### API Rate Limits
- **Cause**: Too many requests to OpenAI
- **Solution**: Automatic retry with exponential backoff
- **Prevention**: Request throttling

### Debug Mode
Enable detailed logging by setting `NODE_ENV=development` in your environment.

## 📝 License

This project is proprietary software developed for Barnes.nl. All rights reserved.

## 🤝 Support

For technical support or feature requests, contact the development team at Barnes.nl.

---

**Version**: 1.0.0  
**Last Updated**: October 2025  
**Maintainer**: Barnes.nl Development Team