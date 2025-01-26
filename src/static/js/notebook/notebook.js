import { EDITOR_CONFIG } from '../core/config.js';
import { EditorManager } from '../managers/editor.js';
import { CellManager } from '../managers/cell.js';
import { SelectionManager } from '../managers/selection.js';
import { NotebookUI } from './NotebookUI.js';

class NotebookManager {
    constructor() {
        this.notebook = null;
        this.currentNotebookPath = null;
        this.editorManager = new EditorManager();
        this.cellManager = new CellManager();
        this.selectionManager = new SelectionManager();
        this.ui = new NotebookUI();
        
        // Set editor manager reference in UI
        this.ui.setEditorManager(this.editorManager);
        
        // Initialize notebook functions for global access
        this.initializeNotebookFunctions();
        
        // Initialize WebSocket connection
        this.initializeWebSocket();
    }

    // Initialize notebook functions
    initializeNotebookFunctions() {
        window.notebookFunctions = {
            displayNotebook: this.displayNotebook.bind(this),
            addCell: (type) => this.addCell(type),
            deleteCell: (index) => this.deleteCell(index),
            moveCell: (index, direction) => this.moveCell(index, direction),
            changeCellType: (index, newType) => this.changeCellType(index, newType),
            saveNotebook: () => this.saveNotebook(),
            removeSelectedCell: (index) => this.selectionManager.removeSelectedCell(index),
            getSelectedCellsContent: () => this.selectionManager.getSelectedCellsContent(this.notebook),
            editorManager: this.editorManager, // Expose editorManager for external updates
            // Add new functions for handling changes
            proposeChange: (index, newContent) => this.proposeChange(index, newContent),
            confirmChange: (index) => this.ui.confirmChange(index),
            cancelChange: (index) => this.ui.cancelChange(index),
            updateCellContent: (index, content) => this.updateCellContent(index, content),
            // Add finalizeProposedChanges
            finalizeProposedChanges: () => this.finalizeProposedChanges()
        };
    }

    // Initialize WebSocket connection
    initializeWebSocket() {
        // Create WebSocket connection
        this.ws = new WebSocket('ws://localhost:8765/ws');
        
        this.ws.onopen = () => {
            console.log('WebSocket connection established');
            this.setupProposedChangesHandler();
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket connection closed');
        };
    }

