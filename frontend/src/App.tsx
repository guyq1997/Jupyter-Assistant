import React, { useState, useCallback, useEffect, useRef } from 'react';
import Split from 'react-split';
import NotebookPanel from './components/NotebookPanel';
import ChatPanel from './components/ChatPanel';
import { ICell, INotebook } from './types/notebook';
import { websocketService } from './services/websocket';
import './App.css';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  type: string;
  agent: string;
  content: string;
  timestamp: string;
  waiting_input?: boolean;
}

function App() {
  const [selectedCells, setSelectedCells] = useState<ICell[]>([]);
  const [notebook, setNotebook] = useState<INotebook>({ cells: [] });
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingMessage, setPendingMessage] = useState<{
    message: string;
    selectedContent: string;
    path: string | null;
  } | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    websocketService.connect();
    
    // Add message handler for system messages
    const handleSystemMessage = (message: any) => {
      if (message.type === 'message' && message.agent) {
        setMessages(prev => [...prev, message]);
      }
    };
    
    websocketService.addMessageHandler(handleSystemMessage);
    
    // Cleanup on unmount
    return () => {
      websocketService.removeMessageHandler(handleSystemMessage);
      websocketService.disconnect();
    };
  }, []);

  useEffect(() => {
    // Send message when pendingMessage is set
    if (pendingMessage) {
      websocketService.send({
        type: 'user_input',
        message: pendingMessage.message,
        selected_cells: pendingMessage.selectedContent,
        path: pendingMessage.path,
        timestamp: new Date().toISOString()
      });
      setPendingMessage(null);
    }
  }, [pendingMessage]);


  const handleSendMessage = useCallback((message: string) => {
    const userMessage = {
      type: 'message',
      agent: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Prepare the message with selected cells content including index and type
    const selectedContent = selectedCells
      .map(cell => {
        const cellContent = cell.source.join('\n');
        return `<cell_${cell.index}_${cell.cell_type}>\n${cellContent}\n</cell_${cell.index}_${cell.cell_type}>`;
      })
      .join('\n\n');
    
    setPendingMessage({
      message,
      selectedContent,
      path:  null
    });
  }, [selectedCells]);


  const handleClearMessages = () => {
    setMessages([]);
  };

  const handleRemoveCell = useCallback((index: number) => {
    setSelectedCells(prev => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="App">
      <Split 
        className="split-container"
        sizes={[60, 40]} 
        minSize={300}
        gutterSize={8}
        snapOffset={30}
      >
        <NotebookPanel 
          selectcells={selectedCells}
          setselectcells={setSelectedCells}
        />
        <ChatPanel 
          selectedCells={selectedCells}
          messages={messages}
          onSendMessage={handleSendMessage}
          onClearMessages={handleClearMessages}
          onRemoveCell={handleRemoveCell}
        />
      </Split>
    </div>
  );
}

export default App;
