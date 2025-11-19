# Deployment Guide

## Quick Deploy to Vercel

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Add environment variable: `OPENAI_API_KEY`
   - Deploy!

## Manual Deployment

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Start production server:**
   ```bash
   npm start
   ```

## Environment Variables

Create `.env.local` with:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

## Features Ready for Production

✅ **PDF Upload & Parsing** - Extract text from CV PDFs  
✅ **Persona Selection** - Finance, Hiring Manager, Tech Lead  
✅ **Custom Prompts** - Edit evaluation prompts per persona  
✅ **Structured Evaluation** - Strengths, weaknesses, risk, verdict  
✅ **Multi-Expert Debate** - All personas debate the candidate  
✅ **Production Build** - Optimized for Vercel deployment  
✅ **TypeScript** - Full type safety  
✅ **Tailwind CSS** - Professional styling  
✅ **No Auth Required** - Public demo ready  

## API Endpoints

- `POST /api/review` - Single persona evaluation
- `POST /api/debate` - Multi-expert debate

## Usage

1. Upload a CV PDF
2. Select evaluation persona
3. Customize the prompt (optional)
4. Click "Evaluate Candidate"
5. Click "Have Experts Debate This Candidate" for multi-perspective analysis

Ready for instant deployment! 🚀

