'use strict';

import { connectWebSocket, sendWebSocketMessage, isWebSocketConnected } from '../../core/websocket.js';
import { initializeMessageHandler, displayMessage, displaySystemMessage, clearMessages } from '../../core/messageHandler.js';
import { initializeResizer, initializeFileUpload, downloadNotebook } from '../components/uiComponents.js';
import { handleNotebookUpdate, handleUploadSuccess, getSelectedCellsContent } from '../../core/notebookIntegration.js';

let userInput = null;
let waitingForInput = false;
let messagesContainer;
const INITIAL_RECONNECT_DELAY = 1000;

function sendUserMessage() {
    if (!isWebSocketConnected()) {
        displaySystemMessage('Connection lost. Please wait for reconnection or refresh the page.');
        return;
    }

    const message = userInput.value.trim();
    if (!message) return;

    const selected_cells_content = getSelectedCellsContent();
    const fullMessage = selected_cells_content ? 
        `Selected cells:\n${selected_cells_content}\n\nMessage: ${message}` : 
        message;

    try {
        sendWebSocketMessage({
            type: 'user_input',
            selected_cells_content: selected_cells_content,
            user_message: message
        });

        displayMessage({
            agent: 'User',
            content: fullMessage
        });

        userInput.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        displaySystemMessage('Failed to send message. Please try again.');
    }
}

function clearHistory() {
    clearMessages();
    sendWebSocketMessage({
        type: 'user_input',
        user_message: 'clear_history',
        selected_cells_content: ''
    });
}

function handleMessage(data) {
    if (data.type === "notebook_update") {
        handleNotebookUpdate(data);
    } else {
        displayMessage(data);
    }
}

function initialize() {
    console.log('Starting chat initialization...');
    
    const checkNotebookFunctions = () => {
        console.log('Checking notebook functions availability...');
        if (!window.notebookFunctions || !window.notebookFunctions.displayNotebook) {
            console.log('Notebook functions not ready yet, retrying in 100ms...');
            setTimeout(checkNotebookFunctions, 100);
            return;
        }
        
        console.log('Notebook functions available, proceeding with chat initialization');
        
        userInput = document.getElementById('user-input');
        messagesContainer = document.getElementById('messages-content');

        // Initialize message handler
        initializeMessageHandler(messagesContainer, userInput);

        // Initialize WebSocket connection
        connectWebSocket(handleMessage, displaySystemMessage);

        // Add event listeners
        document.getElementById('send-button').addEventListener('click', sendUserMessage);
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendUserMessage();
            }
        });

        // Add clear history button event listener
        document.getElementById('clear-history-btn').addEventListener('click', clearHistory);

        // Add notebook control event listeners
        document.getElementById('add-cell-btn').addEventListener('click', downloadNotebook);
        document.getElementById('save-notebook-btn').addEventListener('click', () => {
            if (window.notebookFunctions?.saveNotebook) {
                window.notebookFunctions.saveNotebook();
                
                const currentNotebook = localStorage.getItem('currentNotebook');
                if (currentNotebook) {
                    sendWebSocketMessage({
                        type: 'start_processing',
                        filename: currentNotebook,
                        auto_analyze: false
                    });
                }
            }
        });

        // Initialize UI components
        initializeResizer();
        initializeFileUpload(handleUploadSuccess);
        
        console.log('Chat initialization complete');
    }
    
    checkNotebookFunctions();
}

// Initialize when the document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}