# AI Customer Support Bot - Deployment Guide

## 🚀 Quick Deployment to Render.com

### Step 1: Prepare Repository
1. Push code to GitHub repository
2. Ensure all files are committed, especially:
   - `render.yaml` (deployment configuration)
   - `.env.production` (environment template)
   - `package.json` (with all dependencies)

### Step 2: Deploy to Render.com
1. **Create Render Account**: Visit [render.com](https://render.com) and sign up
2. **Connect GitHub**: Link your GitHub account
3. **Create Web Service**: 
   - Select your repository
   - Choose "Web Service"
   - Use the included `render.yaml` configuration

### Step 3: Configure Environment Variables
Set these in Render Dashboard:
```
NODE_ENV=production
PORT=10000
DATABASE_URL=./database.sqlite
BOT_NAME=CustomerSupportBot
CONFIDENCE_THRESHOLD=0.7
MAX_CONTEXT_MESSAGES=10
ESCALATION_KEYWORDS=human,agent,manager,escalate,speak to someone

# Optional: Add your LLM API keys for enhanced functionality
HF_API_KEY=your_hugging_face_api_key
HF_MODEL=microsoft/DialoGPT-medium
```

### Step 4: Deploy
- Render will automatically build and deploy
- Monitor the deploy logs for any issues
- Visit your deployed URL

## 🏠 Local Development Setup

### Prerequisites
- Node.js 16+ and npm
- Git

### Setup Commands
```bash
# Clone repository
git clone <your-repo-url>
cd ai-customer-support-bot

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev

# Or start production server
npm start
```

### Verification Steps
1. Visit `http://localhost:3000` - Chat interface should load
2. Visit `http://localhost:3000/health` - Should return healthy status
3. Visit `http://localhost:3000/api` - Should show API documentation
4. Test chat functionality with sample questions

## 🧪 Testing Guide

### Manual Testing Checklist

#### Basic Functionality
- [ ] Chat interface loads without errors
- [ ] Welcome message displays correctly
- [ ] Quick action buttons work
- [ ] Message input accepts text and sends on Enter
- [ ] Bot responds to messages

#### FAQ System
- [ ] Ask "What are your business hours?" → Should get FAQ response
- [ ] Ask "How do I reset my password?" → Should get FAQ response
- [ ] FAQ modal opens and shows searchable FAQs
- [ ] Category filtering works in FAQ modal
- [ ] "Ask this question" button works in FAQ modal

#### Escalation System
- [ ] Say "I want to speak to a human" → Should escalate immediately
- [ ] Say "This is frustrating" → Should detect sentiment and escalate
- [ ] Ask about billing → Should escalate for sensitive topics
- [ ] Have a long conversation (10+ messages) → Should auto-escalate

#### Session Management
- [ ] Each page load creates new session
- [ ] Session ID displays in bottom right
- [ ] Clear chat button works
- [ ] Conversation history persists during session

#### API Endpoints
Test with curl or Postman:
```bash
# Health check
curl http://localhost:3000/health

# Create session
curl -X POST http://localhost:3000/api/chat/session \
  -H "Content-Type: application/json" \
  -d '{}'

# Send message
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"session_id":"your-session-id","message":"Hello"}'

# Get FAQs
curl http://localhost:3000/api/faq

# Search FAQs
curl "http://localhost:3000/api/faq/search?q=password"

# Get escalation stats
curl http://localhost:3000/api/escalation/stats/overview
```

### Automated Testing (Optional)
```bash
# Install test dependencies (if implemented)
npm install --save-dev jest supertest

# Run tests (if implemented)
npm test
```

## 🔧 Configuration Guide

### Environment Variables Explained

**Server Configuration**
- `PORT`: Server port (default: 3000, Render uses 10000)
- `NODE_ENV`: Environment (development/production)
- `DATABASE_URL`: SQLite database path

**LLM Integration**
- `HF_API_KEY`: Hugging Face API key (free tier available)
- `HF_MODEL`: Hugging Face model name
- `OPENAI_API_KEY`: OpenAI or compatible API key
- `OPENAI_BASE_URL`: API base URL

**Bot Behavior**
- `BOT_NAME`: Bot display name
- `CONFIDENCE_THRESHOLD`: Minimum confidence for responses (0.0-1.0)
- `MAX_CONTEXT_MESSAGES`: Messages to remember for context
- `ESCALATION_KEYWORDS`: Comma-separated escalation trigger words

### Free LLM API Options

**Hugging Face (Recommended)**
- Sign up at [huggingface.co](https://huggingface.co)
- Get free API key from Settings > Access Tokens
- 30,000 characters/month free tier

**Alternative Free APIs**
- **Together AI**: [api.together.xyz](https://api.together.xyz) - $25 free credits
- **Groq**: [console.groq.com](https://console.groq.com) - Fast inference
- **Replicate**: [replicate.com](https://replicate.com) - Pay per use

## 📊 Monitoring and Maintenance

### Health Monitoring
- `/health` endpoint for uptime monitoring
- Built-in error logging to console
- Graceful error handling with fallbacks

### Database Maintenance
The SQLite database automatically:
- Creates tables on first run
- Seeds initial FAQ data
- Handles schema migrations

### Log Monitoring
Key log patterns to monitor:
```
✅ Database initialized successfully
🚀 AI Customer Support Bot is running
🤖 Hugging Face LLM: Enabled
❌ Error processing message
⚠️  Escalation created
```

## 🔒 Security Considerations

### Production Checklist
- [ ] Environment variables properly set (no defaults in production)
- [ ] API keys stored securely in Render Dashboard
- [ ] CORS configured for your domain
- [ ] HTTPS enabled (Render provides this automatically)
- [ ] Rate limiting considered for API endpoints
- [ ] Input validation and sanitization in place

### Recommended Security Headers
Already included via Helmet.js:
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection

## 🚨 Troubleshooting

### Common Issues

**Application Won't Start**
- Check `package.json` syntax
- Verify Node.js version (16+)
- Check port availability
- Review environment variables

**Database Errors**
- Ensure write permissions for SQLite file
- Check `DATABASE_URL` path
- Verify disk space

**LLM API Errors**
- Validate API key format
- Check API rate limits
- Verify internet connectivity
- Review model name spelling

**Frontend Not Loading**
- Check static file serving
- Verify `public/` directory structure
- Check browser console for errors
- Ensure all CSS/JS files present

### Debug Commands
```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# List installed packages
npm list

# Check for vulnerabilities
npm audit

# Start with debug logging
DEBUG=* npm start
```

### Support Resources
- **Render.com Docs**: [render.com/docs](https://render.com/docs)
- **Node.js Troubleshooting**: [nodejs.org/docs](https://nodejs.org/docs)
- **Express.js Guide**: [expressjs.com](https://expressjs.com)

## 📈 Performance Optimization

### Production Optimizations
Already implemented:
- In-memory caching for conversation context
- Database connection pooling
- Static file compression
- Efficient database queries with proper indexing

### Scaling Considerations
For high-traffic deployments:
- Consider PostgreSQL over SQLite
- Implement Redis for session caching
- Add load balancing
- Monitor response times and error rates

## 🎯 Success Metrics

Monitor these KPIs after deployment:
- **Response Time**: < 500ms for API calls
- **Uptime**: 99.9% availability target
- **Error Rate**: < 1% of total requests
- **FAQ Hit Rate**: % of queries resolved by FAQ
- **Escalation Rate**: % of conversations escalated
- **User Satisfaction**: Based on conversation completion

---

**Deployment Time**: ~15 minutes
**Maintenance**: Minimal (primarily FAQ updates)
**Scaling**: Horizontal scaling ready
**Cost**: Free tier available on all platforms