'use strict';
var userInput = null;
let ws;
let waitingForInput = false;
let messagesContainer;

function connectWebSocket() {
    ws = new WebSocket(`ws://${window.location.host}/ws`);
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        displayMessage(data);
    };

    ws.onclose = function() {
        console.log('WebSocket connection closed. Attempting to reconnect...');
        setTimeout(connectWebSocket, 1000);
    };

    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
}

function sendMessage() {
    if (!userInput) {
        userInput = document.getElementById('user-input');
        if (!userInput) {
            console.error('Input element with id "user-input" not found.');
            return;
        }
    }
    const message = userInput.value.trim();
    if (!message) return;

    // Get selected cells content with error handling
    let selectedCellsContent = '';
    try {
        if (window.notebookFunctions && typeof window.notebookFunctions.getSelectedCellsContent === 'function') {
            console.log('Getting selected cells content...');
            selectedCellsContent = window.notebookFunctions.getSelectedCellsContent();
            console.log('Selected cells content:', selectedCellsContent);
        } else {
            console.warn('getSelectedCellsContent is not available');
        }
    } catch (error) {
        console.warn('Error getting selected cells content:', error);
    }
    
    // Combine message with selected cells content
    const fullMessage = selectedCellsContent ? 
        `${message}\n\n${selectedCellsContent}` : 
        message;
    
    console.log('Sending message:', fullMessage);

    ws.send(JSON.stringify({
        type: 'user_input',
        content: fullMessage
    }));

    // Append user message to chat
    appendMessage({
        agent: 'User',
        content: fullMessage
    });

    // Clear input after sending
    userInput.value = '';
}

function displayMessage(data) {
    if (data.type === "notebook_update") {
        window.notebookFunctions.displayNotebook(data.content);
        return;
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${data.agent.toLowerCase()}`;
    
    const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    const message = data.message || data.content || ''; // Provide empty string as fallback
    
    // Create message content with safe content
    messageDiv.innerHTML = `<strong>${data.agent}</strong> (${timestamp}): ${marked.parse(message)}`;
    document.getElementById('messages-content').appendChild(messageDiv);
    document.getElementById('messages-content').scrollTop = document.getElementById('messages-content').scrollHeight;

    if (data.waiting_input) {
        if (!userInput) {
            userInput = document.getElementById('user-input');
            if (!userInput) {
                console.error('Input element with id "user-input" not found.');
                return;
            }
        }
        userInput.disabled = false;
        userInput.focus();
    }
}

// Add resize functionality
function initializeResizer() {
    const messagesPanel = document.getElementById('messages');
    const notebookSection = document.getElementById('notebook-section');
    const resizer = document.getElementById('messages-resizer');
    let isResizing = false;
    let lastDownX = 0;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        lastDownX = e.clientX;
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const delta = lastDownX - e.clientX;
        const newWidth = messagesPanel.offsetWidth + delta;
        const maxWidth = window.innerWidth - 400; // Leave at least 400px for notebook
        const minWidth = 200;

        if (newWidth >= minWidth && newWidth <= maxWidth) {
            messagesPanel.style.width = `${newWidth}px`;
            lastDownX = e.clientX;
        }
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.userSelect = '';
    });

    // Add window resize handler to ensure valid widths
    window.addEventListener('resize', () => {
        const currentWidth = messagesPanel.offsetWidth;
        const maxWidth = window.innerWidth - 400;
        
        if (currentWidth > maxWidth) {
            messagesPanel.style.width = `${maxWidth}px`;
        }
    });
}

// File upload handling
function initializeFileUpload() {
    const fileUpload = document.getElementById('file-upload');
    const uploadBtn = document.getElementById('upload-btn');

    uploadBtn.addEventListener('click', () => {
        fileUpload.click();
    });

    fileUpload.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        uploadBtn.disabled = true;

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (response.ok) {
                if (result.notebook_content) {
                    window.notebookFunctions.displayNotebook(result.notebook_content);
                }
                
                ws.send(JSON.stringify({
                    type: 'start_processing',
                    filename: result.filename,
                    auto_analyze: false
                }));
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Upload failed:', error.message);
        } finally {
            uploadBtn.disabled = false;
            fileUpload.value = '';
        }
    });
}

// Initialize everything
function initialize() {
    console.log('Starting chat initialization...');
    
    // Wait for notebook functions to be available
    const checkNotebookFunctions = () => {
        console.log('Checking notebook functions availability...');
        if (!window.notebookFunctions || !window.notebookFunctions.getSelectedCellsContent) {
            console.log('Notebook functions not ready yet, retrying in 100ms...');
            setTimeout(checkNotebookFunctions, 100);
            return;
        }
        
        console.log('Notebook functions available, proceeding with chat initialization');
        
        userInput = document.getElementById('user-input');
        messagesContainer = document.getElementById('messages-content');

        // Initialize WebSocket connection
        ws = new WebSocket(`ws://${window.location.host}/ws`);

        ws.onopen = () => {
            console.log('Connected to server');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            // Handle different message types
            switch (data.type) {
                case 'message':
                    appendMessage(data);
                    break;
                case 'notebook_update':
                    // Only update notebook if it's a notebook update message
                    if (data.content && data.content.cells) {
                        window.notebookFunctions.displayNotebook(data.content);
                    }
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            appendMessage({
                agent: 'System',
                content: 'Error connecting to server. Please refresh the page.'
            });
        };

        // Add event listeners
        document.getElementById('send-button').addEventListener('click', sendMessage);
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // Add notebook control event listeners
        document.getElementById('add-cell-btn').addEventListener('click', () => window.notebookFunctions.addCell());
        document.getElementById('save-notebook-btn').addEventListener('click', window.notebookFunctions.saveNotebook);

        // Initialize resizer
        initializeResizer();

        // Initialize file upload
        initializeFileUpload();
        
        console.log('Chat initialization complete');
    };
    
    // Start checking for notebook functions
    checkNotebookFunctions();
}

function appendMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.agent.toLowerCase()}-message`;
    
    const agentSpan = document.createElement('span');
    agentSpan.className = 'agent-name';
    agentSpan.textContent = message.agent;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Ensure content is a non-null string before parsing
    const content = message.content || '';
    contentDiv.innerHTML = marked.parse(content);
    
    messageDiv.appendChild(agentSpan);
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}