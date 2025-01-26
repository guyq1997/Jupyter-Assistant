let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;

function getReconnectDelay() {
    return Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 30000);
}

export function connectWebSocket(onMessage, onSystemMessage) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return;
    }

    try {
        ws = new WebSocket(`ws://${window.location.host}/ws`);
        
        ws.onopen = function() {
            console.log('WebSocket connected');
            reconnectAttempts = 0;
            
            const savedNotebook = localStorage.getItem('currentNotebook');
            if (savedNotebook && window.notebookFunctions) {
                console.log('Re-establishing notebook connection for:', savedNotebook);
                sendWebSocketMessage({
                    type: 'start_processing',
                    filename: savedNotebook,
                    auto_analyze: false
                });
            }
        };
        
        ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                onMessage(data);
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
                    connectWebSocket(onMessage, onSystemMessage);
                }, delay);
            } else {
                console.error('Max reconnection attempts reached. Please refresh the page.');
                onSystemMessage('Connection lost. Please refresh the page to reconnect.');
            }
        };

        ws.onerror = function(error) {
            console.error('WebSocket error:', error);
        };
    } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            setTimeout(() => connectWebSocket(onMessage, onSystemMessage), getReconnectDelay());
        }
    }
}

export function sendWebSocketMessage(message) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.error('WebSocket is not connected');
        return false;
    }

    try {
        ws.send(JSON.stringify(message));
        return true;
    } catch (error) {
        console.error('Error sending message:', error);
        return false;
    }
}

export function isWebSocketConnected() {
    return ws && ws.readyState === WebSocket.OPEN;
} 