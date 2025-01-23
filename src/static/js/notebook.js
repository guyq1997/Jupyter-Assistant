import { EDITOR_CONFIG } from './notebook/config.js';
import { EditorManager } from './notebook/editor.js';
import { CellManager } from './notebook/cell.js';
import { SelectionManager } from './notebook/selection.js';
import { NotebookUI } from './notebook/ui.js';

class NotebookManager {
    constructor() {
        this.notebook = null;
        this.editorManager = new EditorManager();
        this.cellManager = new CellManager();
        this.selectionManager = new SelectionManager();
        this.ui = new NotebookUI();
        
        // Initialize notebook functions for global access
        this.initializeNotebookFunctions();
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
            editorManager: this.editorManager // Expose editorManager for external updates
        };
    }

    // Display notebook
    displayNotebook(notebook) {
        if (!notebook || !notebook.cells) {
            console.error('Invalid notebook data received');
            return;
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
                    currentState.editors.set(index, {
                        value: editor.getValue ? editor.getValue() : editor.value(),
                        cursor: editor.getCursor ? editor.getCursor() : null
                    });
                }
            });
        }

        this.notebook = notebook;
        this.cellManager.setNotebook(notebook);
        this.selectionManager.setNotebook(notebook);
        
        // Clear existing content
        this.ui.clearNotebookContent();
        this.editorManager.clear();
        this.selectionManager.clear();
        
        const notebookDiv = document.getElementById('notebook-content');
        
        // Create cells
        notebook.cells.forEach((cell, index) => {
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
                if (editor.setValue) {
                    editor.setValue(prevState.value);
                    if (prevState.cursor && editor.setCursor) {
                        editor.setCursor(prevState.cursor);
                    }
                } else if (editor.value) {
                    editor.value(prevState.value);
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
        });
        
        // Layout editors after all cells are created
        this.editorManager.layoutAll();

        // Restore selections
        this.selectionManager.selectedCells = currentState.selections;
        this.selectionManager.updateCellSelection();
    }

    // Add cell
    addCell(type = 'code', index = null) {
        if (!this.notebook) return;
        
        const insertIndex = index !== null ? index : this.notebook.cells.length;
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
        if (!this.notebook) return;
        
        // Update all cell sources from editors
        this.notebook.cells.forEach((cell, index) => {
            cell.source = this.editorManager.getCellContent(cell, index);
        });
        
        // Send to server
        ws.send(JSON.stringify({
            type: 'save_notebook',
            content: this.notebook
        }));
        
        this.ui.markAsSaved();
    }
}

// Create and export notebook manager instance
const notebookManager = new NotebookManager(); 