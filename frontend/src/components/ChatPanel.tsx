import React, { useState, useRef, useEffect, JSX } from 'react';
import { ICell } from '../types/notebook';
import './ChatPanel.css';
import ReactMarkdown from 'react-markdown';
import CollapsibleCodeBlock from './CollapsibleCodeBlock'; // Import CollapsibleCodeBlock

interface Message {
  type: string;
  agent: string;
  content: string;
  timestamp: string;
  waiting_input?: boolean;
}

interface ChatPanelProps {
  selectedCells: ICell[];
  messages: Message[];
  onSendMessage: (message: string) => void;
  onClearMessages?: () => void;
  onRemoveCell?: (index: number) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  selectedCells,
  messages,
  onSendMessage,
  onClearMessages,
  onRemoveCell,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [isUserAtBottom, setIsUserAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle scroll events to determine if user is at the bottom
  useEffect(() => {
    const handleScroll = () => {
      if (!messagesEndRef.current) return;
      const container = messagesEndRef.current.parentElement;
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        // Check if the user is near the bottom (within 100px)
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setIsUserAtBottom(isNearBottom);
      }
    };

    const messagesContainer = messagesEndRef.current?.parentElement;
    messagesContainer?.addEventListener('scroll', handleScroll);

    // Initial check
    handleScroll();

    return () => {
      messagesContainer?.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.content.includes('🔧')) {
      setLoading(true);
    } else {
      setLoading(false);
    }

    if (!loading && isUserAtBottom) {
      scrollToBottom();
    }

    if (!isUserAtBottom) {
      setShowScrollButton(true);
    } else {
      setShowScrollButton(false);
    }
  }, [messages, loading, isUserAtBottom]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleClearHistory = () => {
    onSendMessage('clear_history');
    if (onClearMessages) {
      onClearMessages();
    }
  };

  const renderMessages = () => {
    let systemContent = '';
    const messageElements: JSX.Element[] = [];
    messages.forEach((message, index) => {
      if (message.agent.toLowerCase() === 'user') {
        // If there's accumulated system content, render it first
        if (systemContent) {
          messageElements.push(
            <div key={`system-${index}`} className="system-message">
              <ReactMarkdown
                components={{
                  code({ node, className, children, ...props }) {
                    const isInline = !className; // Check if it's inline code
                    const match = /language-(\w+)/.exec(className || '');
                    return !isInline && match ? (
                      <CollapsibleCodeBlock
                        language={match[1]}
                        value={String(children).replace(/\n$/, '')}
                      />
                    ) : (
                      <code className={className || ''} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {systemContent}
              </ReactMarkdown>
            </div>
          );
          systemContent = '';
        }
        // Render user message
        messageElements.push(
          <div key={index} className="user-message-container">
            <div className="user-message">
              <div className="message-content">
                <ReactMarkdown
                  components={{
                    code({ node, className, children, ...props }) {
                      const isInline = !className; // Check if it's inline code
                      const match = /language-(\w+)/.exec(className || '');
                      return !isInline && match ? (
                        <CollapsibleCodeBlock
                          language={match[1]}
                          value={String(children).replace(/\n$/, '')}
                        />
                      ) : (
                        <code className={className || ''} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
              <div className="message-timestamp">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        );
      } else {
        // Accumulate system content
        systemContent += message.content;
      }
    });
    // Render any remaining system content
    if (systemContent) {
      messageElements.push(
        <div key="system-final" className="system-message">
          <ReactMarkdown
            components={{
              code({ node, className, children, ...props }) {
                const isInline = !className; // Check if it's inline code
                const match = /language-(\w+)/.exec(className || '');
                return !isInline && match ? (
                  <CollapsibleCodeBlock
                    language={match[1]}
                    value={String(children).replace(/\n$/, '')}
                  />
                ) : (
                  <code className={className || ''} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {systemContent}
          </ReactMarkdown>
        </div>
      );
    }
    // Show loading indicator
    if (loading) {
      messageElements.push(
        <div key="loading" className="loading-spinner">
          Loading...
        </div>
      );
    }
    return messageElements;
  };

  const renderSelectedCells = () => {
    return selectedCells.map((cell, index) => (
      <div key={index} className="selected-cell">
        <span>cell {index}</span>
        <button
          className="cell-remove-btn"
          onClick={() => onRemoveCell?.(index)}
          aria-label="Remove cell"
        >
          ×
        </button>
      </div>
    ));
  };

  return (
    <div className="chat-panel">
      <div className="messages-header">
        <button onClick={handleClearHistory} className="clear-history-button">
          Clear History
        </button>
      </div>
      <div className="messages-container">
        {renderMessages()}
        <div ref={messagesEndRef} />
        {showScrollButton && (
          <button onClick={scrollToBottom} className="scroll-to-bottom-button">
            ↓ Scroll to Bottom
          </button>
        )}
      </div>
      <div className="selected-cells-container">
        {selectedCells.length > 0 && (
          <>
            <div className="selected-cells-header">Selected Cells:</div>
            {renderSelectedCells()}
          </>
        )}
      </div>
      <form onSubmit={handleSubmit} className="input-container">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type your message..."
          className="message-input"
        />
        <button type="submit" className="send-button">
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;