    // Setup handler for proposed changes
    setupProposedChangesHandler() {
        if (!this.ws) return;
        
        const originalOnMessage = this.ws.onmessage;
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'propose_changes') {
                this.handleProposedChanges(data.changes, data.notebook_path);
            } else if (originalOnMessage) {
                originalOnMessage(event);
            }
        };
    }

    // Normalize path for comparison
    normalizePath(path) {
        // Convert backslashes to forward slashes
        path = path.replace(/\\/g, '/');
        // Remove any leading directory structure up to 'src/uploads'
        const match = path.match(/(?:.*\/)?src\/uploads\/(.*)$/);
        return match ? `src/uploads/${match[1]}` : path;
    }

    // Handle proposed changes from the agent
    handleProposedChanges(changes, notebookPath) {
        console.log('NotebookManager: Handling proposed changes:', changes);
        console.log('NotebookManager: Current notebook path:', this.currentNotebookPath);
        console.log('NotebookManager: Received notebook path:', notebookPath);
        
        // Normalize both paths for comparison
        const normalizedCurrent = this.normalizePath(this.currentNotebookPath);
        const normalizedReceived = this.normalizePath(notebookPath);
        
        console.log('NotebookManager: Comparing paths:', {
            normalizedCurrent,
            normalizedReceived
        });

        if (normalizedCurrent !== normalizedReceived) {
            console.warn('NotebookManager: Notebook path mismatch:', {
                current: normalizedCurrent,
                received: normalizedReceived
            });
            return;
        }

        // Process all changes at once using the UI's handleProposedChanges method
        console.log('NotebookManager: Forwarding changes to UI');
        this.ui.handleProposedChanges(changes);
    }

    // Add new method to finalize changes
    finalizeProposedChanges() {
        console.log('NotebookManager: finalizeProposedChanges called');
        if (!this.ui) {
            console.warn('NotebookManager: UI not initialized');
            return;
        }
        this.ui.finalizeChanges();
    }

    // Show notification about pending changes
    showPendingChangesNotification() {
        const notification = document.createElement('div');
        notification.className = 'changes-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <p>The AI has proposed some changes to your notebook.</p>
                <p>Please review and confirm/cancel each change.</p>
            </div>
        `;
        
        // Add to the notebook header
        const notebookHeader = document.querySelector('.notebook-header');
        if (notebookHeader) {
            const existingNotification = notebookHeader.querySelector('.changes-notification');
            if (existingNotification) {
                existingNotification.remove();
            }
            notebookHeader.appendChild(notification);
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                notification.classList.add('fade-out');
                setTimeout(() => notification.remove(), 500);
            }, 5000);
        }
    }

    // Propose a change to a cell
    proposeChange(index, newContent) {
        if (!this.notebook || index >= this.notebook.cells.length) return;
        
        const cell = this.notebook.cells[index];
        const oldContent = cell.source;
        
        // If content is the same, no need to propose a change
        if (oldContent === newContent) return;
        
        // Add the pending change
        this.ui.addPendingChange(index, oldContent, newContent);
    }

    // Display notebook
    displayNotebook(notebook, notebookPath = null) {
        if (!notebook || !notebook.cells) {
            console.error('Invalid notebook data received');
            return;
        }

        if (notebookPath) {
            this.currentNotebookPath = notebookPath;
        }

        // Save current editor states and selections
        const currentState = {
            editors: new Map(),
            selections: new Set(this.selectionManager.selectedCells)
        };
        
        if (this.notebook) {
            this.notebook.cells.forEach((cell, index) => {
                const editor = this.editorManager.editors.get(index);
                if (editor) {
                    let value;
                    try {
                        // Handle different types of editors
                        if (typeof editor.getValue === 'function') {
                            value = editor.getValue();
                        } else if (typeof editor.value === 'function') {
                            value = editor.value();
                        } else if (editor.codemirror) {
                            value = editor.codemirror.getValue();
                        } else {
                            console.log('Editor type not recognized:', editor);
                            return;
                        }
                        
                        let cursor = null;
                        if (typeof editor.getCursor === 'function') {
                            cursor = editor.getCursor();
                        } else if (editor.codemirror) {
                            cursor = editor.codemirror.getCursor();
                        }
                        
                        currentState.editors.set(index, { value, cursor });
                    } catch (error) {
                        console.error('Error saving editor state:', error);
                    }
                }
            });
        }

        this.notebook = notebook;
        this.cellManager.setNotebook(notebook);
        this.selectionManager.setNotebook(notebook);
        this.editorManager.setNotebook(notebook);
        
        // Clear existing content
        this.ui.clearNotebookContent();
        this.editorManager.clear();
        this.selectionManager.clear();
        
        const notebookDiv = document.getElementById('notebook-content');
        if (!notebookDiv) {
            console.error('Notebook content div not found');
            return;
        }
        
        // Create cells
        notebook.cells.forEach((cell, index) => {
            try {
                // Create cell toolbar
                const toolbar = this.cellManager.createCellToolbar(cell, index, {
                    onTypeChange: (index, type) => this.changeCellType(index, type),
                    onAddCell: (index) => this.addCell('code', index),
                    onDeleteCell: (index) => this.deleteCell(index)
                });
                
                // Create editor
                const editor = this.editorManager.createEditor(cell, index, (newContent) => {
                    cell.source = newContent;
                    this.ui.markAsUnsaved();
                });

                // Restore editor state if content matches
                const prevState = currentState.editors.get(index);
                if (prevState && prevState.value === cell.source) {
                    try {
                        if (typeof editor.setValue === 'function') {
                            editor.setValue(prevState.value);
                            if (prevState.cursor && typeof editor.setCursor === 'function') {
                                editor.setCursor(prevState.cursor);
                            }
                        } else if (typeof editor.value === 'function') {
                            editor.value(prevState.value);
                        } else if (editor.codemirror) {
                            editor.codemirror.setValue(prevState.value);
                            if (prevState.cursor) {
                                editor.codemirror.setCursor(prevState.cursor);
                            }
                        }
                    } catch (error) {
                        console.error('Error restoring editor state:', error);
                    }
                }
                
                // Create select area
                const selectArea = this.ui.createSelectArea(
                    index,
                    currentState.selections.has(index),
                    (index, shiftKey) => {
                        this.selectionManager.toggleCellSelection(index, shiftKey);
                        this.selectionManager.updateCellSelection();
                    }
                );
                
                // Create cell container and add to notebook
                const cellContainer = this.ui.createCellContainer(index, toolbar, editor, selectArea);
                notebookDiv.appendChild(cellContainer);
            } catch (error) {
                console.error(`Error creating cell ${index}:`, error);
            }
        });
        
        // Layout editors after all cells are created
        this.editorManager.layoutAll();

        // Restore selections
        this.selectionManager.selectedCells = currentState.selections;
        this.selectionManager.updateCellSelection();
    }

    // Add cell
    addCell(type = 'code', index = null) {
        console.log('NotebookManager: Adding cell', { type, index });
        if (!this.notebook) return;
        
        const insertIndex = index !== null ? index : this.notebook.cells.length;
        console.log('NotebookManager: Insert index:', insertIndex);
        this.cellManager.addCellAt(insertIndex, type);
        this.displayNotebook(this.notebook);
        this.ui.markAsUnsaved();
    }

    // Delete cell
    deleteCell(index) {
        if (!this.notebook) return;
        
        this.cellManager.deleteCell(index);
        this.displayNotebook(this.notebook);
        this.ui.markAsUnsaved();
    }

    // Move cell
    moveCell(index, direction) {
        if (!this.notebook) return;
        
        this.cellManager.moveCell(index, direction);
        this.displayNotebook(this.notebook);
        this.ui.markAsUnsaved();
    }

    // Change cell type
    changeCellType(index, newType) {
        if (!this.notebook) return;
        
        this.cellManager.changeCellType(index, newType);
        this.displayNotebook(this.notebook);
        this.ui.markAsUnsaved();
    }

    // Save notebook
    saveNotebook() {
        if (!this.notebook || !this.currentNotebookPath) {
            console.warn('Cannot save: no notebook or path');
            return;
        }
        
        // Check if there are any pending changes
        if (this.ui.diffManager.hasPendingChanges()) {
            console.warn('Cannot save: pending changes exist');
            const notification = document.createElement('div');
            notification.className = 'error-notification';
            notification.textContent = 'Please confirm or cancel all pending changes before saving.';
            
            const notebookHeader = document.querySelector('.notebook-header');
            if (notebookHeader) {
                notebookHeader.appendChild(notification);
                setTimeout(() => notification.remove(), 3000);
            }
            return;
        }
        
        console.log('Saving notebook...');
        // Update all cell sources from editors
        this.notebook.cells.forEach((cell, index) => {
            const content = this.editorManager.getCellContent(cell, index);
            if (content !== undefined) {
                cell.source = content;
            }
        });
        
        // Send to server with notebook path
        this.ws.send(JSON.stringify({
            type: 'save_notebook',
            content: this.notebook,
            notebook_path: this.currentNotebookPath
        }));
        
        this.ui.markAsSaved();
    }

    // Update cell content
    updateCellContent(index, content) {
        if (!this.notebook || !this.notebook.cells || !this.notebook.cells[index]) {
            console.error('Cannot update cell content: invalid notebook or cell index');
            return;
        }
        
        // Update the cell source
        this.notebook.cells[index].source = content;
        
        // Mark notebook as unsaved
        this.ui.markAsUnsaved();
    }
}

// Create and export notebook manager instance
const notebookManager = new NotebookManager(); 