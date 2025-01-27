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

  useEffect(() => {
    // Connect to WebSocket when component mounts
    websocketService.connect();

    // Handle incoming messages
    const handleMessage = (message: any) => {
      if (message.type === 'notebook_update') {
        try {
          const notebookContent = typeof message.content === 'string' 
            ? JSON.parse(message.content) 
            : message.content;
            
          // Ensure cells have proper source arrays
          const processedNotebook = {
            ...notebookContent,
            cells: notebookContent.cells.map((cell: any) => ({
              ...cell,
              id: cell.id || uuidv4(),
              cell_type: cell.cell_type || 'markdown',
              source: Array.isArray(cell.source) ? cell.source : [cell.source || '']
            }))
          };
          
          setNotebook(processedNotebook);
        } catch (error) {
          console.error('Error processing notebook update:', error);
        }
      } else if (message.type === 'message') {
        setMessages(prev => [...prev, message]);
      }
    };

    websocketService.addMessageHandler(handleMessage);

    // Cleanup on unmount
    return () => {
      websocketService.removeMessageHandler(handleMessage);
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

  const handleCellsSelected = useCallback((cells: ICell[]) => {
    setSelectedCells(cells);
  }, []);

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
        return `<cell_${cell.notebookIndex}_${cell.cell_type}>\n${cellContent}\n</cell_${cell.notebookIndex}_${cell.cell_type}>`;
      })
      .join('\n\n');
    
    setPendingMessage({
      message,
      selectedContent,
      path: notebook.path || null
    });
  }, [selectedCells, notebook.path]);

  const handleSaveNotebook = useCallback((notebookPath: string) => {
    websocketService.saveNotebook(notebookPath, notebook);
  }, [notebook]);

  const handleClearMessages = () => {
    setMessages([]);
  };

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
          notebook={notebook}
          onCellsSelected={handleCellsSelected}
          onSave={handleSaveNotebook}
        />
        <ChatPanel 
          selectedCells={selectedCells}
          messages={messages}
          onSendMessage={handleSendMessage}
          onClearMessages={handleClearMessages}
        />
      </Split>
    </div>
  );
}

export default App;
