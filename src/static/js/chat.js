'use strict';
var userInput = null;
let ws;
let waitingForInput = false;
let messagesContainer;

function connectWebSocket() {
    ws = new WebSocket(`ws://${window.location.host}/ws`);
    
    ws.onopen = function() {
        console.log('WebSocket connected');
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
        const data = JSON.parse(event.data);
        displayMessage(data);
    };

    ws.onclose = function() {
        console.log('WebSocket connection closed. Attempting to reconnect...');
        setTimeout(() => {
            connectWebSocket();
        }, 1000);
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
        `${selectedCellsContent}\n\n${message}` : message;
    const selected_cells_content = selectedCellsContent ? 
    `#Inputs\n\n##Current Notebook Cells\nHere are Jupyter Notebook cells I am looking at:\n\n${selectedCellsContent}\n\n` : '';
    console.log('Sending message:', fullMessage);

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

                // Update notebook
                window.notebookFunctions.displayNotebook(data.content);

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

    // Skip system messages
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

            const result = await response.json();
            if (response.ok) {
                if (result.notebook_content) {
                    window.notebookFunctions.displayNotebook(result.notebook_content);
                }
                
                // Store the filename both in memory and localStorage
                window.lastLoadedNotebook = result.filename;
                localStorage.setItem('currentNotebook', result.filename);
                
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

        // Add notebook control event listeners
        document.getElementById('add-cell-btn').addEventListener('click', () => window.notebookFunctions.addCell());
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