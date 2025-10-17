# AI Customer Support Bot

## Live Link: https://ai-customer-support-bot.onrender.com/ 

A comprehensive AI-powered customer support chatbot built with Node.js, featuring conversation memory, FAQ matching, escalation handling, and LLM integration.

![AI Customer Support Bot](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)
![Hugging Face](https://img.shields.io/badge/%F0%9F%A4%97%20Hugging%20Face-FFD21E?style=for-the-badge)

## 🚀 Features

### Core Functionality
- **💬 Intelligent Chat Interface**: Clean, responsive web interface for customer interactions
- **🧠 Conversation Memory**: Maintains context across chat sessions with intelligent caching
- **❓ FAQ Matching**: Advanced keyword-based FAQ search and matching system
- **📈 Escalation Handling**: Automatic detection and routing of complex queries to human agents
- **🤖 LLM Integration**: Support for multiple LLM providers (Hugging Face, OpenAI-compatible APIs)

### Technical Features
- **📊 Session Management**: Persistent session tracking with metadata
- **🔍 Contextual Responses**: Uses conversation history for more relevant responses
- **📝 Message Classification**: Automatic categorization of messages and responses
- **📈 Analytics**: Built-in conversation analytics and escalation statistics
- **🛡️ Error Handling**: Robust error handling with graceful fallbacks

## 🏗️ Architecture

```
├── src/
│   ├── app.js                 # Main Express application
│   ├── llmService.js          # LLM integration (HuggingFace/OpenAI)
│   ├── faqService.js          # FAQ search and matching
│   ├── escalationService.js   # Escalation detection and handling
│   ├── conversationMemory.js  # Context management and memory
│   └── botService.js          # Main orchestration service
├── models/
│   ├── Session.js             # Session data model
│   └── Conversation.js        # Message and conversation model
├── routes/
│   ├── chat.js                # Chat API endpoints
│   ├── faq.js                 # FAQ management endpoints
│   └── escalation.js          # Escalation management endpoints
├── config/
│   └── database.js            # Database configuration and setup
└── public/
    ├── index.html             # Chat interface
    ├── style.css              # UI styling
    └── script.js              # Frontend JavaScript
```

## 🚦 Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn
- (Optional) Hugging Face API key or OpenAI-compatible API key

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd ai-customer-support-bot
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start the application**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

5. **Open your browser**
Navigate to `http://localhost:3000` to start chatting!

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=./database.sqlite

# Hugging Face API (Free tier)
HF_API_KEY=your_hugging_face_api_key_here
HF_MODEL=microsoft/DialoGPT-medium

# Alternative: OpenAI-compatible API
OPENAI_API_KEY=your_openai_compatible_key_here
OPENAI_BASE_URL=https://api.openai.com/v1

# Bot Configuration
BOT_NAME=CustomerSupportBot
CONFIDENCE_THRESHOLD=0.7
MAX_CONTEXT_MESSAGES=10
ESCALATION_KEYWORDS=human,agent,manager,escalate,speak to someone
```

### Getting API Keys

#### Hugging Face (Recommended - Free)
1. Sign up at [Hugging Face](https://huggingface.co/)
2. Go to [Settings > Access Tokens](https://huggingface.co/settings/tokens)
3. Create a new token with "Read" permissions
4. Copy the token to your `.env` file

#### OpenAI-Compatible APIs
- **OpenAI**: Get your API key from [OpenAI Platform](https://platform.openai.com/)
- **Together AI**: Free tier available at [Together AI](https://api.together.xyz/)
- **Groq**: Free tier available at [Groq](https://console.groq.com/)

## 📖 API Documentation

### Chat Endpoints

#### Start New Session
```http
POST /api/chat/session
Content-Type: application/json

{
  "user_id": "optional_user_id",
  "metadata": {}
}
```

#### Send Message
```http
POST /api/chat/message
Content-Type: application/json

{
  "session_id": "uuid",
  "message": "Hello, I need help with my password"
}
```

#### Get Conversation History
```http
GET /api/chat/session/{sessionId}/history?limit=50
```

### FAQ Endpoints

#### Search FAQs
```http
GET /api/faq/search?q=password%20reset&limit=5
```

#### Get Best FAQ Match
```http
POST /api/faq/match
Content-Type: application/json

{
  "query": "How do I reset my password?"
}
```

### Escalation Endpoints

#### Analyze Escalation Need
```http
POST /api/escalation/analyze
Content-Type: application/json

{
  "message": "I want to speak to a manager",
  "conversation_history": []
}
```

#### Get Escalation Statistics
```http
GET /api/escalation/stats/overview
```

## 🤖 LLM Prompts and Configuration

### System Prompts

The bot uses carefully crafted system prompts for different scenarios:

#### Default System Prompt
```
You are {BOT_NAME}, a helpful customer support assistant. You provide accurate, friendly, and professional responses to customer inquiries. If you cannot answer a question with confidence, suggest escalating to a human agent.
```

#### FAQ Response Enhancement
The bot enhances FAQ responses based on user communication style:
- **Formal users**: Professional, structured responses
- **Informal users**: Casual, friendly tone with emojis

#### Escalation Prompts
Different escalation messages based on escalation type:
- **Human Request**: "I understand you'd like to speak with a human agent..."
- **Technical Issue**: "I see you're experiencing a technical issue..."
- **Billing Issue**: "For billing and payment related matters..."
- **Frustration**: "I apologize that we haven't been able to resolve your concern..."

### Conversation Summarization
```
Summarize this customer support conversation in 2-3 sentences, highlighting the main issue and resolution status.
```

### Context Management
The bot maintains conversation context using:
- **Recent Messages**: Last 10 messages for immediate context
- **User Preferences**: Communication style, topic interests
- **Session Metadata**: Custom data per session
- **Relevance Scoring**: Identifies most relevant previous messages

## 🎯 Escalation Logic

### Automatic Escalation Triggers

1. **Direct Request**: Keywords like "human", "agent", "manager"
2. **Repeated Questions**: Similar queries asked multiple times
3. **Frustration Indicators**: Negative sentiment words
4. **Technical Complexity**: Complex error messages, technical jargon
5. **Billing Issues**: Payment, subscription, refund related queries
6. **Extended Conversations**: Long conversations without resolution

### Escalation Scoring
```javascript
{
  should_escalate: boolean,
  reason: string,
  priority: 'low' | 'medium' | 'high',
  confidence: 0.0 - 1.0
}
```

## 🚀 Deployment

### Render.com (Recommended)

1. **Connect Repository**
   - Fork this repository
   - Connect to Render.com

2. **Configure Service**
   - Use the included `render.yaml` configuration
   - Set environment variables in Render Dashboard

3. **Deploy**
   - Render will automatically deploy on git push
   - Visit your deployed URL

### Manual Deployment

#### Using Docker
```bash
# Build image
docker build -t ai-customer-support-bot .

# Run container
docker run -p 3000:3000 --env-file .env.production ai-customer-support-bot
```

#### Using PM2
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start src/app.js --name "ai-support-bot"

# Monitor
pm2 monit
```

## 📊 Database Schema

### Sessions Table
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT 1,
  metadata JSON
);
```

### Conversations Table
```sql
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  message TEXT NOT NULL,
  sender TEXT NOT NULL, -- 'user' or 'bot'
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  message_type TEXT DEFAULT 'text',
  confidence_score REAL,
  FOREIGN KEY (session_id) REFERENCES sessions (id)
);
```

### FAQs Table
```sql
CREATE TABLE faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT,
  category TEXT,
  priority INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Escalations Table
