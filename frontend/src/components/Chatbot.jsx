import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const quickQuestions = [
  'What is my latest complaint ID?',
  'How do I submit a complaint?',
  'Which department should handle my complaint?',
  'When will my complaint be resolved?',
  'Check my complaint status',
];

const Chatbot = () => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi! I can explain how to submit a complaint, suggest the department for your issue, or check a complaint status. Ask “What is my latest complaint ID?” to find your newest ticket, or enter an ID such as CMP-2026-00001.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const message = text.trim();
    if (!message || loading) return;

    const conversation = messages.filter((item) => item.role !== 'error');
    setMessages((current) => [...current, { role: 'user', text: message }]);
    setInput('');
    setLoading(true);

    try {
      const history = conversation
        .filter((item) => item.role === 'user' || item.role === 'assistant')
        .slice(-10)
        .map((item) => ({
          role: item.role === 'assistant' ? 'model' : 'user',
          text: item.text,
        }));
      const { data } = await api.post('/chat', { message, history });
      setMessages((current) => [...current, { role: 'assistant', text: data.reply }]);
    } catch (requestError) {
      const messageText =
        requestError.response?.data?.message || 'Could not send your message. Please try again.';
      setMessages((current) => [...current, { role: 'error', text: messageText }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(input);
  };

  return (
    <section className="page chat-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Support assistant</span>
          <h1>Complaint chatbot</h1>
          <p className="chat-intro">
            Get help submitting a ticket, finding its suggested department, or checking its status.
          </p>
        </div>
        <Link className="btn btn--primary" to="/complaints/new">
          Submit a complaint
        </Link>
      </header>

      <section className="chat-card" aria-label="Complaint support chat">
        <div className="chat-messages" aria-live="polite">
          {messages.map((item, index) => (
            <div
              className={`chat-message chat-message--${item.role}`}
              key={`${item.role}-${index}`}
            >
              <span className="chat-message__label">
                {item.role === 'user' ? 'You' : item.role === 'error' ? 'Notice' : 'Support bot'}
              </span>
              <p>{item.text}</p>
              {item.role === 'assistant' &&
                item.text.includes('New Ticket') &&
                item.text.toLowerCase().includes('submit') && (
                  <Link to="/complaints/new" className="chat-inline-link">
                    Open the complaint form
                  </Link>
                )}
            </div>
          ))}
          {loading && (
            <div className="chat-message chat-message--assistant" role="status">
              <span className="chat-message__label">Support bot</span>
              <p>Thinking...</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {messages.length <= 1 && (
          <div className="chat-quick-questions" aria-label="Suggested questions">
            {quickQuestions.map((question) => (
              <button
                className="chat-quick-question"
                key={question}
                onClick={() => sendMessage(question)}
                type="button"
                disabled={loading}
              >
                {question}
              </button>
            ))}
          </div>
        )}

        <form className="chat-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="chat-message">Your message</label>
          <input
            id="chat-message"
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={2000}
            placeholder="Ask for your latest complaint or enter its ID"
            disabled={loading}
          />
          <button className="btn btn--primary" type="submit" disabled={loading || !input.trim()}>
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
        <p className="chat-note">
          Resolution estimates are not currently recorded. The bot can share a resolution date only
          after a complaint has been marked resolved.
        </p>
      </section>
    </section>
  );
};

export default Chatbot;
