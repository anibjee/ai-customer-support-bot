class ChatBot {
    constructor() {
        this.sessionId = null;
        this.isConnected = false;
        this.isTyping = false;
        
        this.elements = {
            chatMessages: document.getElementById('chatMessages'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            typingIndicator: document.getElementById('typingIndicator'),
            faqBtn: document.getElementById('faqBtn'),
            clearBtn: document.getElementById('clearBtn'),
            faqModal: document.getElementById('faqModal'),
            closeFaqModal: document.getElementById('closeFaqModal'),
            faqList: document.getElementById('faqList'),
            faqSearch: document.getElementById('faqSearch'),
            sessionInfo: document.getElementById('sessionInfo'),
            sessionIdSpan: document.getElementById('sessionId'),
            connectionStatus: document.getElementById('connectionStatus'),
            welcomeTimestamp: document.getElementById('welcomeTimestamp'),
            charCounter: document.querySelector('.char-counter'),
            quickActions: document.getElementById('quickActions')
        };

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.updateWelcomeTimestamp();
        await this.createSession();
        await this.loadFAQs();
        this.updateConnectionStatus(true);
    }

    setupEventListeners() {
        // Message input and sending
        this.elements.messageInput.addEventListener('input', this.handleInputChange.bind(this));
        this.elements.messageInput.addEventListener('keypress', this.handleKeyPress.bind(this));
        this.elements.sendBtn.addEventListener('click', this.sendMessage.bind(this));

        // Quick actions
        this.elements.quickActions.addEventListener('click', (e) => {
            if (e.target.closest('.quick-action-btn')) {
                const message = e.target.closest('.quick-action-btn').dataset.message;
                this.elements.messageInput.value = message;
                this.updateCharCounter();
                this.updateSendButton();
                this.sendMessage();
            }
        });

        // Header actions
        this.elements.faqBtn.addEventListener('click', this.showFAQModal.bind(this));
        this.elements.clearBtn.addEventListener('click', this.clearChat.bind(this));

        // FAQ Modal
        this.elements.closeFaqModal.addEventListener('click', this.hideFAQModal.bind(this));
        this.elements.faqModal.addEventListener('click', (e) => {
            if (e.target === this.elements.faqModal) {
                this.hideFAQModal();
            }
        });

        // FAQ Search and Categories
        this.elements.faqSearch.addEventListener('input', this.handleFAQSearch.bind(this));
        document.querySelector('.faq-categories').addEventListener('click', this.handleCategoryFilter.bind(this));

        // Auto-resize textarea
        this.elements.messageInput.addEventListener('input', this.autoResizeTextarea.bind(this));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.faqModal.classList.contains('active')) {
                this.hideFAQModal();
            }
        });
    }

    handleInputChange(e) {
        this.updateCharCounter();
        this.updateSendButton();
    }

    handleKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (this.elements.messageInput.value.trim() && !this.isTyping) {
                this.sendMessage();
            }
        }
    }

    updateCharCounter() {
        const length = this.elements.messageInput.value.length;
        this.elements.charCounter.textContent = `${length}/1000`;
    }

    updateSendButton() {
        const hasText = this.elements.messageInput.value.trim().length > 0;
        this.elements.sendBtn.disabled = !hasText || this.isTyping;
    }

    autoResizeTextarea() {
        const textarea = this.elements.messageInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    updateWelcomeTimestamp() {
        const now = new Date();
        this.elements.welcomeTimestamp.textContent = this.formatTime(now);
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
    }

    async createSession() {
        try {
            const response = await fetch('/api/chat/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            const data = await response.json();
            
            if (data.success) {
                this.sessionId = data.data.session_id;
                this.elements.sessionIdSpan.textContent = this.sessionId.substring(0, 8) + '...';
                console.log('Session created:', this.sessionId);
            } else {
                throw new Error(data.error || 'Failed to create session');
            }
        } catch (error) {
            console.error('Error creating session:', error);
            this.showError('Failed to connect to chat service. Please refresh the page.');
        }
    }

    async sendMessage() {
        const message = this.elements.messageInput.value.trim();
        if (!message || this.isTyping || !this.sessionId) return;

        // Add user message to chat
        this.addMessage(message, 'user');
        
        // Clear input and reset
        this.elements.messageInput.value = '';
        this.updateCharCounter();
        this.updateSendButton();
        this.autoResizeTextarea();

        // Show typing indicator
        this.showTyping();

        try {
            const response = await fetch('/api/chat/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    message: message
                })
            });

            const data = await response.json();
            
            if (data.success) {
                const botResponse = data.data;
                this.addMessage(botResponse.message, 'bot', botResponse.type, {
                    confidence: botResponse.confidence,
                    source: botResponse.source,
                    metadata: botResponse.metadata
                });

                // Handle escalation
                if (botResponse.type === 'escalation') {
                    this.handleEscalation(botResponse);
                }
            } else {
                throw new Error(data.error || 'Failed to send message');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessage(
                'Sorry, I encountered an error processing your message. Please try again.',
                'bot',
                'error'
            );
        } finally {
            this.hideTyping();
        }
    }

    addMessage(text, sender, type = 'text', metadata = {}) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        if (type && type !== 'text') {
            messageDiv.classList.add(type);
        }

        const timestamp = this.formatTime(new Date());
        const senderName = sender === 'user' ? 'You' : 'Customer Support Bot';
        
        messageDiv.innerHTML = `
            <div class="message-avatar ${sender}">
                <i class="fas fa-${sender === 'user' ? 'user' : 'robot'}"></i>
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="sender">${senderName}</span>
                    <span class="timestamp">${timestamp}</span>
                </div>
                <div class="message-text">${this.formatMessageText(text, type)}</div>
                ${this.renderMetadata(metadata)}
            </div>
        `;

        this.elements.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatMessageText(text, type) {
        // Convert line breaks to HTML
        let formatted = text.replace(/\n/g, '<br>');
        
        // Handle escalation ticket formatting
        if (type === 'escalation') {
            formatted = formatted.replace(
                /🎫 Escalation Ticket: #(\d+)/g,
                '<strong>🎫 Escalation Ticket: #$1</strong>'
            );
            formatted = formatted.replace(
                /📞 ([^.]+\.)/g,
                '<strong>📞 $1</strong>'
            );
        }

        return formatted;
    }

    renderMetadata(metadata) {
        if (!metadata || Object.keys(metadata).length === 0) return '';
        
        let html = '<div class="message-metadata">';
        
        if (metadata.confidence !== undefined) {
            const confidence = Math.round(metadata.confidence * 100);
            html += `<span class="confidence">Confidence: ${confidence}%</span>`;
        }
        
        if (metadata.source) {
            html += `<span class="source">Source: ${metadata.source.replace('_', ' ')}</span>`;
        }
        
        html += '</div>';
        return html;
    }

    handleEscalation(response) {
        // Update status to show escalation
        this.updateConnectionStatus(true, 'Escalated to human agent');
        
        // You could add additional escalation handling here
        console.log('Conversation escalated:', response.escalation);
    }

    showTyping() {
        this.isTyping = true;
        this.elements.typingIndicator.style.display = 'flex';
        this.updateSendButton();
        this.scrollToBottom();
    }

    hideTyping() {
        this.isTyping = false;
        this.elements.typingIndicator.style.display = 'none';
        this.updateSendButton();
    }

    scrollToBottom() {
        setTimeout(() => {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }, 100);
    }

    updateConnectionStatus(connected, customMessage = null) {
        this.isConnected = connected;
        const statusElement = this.elements.connectionStatus;
        const statusDot = statusElement.querySelector('.status-dot');
        
        if (connected) {
            statusDot.className = 'status-dot online';
            statusElement.innerHTML = `
                <span class="status-dot online"></span>
                ${customMessage || 'Connected'}
            `;
        } else {
            statusDot.className = 'status-dot offline';
            statusElement.innerHTML = `
                <span class="status-dot offline"></span>
                Disconnected
            `;
        }
    }

    async clearChat() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            // Clear messages (keep welcome message)
            const messages = this.elements.chatMessages.querySelectorAll('.message');
            messages.forEach(message => message.remove());
            
            // Create new session
            await this.createSession();
        }
    }

    showError(message) {
        this.addMessage(message, 'bot', 'error');
    }

    // FAQ Modal Functions
    showFAQModal() {
        this.elements.faqModal.classList.add('active');
        this.elements.faqSearch.focus();
    }

    hideFAQModal() {
        this.elements.faqModal.classList.remove('active');
    }

    async loadFAQs() {
        try {
            const response = await fetch('/api/faq');
            const data = await response.json();
            
            if (data.success) {
                this.renderFAQs(data.data.faqs);
            } else {
                console.error('Failed to load FAQs:', data.error);
            }
        } catch (error) {
            console.error('Error loading FAQs:', error);
        }
    }

    renderFAQs(faqs) {
        this.allFAQs = faqs;
        this.displayFAQs(faqs);
    }

    displayFAQs(faqs) {
        this.elements.faqList.innerHTML = '';
        
        if (faqs.length === 0) {
            this.elements.faqList.innerHTML = '<p class="no-results">No FAQs found.</p>';
            return;
        }

        faqs.forEach((faq, index) => {
            const faqDiv = document.createElement('div');
            faqDiv.className = 'faq-item';
            faqDiv.innerHTML = `
                <div class="faq-question" onclick="this.parentNode.querySelector('.faq-answer').classList.toggle('open')">
                    ${faq.question}
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div class="faq-answer">
                    ${faq.answer.replace(/\n/g, '<br>')}
                    <br><br>
                    <button class="use-faq-btn" onclick="chatBot.useFAQ('${faq.question}')">
                        Ask this question
                    </button>
                </div>
            `;
            this.elements.faqList.appendChild(faqDiv);
        });
    }

    useFAQ(question) {
        this.elements.messageInput.value = question;
        this.updateCharCounter();
        this.updateSendButton();
        this.hideFAQModal();
        this.elements.messageInput.focus();
    }

    handleFAQSearch(e) {
        const query = e.target.value.toLowerCase();
        if (!query) {
            this.displayFAQs(this.allFAQs);
            return;
        }

        const filtered = this.allFAQs.filter(faq =>
            faq.question.toLowerCase().includes(query) ||
            faq.answer.toLowerCase().includes(query) ||
            (faq.keywords && faq.keywords.toLowerCase().includes(query))
        );

        this.displayFAQs(filtered);
    }

    handleCategoryFilter(e) {
        if (!e.target.classList.contains('category-btn')) return;

        // Update active category
        document.querySelectorAll('.category-btn').forEach(btn => 
            btn.classList.remove('active'));
        e.target.classList.add('active');

        const category = e.target.dataset.category;
        
        if (!category) {
            this.displayFAQs(this.allFAQs);
        } else {
            const filtered = this.allFAQs.filter(faq => faq.category === category);
            this.displayFAQs(filtered);
        }
    }
}

// Initialize the chat bot when the page loads
let chatBot;
document.addEventListener('DOMContentLoaded', () => {
    chatBot = new ChatBot();
});

// Additional CSS for metadata display
const additionalStyles = `
<style>
.message-metadata {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 0.5rem;
    display: flex;
    gap: 1rem;
}

.no-results {
    text-align: center;
    color: var(--text-muted);
    font-style: italic;
    padding: 2rem;
}

.use-faq-btn {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 0.875rem;
    transition: background-color 0.2s;
}

.use-faq-btn:hover {
    background: var(--primary-hover);
}

.faq-question i {
    transition: transform 0.2s;
}

.faq-answer.open + .faq-question i,
.faq-answer.open ~ .faq-question i {
    transform: rotate(180deg);
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', additionalStyles);