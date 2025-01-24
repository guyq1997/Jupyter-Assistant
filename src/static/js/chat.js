'use strict';
var userInput = null;
let ws = null;
let waitingForInput = false;
let messagesContainer;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;

function getReconnectDelay() {
    // Exponential backoff with maximum of 30 seconds
    return Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 30000);
}

function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return;
    }

    try {
        ws = new WebSocket(`ws://${window.location.host}/ws`);
        
        ws.onopen = function() {
            console.log('WebSocket connected');
            reconnectAttempts = 0; // Reset reconnect attempts on successful connection
            
            // Re-establish notebook connection if there was one
            const savedNotebook = localStorage.getItem('currentNotebook');
            if (savedNotebook && window.notebookFunctions) {
                console.log('Re-establishing notebook connection for:', savedNotebook);
                ws.send(JSON.stringify({
                    type: 'start_processing',
                    filename: savedNotebook,
                    auto_analyze: false
                }));
            }
        };
        
        ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                displayMessage(data);
            } catch (error) {
                console.error('Error processing message:', error);
            }
        };

        ws.onclose = function(event) {
            console.log('WebSocket connection closed. Code:', event.code, 'Reason:', event.reason);
            
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                const delay = getReconnectDelay();
                console.log(`Attempting to reconnect in ${delay}ms... (Attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
                
                setTimeout(() => {
                    reconnectAttempts++;
                    connectWebSocket();
                }, delay);
            } else {
                console.error('Max reconnection attempts reached. Please refresh the page.');
                displaySystemMessage('Connection lost. Please refresh the page to reconnect.');
            }
        };

        ws.onerror = function(error) {
            console.error('WebSocket error:', error);
            // Let onclose handle the reconnection
        };
    } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            setTimeout(connectWebSocket, getReconnectDelay());
        }
    }
}

function displaySystemMessage(message) {
    if (messagesContainer) {
        const systemMessageDiv = document.createElement('div');
        systemMessageDiv.className = 'message system-message';
        systemMessageDiv.textContent = message;
        messagesContainer.appendChild(systemMessageDiv);
    }
}

function sendMessage() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        displaySystemMessage('Connection lost. Please wait for reconnection or refresh the page.');
        return;
    }

    const message = userInput.value.trim();
    if (!message) return;

    // Get selected cells content
    let selected_cells_content = '';
    if (window.notebookFunctions && window.notebookFunctions.getSelectedCellsContent) {
        selected_cells_content = window.notebookFunctions.getSelectedCellsContent();
    }

    const fullMessage = selected_cells_content ? `Selected cells:\n${selected_cells_content}\n\nMessage: ${message}` : message;
    console.log('Sending message:', fullMessage);

    try {
        ws.send(JSON.stringify({
            type: 'user_input',
            selected_cells_content: selected_cells_content,
            user_message: message
        }));

        // Append user message to chat
        appendMessage({
            agent: 'User',
            content: fullMessage
        });

        // Clear input after sending
        userInput.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        displaySystemMessage('Failed to send message. Please try again.');
    }
}

function displayMessage(data) {
    // Handle notebook updates first
    if (data.type === "notebook_update") {
        console.log('Received notebook update:', data.content);
        if (window.notebookFunctions && window.notebookFunctions.displayNotebook) {
            try {
                // Save current editor states
                const currentEditorStates = new Map();
                if (window.notebookFunctions.editorManager) {
                    window.notebookFunctions.editorManager.editors.forEach((editor, index) => {
                        currentEditorStates.set(index, {
                            value: editor.getValue ? editor.getValue() : editor.value(),
                            cursor: editor.getCursor ? editor.getCursor() : null
                        });
                    });
                }

                // Display notebook with path
                const notebookPath = data.notebook_path || ('src/uploads/' + window.currentNotebook);
                window.notebookFunctions.displayNotebook(data.content, notebookPath);

                // Restore editor states for unchanged cells
                if (window.notebookFunctions.editorManager) {
                    window.notebookFunctions.editorManager.editors.forEach((editor, index) => {
                        const prevState = currentEditorStates.get(index);
                        if (prevState && editor) {
                            const currentValue = editor.getValue ? editor.getValue() : editor.value();
                            if (prevState.value === currentValue) {
                                if (editor.focus) {
                                    editor.focus();
                                }
                                if (prevState.cursor && editor.setCursor) {
                                    editor.setCursor(prevState.cursor);
                                }
                            }
                        }
                    });
                }
            } catch (error) {
                console.error('Error updating notebook:', error);
            }
        } else {
            console.warn('Notebook functions not available for update');
        }
        return;
    }

    // Handle clear history message
    if (data.agent === 'System' && data.content === 'Message history cleared.') {
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
        return;
    }

    // Skip other system messages
    if (data.agent === 'System') {
        return;
    }

    const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    const message = data.message || data.content || '';

    // For assistant messages, try to append to existing message if it exists
    if (data.agent === 'Assistant') {
        const isTool = message.includes('Tool message:');
        let assistantMessageDiv;
        
        // Check if the last message was a tool message
        const lastMessage = messagesContainer.lastElementChild;
        const lastWasTool = lastMessage?.classList.contains('tool-message');
        
        if (!isTool && !lastWasTool) {
            // Regular assistant message - try to append to last message
            assistantMessageDiv = messagesContainer.querySelector('.assistant-message:last-child');
        }
        
        if (assistantMessageDiv && !isTool && !lastWasTool) {
            // Get the content div and append the new message
            const contentDiv = assistantMessageDiv.querySelector('.message-content');
            const currentContent = contentDiv.getAttribute('data-raw-content') || '';
            const newContent = currentContent + message;
            contentDiv.setAttribute('data-raw-content', newContent);
            contentDiv.innerHTML = marked.parse(newContent);
        } else {
            // Create new assistant message div
            assistantMessageDiv = document.createElement('div');
            assistantMessageDiv.className = 'message assistant-message';
            if (isTool) assistantMessageDiv.classList.add('tool-message');
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.setAttribute('data-raw-content', message);
            contentDiv.innerHTML = marked.parse(message);
            
            assistantMessageDiv.appendChild(contentDiv);
            messagesContainer.appendChild(assistantMessageDiv);
        }
    } else if (data.agent === 'User') {
        // Create user message with container
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        
        const agentSpan = document.createElement('span');
        agentSpan.className = 'agent-name';
        agentSpan.textContent = 'You';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.setAttribute('data-raw-content', message);
        contentDiv.innerHTML = marked.parse(message);
        
        messageDiv.appendChild(agentSpan);
        messageDiv.appendChild(contentDiv);
        messagesContainer.appendChild(messageDiv);
    }

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

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

            handleUploadResponse(response);
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
        if (!window.notebookFunctions || !window.notebookFunctions.displayNotebook) {
            console.log('Notebook functions not ready yet, retrying in 100ms...');
            setTimeout(checkNotebookFunctions, 100);
            return;
        }
        
        console.log('Notebook functions available, proceeding with chat initialization');
        
        userInput = document.getElementById('user-input');
        messagesContainer = document.getElementById('messages-content');

        // Initialize WebSocket connection
        connectWebSocket();

        // Add event listeners
        document.getElementById('send-button').addEventListener('click', sendMessage);
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // Add clear history button event listener
        document.getElementById('clear-history-btn').addEventListener('click', clearHistory);

        // Add notebook control event listeners
        document.getElementById('add-cell-btn').addEventListener('click', downloadNotebook);
        document.getElementById('save-notebook-btn').addEventListener('click', () => {
            window.notebookFunctions.saveNotebook();
            // Ensure the watcher is active after save
            const currentNotebook = localStorage.getItem('currentNotebook');
            if (currentNotebook) {
                ws.send(JSON.stringify({
                    type: 'start_processing',
                    filename: currentNotebook,
                    auto_analyze: false
                }));
            }
        });

        // Initialize resizer
        initializeResizer();

        // Initialize file upload
        initializeFileUpload();
        
        console.log('Chat initialization complete');
    }
    
    // Start checking for notebook functions
    checkNotebookFunctions();
}

function appendMessage(messageData) {
    if (!messagesContainer) {
        messagesContainer = document.getElementById('messages-content');
        if (!messagesContainer) {
            console.error('Messages container not found');
            return;
        }
    }

    // Skip system messages
    if (messageData.agent === 'System') {
        return;
    }

    const content = messageData.content || '';

    // For assistant messages, try to append to existing message if it exists
    if (messageData.agent === 'Assistant') {
        let assistantMessageDiv = messagesContainer.querySelector('.assistant-message:last-child');
        
        if (assistantMessageDiv) {
            // Get the content div and append the new message
            const contentDiv = assistantMessageDiv.querySelector('.message-content');
            const currentContent = contentDiv.getAttribute('data-raw-content') || '';
            const newContent = currentContent + content;
            contentDiv.setAttribute('data-raw-content', newContent);
            contentDiv.innerHTML = marked.parse(newContent);
        } else {
            // Create new assistant message div
            assistantMessageDiv = document.createElement('div');
            assistantMessageDiv.className = 'message assistant-message';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.setAttribute('data-raw-content', content);
            contentDiv.innerHTML = marked.parse(content);
            
            assistantMessageDiv.appendChild(contentDiv);
            messagesContainer.appendChild(assistantMessageDiv);
        }
    } else if (messageData.agent === 'User') {
        let displayContent = content;
        // Replace cell content with a clear indication of selected cells
        displayContent = displayContent.replace(/(<(cell_[0-9]+_[a-zA-Z]+)>)([\s\S]*?)(<\/\2>)/g, 
            (match, openTag, cellId) => `[Selected Cell: ${cellId}]`
        );
        displayContent = displayContent.trim();

        // Create user message with container
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        
        const agentSpan = document.createElement('span');
        agentSpan.className = 'agent-name';
        agentSpan.textContent = 'You';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.setAttribute('data-raw-content', displayContent);
        contentDiv.innerHTML = marked.parse(displayContent);
        
        messageDiv.appendChild(agentSpan);
        messageDiv.appendChild(contentDiv);
        messagesContainer.appendChild(messageDiv);
    }

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Add the clear history function
function clearHistory() {
    // Clear the messages container
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
    }

    // Send clear history command to backend with correct format
    ws.send(JSON.stringify({
        type: 'user_input',
        user_message: 'clear_history',
        selected_cells_content: ''
    }));
}

// Handle file upload response
function handleUploadResponse(response) {
    if (response.ok) {
        response.json().then(data => {
            window.currentNotebook = data.filename;
            if (data.notebook_content) {
                const notebookPath = 'src/uploads/' + data.filename;
                window.notebookFunctions.displayNotebook(data.notebook_content, notebookPath);
            }
            // Start processing the notebook
            ws.send(JSON.stringify({
                type: 'start_processing',
                filename: data.filename
            }));
        });
    } else {
        console.error('Upload failed');
    }
}

// Add download notebook function
function downloadNotebook() {
    const currentNotebook = window.currentNotebook;
    if (!currentNotebook) {
        console.error('No notebook is currently loaded');
        return;
    }

    // Save the notebook first to ensure latest changes are downloaded
    window.notebookFunctions.saveNotebook();

    // Create download link
    const downloadUrl = `/download/${currentNotebook}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = currentNotebook;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}