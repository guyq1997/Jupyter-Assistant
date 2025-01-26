import { sendWebSocketMessage } from './websocket.js';

export function handleNotebookUpdate(data) {
    if (data.type !== "notebook_update") return;

    console.log('Received notebook update:', data.content);
    if (!window.notebookFunctions?.displayNotebook) {
        console.warn('Notebook functions not available for update');
        return;
    }

    try {
        const currentEditorStates = saveEditorStates();
        const notebookPath = data.notebook_path || ('src/uploads/' + window.currentNotebook);
        window.notebookFunctions.displayNotebook(data.content, notebookPath);
        restoreEditorStates(currentEditorStates);
    } catch (error) {
        console.error('Error updating notebook:', error);
    }
}

function saveEditorStates() {
    const currentEditorStates = new Map();
    if (window.notebookFunctions?.editorManager?.editors) {
        window.notebookFunctions.editorManager.editors.forEach((editor, index) => {
            currentEditorStates.set(index, {
                value: editor.getValue ? editor.getValue() : editor.value(),
                cursor: editor.getCursor ? editor.getCursor() : null
            });
        });
    }
    return currentEditorStates;
}

function restoreEditorStates(currentEditorStates) {
    if (window.notebookFunctions?.editorManager?.editors) {
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
}

export function handleUploadSuccess(data) {
    window.currentNotebook = data.filename;
    if (data.notebook_content) {
        const notebookPath = 'src/uploads/' + data.filename;
        window.notebookFunctions.displayNotebook(data.notebook_content, notebookPath);
    }
    
    sendWebSocketMessage({
        type: 'start_processing',
        filename: data.filename
    });
}

export function getSelectedCellsContent() {
    if (window.notebookFunctions?.getSelectedCellsContent) {
        return window.notebookFunctions.getSelectedCellsContent();
    }
    return '';
} 