import { NotebookUIBase } from '../notebook/NotebookUIBase.js';

export class BatchConfirmationManager extends NotebookUIBase {
    constructor() {
        super();
        this.isProcessingChanges = false;
    }

    createBatchConfirmationUI() {
        console.log('BatchConfirmationManager: Creating batch confirmation UI');
        const container = document.createElement('div');
        container.className = 'batch-confirmation';
        container.id = 'batch-confirmation';

        const message = document.createElement('div');
        message.className = 'batch-message';
        
        const changes = this.createChangesSummary();
        message.textContent = `Pending changes: ${changes.join(', ')}`;
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'batch-confirmation-buttons';
        
        const confirmButton = document.createElement('button');
        confirmButton.className = 'confirm-all-changes';
        confirmButton.textContent = 'Accept All Changes';
        confirmButton.onclick = () => this.confirmAllChanges();
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'cancel-all-changes';
        cancelButton.textContent = 'Cancel All Changes';
        cancelButton.onclick = () => this.cancelAllChanges();
        
        buttonContainer.appendChild(confirmButton);
        buttonContainer.appendChild(cancelButton);
        
        container.appendChild(message);
        container.appendChild(buttonContainer);
        
        return container;
    }

    createChangesSummary() {
        const changes = [];
        if (this.pendingChanges?.size > 0) {
            changes.push(`${this.pendingChanges.size} modified cell${this.pendingChanges.size > 1 ? 's' : ''}`);
        }
        if (this.pendingDeletions?.size > 0) {
            changes.push(`${this.pendingDeletions.size} deleted cell${this.pendingDeletions.size > 1 ? 's' : ''}`);
        }
        if (this.pendingAdditions?.size > 0) {
            changes.push(`${this.pendingAdditions.size} new cell${this.pendingAdditions.size > 1 ? 's' : ''}`);
        }
        return changes;
    }

    showBatchConfirmationUI() {
        console.log('BatchConfirmationManager: Showing batch confirmation UI');
        this.removeExistingBatchUI();

        if (!this.hasPendingChanges()) {
            console.log('BatchConfirmationManager: No changes to show UI for');
            return;
        }

        const batchUI = this.createBatchConfirmationUI();
        const notebookHeader = document.querySelector('.notebook-header');
        if (notebookHeader) {
            console.log('BatchConfirmationManager: Appending batch confirmation UI to header');
            notebookHeader.appendChild(batchUI);
        } else {
            console.warn('BatchConfirmationManager: Could not find notebook header');
        }
    }

    removeExistingBatchUI() {
        const existingUI = document.getElementById('batch-confirmation');
        if (existingUI) {
            console.log('BatchConfirmationManager: Removing existing batch confirmation UI');
            existingUI.remove();
        }
    }

    confirmAllChanges() {
        console.log('BatchConfirmationManager: confirmAllChanges called');
        
        if (!this.validateEditorManager()) return;

        // Handle deletions
        const deletionsArray = Array.from(this.pendingDeletions || []).sort((a, b) => b - a);
        console.log('BatchConfirmationManager: Processing deletions:', deletionsArray);
        deletionsArray.forEach(index => {
            if (window.notebookFunctions?.deleteCell) {
                window.notebookFunctions.deleteCell(index);
            }
        });

        // Handle content changes
        const changesArray = Array.from(this.pendingChanges || []);
        console.log('BatchConfirmationManager: Processing content changes:', changesArray);
        changesArray.forEach(([index, change]) => {
            if (window.notebookFunctions?.updateCellContent) {
                window.notebookFunctions.updateCellContent(index, change.newContent);
            }
        });

        this.clearAllChanges();
        this.refreshNotebook();
    }

    cancelAllChanges() {
        if (!this.validateEditorManager()) return;

        // Remove added cells
        const additionsArray = Array.from(this.pendingAdditions || []).sort((a, b) => b - a);
        additionsArray.forEach(index => {
            this.editorManager.notebook.cells.splice(index, 1);
        });

        this.clearAllChanges();
        this.refreshNotebook();
    }

    clearAllChanges() {
        if (this.clearPendingChanges) {
            this.clearPendingChanges();
        }

        const confirmationUIs = document.querySelectorAll('.change-confirmation');
        confirmationUIs.forEach(ui => ui.remove());
        this.removeExistingBatchUI();
    }

    refreshNotebook() {
        if (window.notebookFunctions?.displayNotebook) {
            console.log('BatchConfirmationManager: Refreshing notebook display');
            window.notebookFunctions.displayNotebook(this.editorManager.notebook);
        }
    }

    handleProposedChanges(changes) {
        console.log('BatchConfirmationManager: handleProposedChanges called');
        
        if (!this.isProcessingChanges) {
            this.isProcessingChanges = true;
        }

        changes.forEach(change => {
            if (this.addPendingChange && this.addPendingDeletion && this.addPendingAddition) {
                switch (change.type) {
                    case 'update':
                        this.addPendingChange(change.index, change.old_content, change.new_content);
                        break;
                    case 'delete':
                        this.addPendingDeletion(change.index);
                        break;
                    case 'add':
                        this.addPendingAddition(change.index, change.new_content, change.cell_type);
                        break;
                }
            }
        });
    }

    finalizeChanges() {
        console.log('BatchConfirmationManager: finalizeChanges called');
        
        if (this.isProcessingChanges) {
            this.isProcessingChanges = false;
            if (this.hasPendingChanges()) {
                this.showBatchConfirmationUI();
            }
        }
    }
} 