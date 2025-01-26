import React, { useState, useRef, useEffect, JSX } from 'react';
import { ICell } from '../types/notebook';
import './ChatPanel.css';

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

const ChatPanel: React.FC<ChatPanelProps> = ({ selectedCells, messages, onSendMessage, onClearMessages, onRemoveCell }) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
              {systemContent}
            </div>
          );
          systemContent = '';
        }
        // Render user message in bubble
        messageElements.push(
          <div key={index} className="user-message-container">
            <div className="user-message">
              <div className="message-content">{message.content}</div>
              <div className="message-timestamp">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        );
      } else {
        // Accumulate system content
        systemContent += (systemContent ? ' ' : '') + message.content;
      }
    });

    // Add any remaining system content
    if (systemContent) {
      messageElements.push(
        <div key="system-final" className="system-message">
          {systemContent}
        </div>
      );
    }

    return messageElements;
  };

  const renderSelectedCells = () => {
    return selectedCells.map((cell, index) => (
      <div key={index} className="selected-cell">
        <span>{cell.notebookIndex}</span>
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
        <button 
          onClick={handleClearHistory}
          className="clear-history-button"
        >
          Clear History
        </button>
      </div>
      <div className="messages-container">
        {renderMessages()}
        <div ref={messagesEndRef} />
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
        <button type="submit" className="send-button">Send</button>
      </form>
    </div>
  );
};

export default ChatPanel; 