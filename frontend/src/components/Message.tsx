import React from 'react';
import { IMessage } from '../types/chat';
import './Message.css';

interface MessageProps {
  message: IMessage;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  const formattedTime = new Date(message.timestamp).toLocaleTimeString();
  
  return (
    <div className={`message ${message.role}`}>
      <div className="message-header">
        <span className="message-role">
          {message.role === 'assistant' ? 'AI Assistant' : 'You'}
        </span>
        <span className="message-time">{formattedTime}</span>
      </div>
      <div className="message-content">
        {message.content}
      </div>
    </div>
  );
};

export default Message; 