```sql
CREATE TABLE escalations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  FOREIGN KEY (session_id) REFERENCES sessions (id)
);
```

## 🔧 Development

### Running in Development
```bash
npm run dev
```
This starts the server with nodemon for automatic restarts.

### Code Structure Guidelines

- **Services**: Business logic and external integrations
- **Models**: Data access layer
- **Routes**: API endpoint handlers
- **Middleware**: Request processing and validation

### Adding New Features

1. **New FAQ Categories**
   ```javascript
   // Add to src/faqService.js
   const newCategory = 'technical-support';
   ```

2. **Custom Escalation Rules**
   ```javascript
   // Modify src/escalationService.js
   shouldEscalate(message, conversationHistory) {
     // Add custom logic
   }
   ```

3. **Additional LLM Providers**
   ```javascript
   // Extend src/llmService.js
   async generateCustomProviderResponse(message, context) {
     // Implementation
   }
   ```

## 🛠️ Customization

### UI Theming
Modify CSS variables in `public/style.css`:
```css
:root {
  --primary-color: #2563eb;
  --primary-hover: #1d4ed8;
  --success-color: #10b981;
  /* ... more variables */
}
```

### FAQ Categories
Add new categories in the database:
```sql
INSERT INTO faqs (question, answer, keywords, category, priority) 
VALUES ('New question?', 'Answer here', 'keywords', 'new-category', 1);
```

### Bot Personality
Modify responses in `src/llmService.js`:
```javascript
const systemPrompt = `You are ${this.botName}, a [personality description]...`;
```

## 📈 Monitoring and Analytics

### Built-in Endpoints
- `GET /health` - Service health check
- `GET /api/escalation/stats/overview` - Escalation statistics
- `GET /api/chat/sessions` - Active sessions

### Logging
The application uses structured logging with different levels:
- **Error**: System errors and exceptions
- **Warn**: Escalations and low confidence responses
- **Info**: Session starts, API calls
- **Debug**: Detailed conversation flow

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style
- Use ESLint configuration
- Follow JavaScript Standard Style
- Add JSDoc comments for functions
- Use async/await over promises

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Common Issues

1. **Database Connection Errors**
   - Check file permissions for SQLite
   - Verify DATABASE_URL path

2. **LLM API Errors**
   - Verify API key validity
   - Check API rate limits
   - Ensure proper model names

3. **Frontend Not Loading**
   - Check static file serving
   - Verify public directory path

### Getting Help
- Check the API documentation at `/api`
- Review logs for error details
- Open an issue on GitHub

## 🎉 Demo

Try the live demo: [Your Deployed URL]

### Sample Conversations

**FAQ Query:**
```
User: "What are your business hours?"
Bot: "Our customer support is available 24/7. For sales inquiries, our team is available Monday-Friday, 9 AM - 6 PM EST."
```

**Escalation Trigger:**
```
User: "I want to speak to a manager"
Bot: "I understand you'd like to speak with a human agent. Let me connect you with one of our support specialists..."
```

**Technical Issue:**
```
User: "I'm getting a 500 error when trying to login"
Bot: "I see you're experiencing a technical issue that may require specialized support. I'm connecting you with our technical support team..."
```

---

Built with ❤️ using Node.js, Express, and AI

<citations>
<document>
<document_type>WEB_PAGE</document_type>
<document_id>https://render.com</document_id>
</document>
</citations>
