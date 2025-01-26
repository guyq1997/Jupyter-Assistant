let messagesContainer = null;
let userInput = null;

export function initializeMessageHandler(container, input) {
    messagesContainer = container;
    userInput = input;
}

export function displaySystemMessage(message) {
    if (!messagesContainer) return;
    
    const systemMessageDiv = document.createElement('div');
    systemMessageDiv.className = 'message system-message';
    systemMessageDiv.textContent = message;
    messagesContainer.appendChild(systemMessageDiv);
    scrollToBottom();
}

export function displayMessage(data) {
    if (data.agent === 'System') {
        handleSystemMessage(data);
        return;
    }

    const message = data.message || data.content || '';
    
    if (data.agent === 'Assistant') {
        appendAssistantMessage(message);
    } else if (data.agent === 'User') {
        appendUserMessage(message);
    }

    if (data.waiting_input && userInput) {
        userInput.disabled = false;
        userInput.focus();
    }
}

function handleSystemMessage(data) {
    if (data.content === 'Message history cleared.') {
        clearMessages();
        return;
    }

    try {
        const jsonContent = JSON.parse(data.content);
        if (jsonContent.type === "process_query_complete" && 
            window.notebookFunctions?.finalizeProposedChanges) {
            window.notebookFunctions.finalizeProposedChanges();
        }
    } catch (e) {
        if (data.content === 'process_query_complete' && 
            window.notebookFunctions?.finalizeProposedChanges) {
            window.notebookFunctions.finalizeProposedChanges();
        }
    }
}

function appendAssistantMessage(message) {
    if (!messagesContainer) return;

    const isTool = message.includes('Tool message:');
    const lastMessage = messagesContainer.lastElementChild;
    const lastWasTool = lastMessage?.classList.contains('tool-message');
    
    let assistantMessageDiv;
    
    if (!isTool && !lastWasTool) {
        assistantMessageDiv = messagesContainer.querySelector('.assistant-message:last-child');
    }
    
    if (assistantMessageDiv && !isTool && !lastWasTool) {
        const contentDiv = assistantMessageDiv.querySelector('.message-content');
        const currentContent = contentDiv.getAttribute('data-raw-content') || '';
        const newContent = currentContent + message;
        contentDiv.setAttribute('data-raw-content', newContent);
        contentDiv.innerHTML = marked.parse(newContent);
    } else {
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
    
    scrollToBottom();
}

function appendUserMessage(content) {
    if (!messagesContainer) return;

    let displayContent = content.replace(
        /(<(cell_[0-9]+_[a-zA-Z]+)>)([\s\S]*?)(<\/\2>)/g,
        (match, openTag, cellId) => `[Selected Cell: ${cellId}]`
    ).trim();

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
    
    scrollToBottom();
}

export function clearMessages() {
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
    }
}

function scrollToBottom() {
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
} 