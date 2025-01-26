import { CellManager } from '../managers/cell.js';
import { DiffUIManager } from '../managers/DiffUIManager.js';
import { BatchConfirmationManager } from '../managers/BatchConfirmationManager.js';

export class NotebookUI {
    constructor() {
        this.cellManager = new CellManager();
        this.diffManager = new DiffUIManager();
        this.batchManager = new BatchConfirmationManager();
        
        // Connect managers
        this.setupManagerConnections();
    }

    setEditorManager(editorManager) {
        this.cellManager.setEditorManager(editorManager);
        this.diffManager.setEditorManager(editorManager);
        this.batchManager.setEditorManager(editorManager);
    }

    setupManagerConnections() {
        // Connect DiffManager to CellManager
        this.diffManager.refreshCell = (index) => this.cellManager.refreshCell(index);
        this.cellManager.createDiffView = (index) => this.diffManager.createDiffView(index);
        
        // Share pending changes state
        Object.defineProperties(this.cellManager, {
            'pendingChanges': {
                get: () => this.diffManager.pendingChanges
            },
            'pendingDeletions': {
                get: () => this.diffManager.pendingDeletions
            },
            'pendingAdditions': {
                get: () => this.diffManager.pendingAdditions
            }
        });

        // Connect BatchManager to DiffManager
        this.batchManager.hasPendingChanges = () => this.diffManager.hasPendingChanges();
        this.batchManager.clearPendingChanges = () => this.diffManager.clearPendingChanges();
        this.batchManager.addPendingChange = (index, oldContent, newContent) => 
            this.diffManager.addPendingChange(index, oldContent, newContent);
        this.batchManager.addPendingDeletion = (index) => 
            this.diffManager.addPendingDeletion(index);
        this.batchManager.addPendingAddition = (index, content, cellType) => 
            this.diffManager.addPendingAddition(index, content, cellType);

        Object.defineProperties(this.batchManager, {
            'pendingChanges': {
                get: () => this.diffManager.pendingChanges
            },
            'pendingDeletions': {
                get: () => this.diffManager.pendingDeletions
            },
            'pendingAdditions': {
                get: () => this.diffManager.pendingAdditions
            }
        });
    }

    // Public API methods
    createCellContainer(index, toolbar, editor, selectArea) {
        return this.cellManager.createCellContainer(index, toolbar, editor, selectArea);
    }

    createSelectArea(index, isSelected, onSelect) {
        return this.cellManager.createSelectArea(index, isSelected, onSelect);
    }

    refreshCell(index) {
        this.cellManager.refreshCell(index);
    }

    clearNotebookContent() {
        this.cellManager.clearNotebookContent();
    }

    handleProposedChanges(changes) {
        this.batchManager.handleProposedChanges(changes);
    }

    finalizeChanges() {
        this.batchManager.finalizeChanges();
    }

    markAsSaved() {
        this.diffManager.markAsSaved();
    }

    markAsUnsaved() {
        this.diffManager.markAsUnsaved();
    }
} 