import { ICell } from '../types/notebook';

type MessageType = 'message' | 'notebook_update' | 'user_input' | 'start_processing' | 'save_notebook';

interface Message {
  type: MessageType;
  agent?: string;
  content?: string;
  timestamp?: string;
  waiting_input?: boolean;
  notebook_path?: string;
  cells?: ICell[];
  selected_cells_content?: string;
  user_message?: string;
  filename?: string;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: ((message: any) => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private initialConnectionTimeout = 5000;
  private isConnecting = false;
  private initialConnectionDelay = 1000; // Add delay before first connection attempt

  constructor() {
    this.connect = this.connect.bind(this);
    // Remove the automatic connection from constructor
    // Let the component explicitly call connect when needed
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      console.log(`WebSocket already ${this.ws.readyState === WebSocket.CONNECTING ? 'connecting' : 'connected'}`);
      return;
    }

    if (this.isConnecting) {
      console.log('Connection attempt already in progress');
      return;
    }

    // Set a flag to track if disconnect was called during connection attempt
    let isDisconnectRequested = false;

    this.isConnecting = true;
    console.log('Attempting to connect to WebSocket server...');

    try {
      const wsUrl = 'ws://localhost:8765/ws';
      console.log(`Connecting to ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'blob';

      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          console.log('Connection attempt timed out');
          this.cleanupConnection();
          if (!isDisconnectRequested) {
            this.handleReconnect();
          }
        }
      }, this.initialConnectionTimeout);

      this.ws.onopen = () => {
        if (isDisconnectRequested) {
          console.log('Connection established but disconnect was requested, closing...');
          this.cleanupConnection();
          return;
        }

        console.log(`WebSocket connection established successfully (State: ${this.ws?.readyState})`);
        clearTimeout(connectionTimeout);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      };

      this.ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log(`WebSocket disconnected - Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`);
        this.cleanupConnection();
        
        if (!isDisconnectRequested && event.code !== 1000) {
          this.handleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error occurred:', {
          error,
          readyState: this.ws?.readyState,
          connecting: this.isConnecting,
          attempts: this.reconnectAttempts
        });
        clearTimeout(connectionTimeout);
        this.isConnecting = false;
      };

      // Add message handler
      this.ws.onmessage = this.handleMessage.bind(this);

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.cleanupConnection();
      if (!isDisconnectRequested) {
        this.handleReconnect();
      }
    }

    // Modify disconnect to set the flag
    const originalDisconnect = this.disconnect;
    this.disconnect = () => {
      isDisconnectRequested = true;
      originalDisconnect.call(this);
    };
  }

  private cleanupConnection() {
    if (this.ws) {
      const currentState = this.ws.readyState;
      try {
        // Remove all event listeners first
        this.ws.onopen = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;

        // Only close if the connection is not already closed or closing
        if (currentState !== WebSocket.CLOSED && currentState !== WebSocket.CLOSING) {
          this.ws.close(1000, 'Normal closure');
        }
      } catch (error) {
        console.error('Error cleaning up WebSocket connection:', error);
      }
    }
    this.ws = null;
    this.isConnecting = false;
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        this.reconnectAttempts++;
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
        this.connect();
      }, this.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached. Please refresh the page.');
    }
  }

  disconnect() {
    console.log('Disconnecting WebSocket...');
    // Cancel any pending reconnection attempts
    this.reconnectAttempts = this.maxReconnectAttempts;
    this.cleanupConnection();
  }

  addMessageHandler(handler: (message: any) => void) {
    this.messageHandlers.push(handler);
  }

  removeMessageHandler(handler: (message: any) => void) {
    const index = this.messageHandlers.indexOf(handler);
    if (index !== -1) {
      this.messageHandlers.splice(index, 1);
    }
  }

  sendUserInput(message: string, selectedCells: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "user_input",
        user_message: message,
        selected_cells_content: selectedCells
      }));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  startProcessing(filename: string) {
    this.send({
      type: 'start_processing',
      filename
    });
  }

  saveNotebook(notebookPath: string, content: any) {
    this.send({
      type: 'save_notebook',
      notebook_path: notebookPath,
      content
    });
  }

  handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      this.messageHandlers.forEach(handler => handler(data));
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }
}

export const websocketService = new WebSocketService(); 