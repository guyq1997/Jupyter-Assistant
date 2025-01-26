export class NotebookUI {
    constructor() {
        this.hasUnsavedChanges = false;
        this.pendingChanges = new Map(); // Map<cellIndex, {oldContent, newContent}>
        this.pendingDeletions = new Set(); // Set of cell indices pending deletion
        this.pendingAdditions = new Set(); // Set of cell indices that are newly added
        this.editorManager = null; // Will be set by NotebookManager
        this.setupWindowEvents();
        this.isProcessingChanges = false; // New flag to track if we're still processing changes
    }

    // Set editor manager reference
    setEditorManager(editorManager) {
        this.editorManager = editorManager;
    }

    // Setup window events
    setupWindowEvents() {
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
    }

    // Update save indicator
    updateSaveIndicator() {
        const saveButton = document.getElementById('save-notebook-btn');
        if (!saveButton) return;

        if (this.hasUnsavedChanges) {
            saveButton.classList.add('unsaved');
            saveButton.textContent = 'Save Notebook*';
        } else {
            saveButton.classList.remove('unsaved');
            saveButton.textContent = 'Save Notebook';
        }
    }

    // Mark changes as saved
    markAsSaved() {
        this.hasUnsavedChanges = false;
        this.updateSaveIndicator();
    }

    // Mark changes as unsaved
    markAsUnsaved() {
        this.hasUnsavedChanges = true;
        this.updateSaveIndicator();
    }

    // Create cell container
    createCellContainer(index, toolbar, editor, selectArea) {
        console.log('NotebookUI: createCellContainer called for index:', index);
        console.log('NotebookUI: Cell data:', this.editorManager?.notebook?.cells?.[index]);
        
        const cellDiv = document.createElement('div');
        cellDiv.className = 'notebook-cell';
        cellDiv.dataset.cellIndex = index;
        
        // Get cell type from notebook data
        const cellData = this.editorManager?.notebook?.cells?.[index];
        const cellType = cellData?.cell_type || 'code';
        console.log('NotebookUI: Cell type:', cellType);
        
        // Add cell type class
        cellDiv.classList.add(cellType === 'markdown' ? 'markdown-cell' : 'code-cell');
        console.log('NotebookUI: Added cell class:', cellType === 'markdown' ? 'markdown-cell' : 'code-cell');
        
        // Add pending-deletion class if applicable
        if (this.pendingDeletions.has(index)) {
            console.log('NotebookUI: Adding pending-deletion class for cell:', index);
            cellDiv.classList.add('pending-deletion');
        }

        // Add pending-addition class if applicable
        if (this.pendingAdditions.has(index)) {
            console.log('NotebookUI: Adding pending-addition class for cell:', index);
            cellDiv.classList.add('pending-addition');
            console.log('NotebookUI: Cell classes after adding pending-addition:', cellDiv.className);
        }
        
        const cellContentWrapper = document.createElement('div');
        cellContentWrapper.className = 'cell-content-wrapper';
        
        // Always append toolbar, let CSS control visibility
        if (toolbar) cellContentWrapper.appendChild(toolbar);
        
        // If this is a pending addition or has pending changes, show the diff view
        if (this.pendingAdditions.has(index) || this.pendingChanges.has(index)) {
            const diffView = this.createDiffView(index);
            if (diffView) {
                cellContentWrapper.appendChild(diffView);
            }
        } else {
            // For normal display
            if (editor instanceof Node) {
                cellContentWrapper.appendChild(editor);
            }
        }
        
        cellDiv.appendChild(cellContentWrapper);
        if (selectArea) cellDiv.appendChild(selectArea);
        
        return cellDiv;
    }

    // Create select area for cell
    createSelectArea(index, isSelected, onSelect) {
        const selectArea = document.createElement('div');
        selectArea.className = 'cell-select-area';
        selectArea.innerHTML = isSelected ? '☒' : '☐';
        selectArea.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect(index, e.shiftKey);
        };
        return selectArea;
    }

    // Create diff view for pending changes
    createDiffView(index) {
        console.log('NotebookUI: Creating diff view for cell:', index);
        const changes = this.pendingChanges.get(index);
        if (!changes) return null;

        const diffView = document.createElement('div');
        diffView.className = 'diff-view';
        
        // Get cell type
        const cellData = this.editorManager?.notebook?.cells?.[index];
        const cellType = cellData?.cell_type || 'code';
        console.log('NotebookUI: Diff view for cell type:', cellType);
        
        // Show deleted content with red background
        if (changes.oldContent && !this.pendingAdditions.has(index)) {
            const deletedContent = document.createElement('pre');
            deletedContent.className = 'deleted-content';
            deletedContent.textContent = changes.oldContent;
            diffView.appendChild(deletedContent);
        }
        
        // Show new content with green background
        if (changes.newContent) {
            console.log('NotebookUI: Adding new content to diff view');
            const newContent = document.createElement('pre');
            newContent.className = 'new-content';
            
            // For markdown cells, render the markdown and add special class
            if (cellType === 'markdown') {
                console.log('NotebookUI: Rendering markdown content in diff view');
                newContent.innerHTML = marked.parse(changes.newContent);
                newContent.classList.add('markdown-preview');
                // Add special class for markdown diff
                diffView.classList.add('markdown-diff-view');
            } else {
                newContent.textContent = changes.newContent;
            }
            
            // Add pending addition class if this is a new cell
            if (this.pendingAdditions.has(index)) {
                console.log('NotebookUI: Adding pending-addition class to diff view content');
                newContent.classList.add('pending-addition-content');
            }
            
            diffView.appendChild(newContent);
        }
        
        return diffView;
    }

    // Create batch confirmation UI
    createBatchConfirmationUI() {
        console.log('NotebookUI: Creating batch confirmation UI');
        const container = document.createElement('div');
        container.className = 'batch-confirmation';
        container.id = 'batch-confirmation';

        const message = document.createElement('div');
        message.className = 'batch-message';
        
        // Create detailed message about changes
        const changes = [];
        if (this.pendingChanges.size > 0) {
            changes.push(`${this.pendingChanges.size} modified cell${this.pendingChanges.size > 1 ? 's' : ''}`);
        }
        if (this.pendingDeletions.size > 0) {
            changes.push(`${this.pendingDeletions.size} deleted cell${this.pendingDeletions.size > 1 ? 's' : ''}`);
        }
        if (this.pendingAdditions.size > 0) {
            changes.push(`${this.pendingAdditions.size} new cell${this.pendingAdditions.size > 1 ? 's' : ''}`);
        }
        
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

    // Show batch confirmation UI
    showBatchConfirmationUI() {
        console.log('NotebookUI: Showing batch confirmation UI');
        // Remove any existing batch confirmation UI
        const existingUI = document.getElementById('batch-confirmation');
        if (existingUI) {
            console.log('NotebookUI: Removing existing batch confirmation UI');
            existingUI.remove();
        }

        if (this.pendingChanges.size === 0 && this.pendingDeletions.size === 0 && this.pendingAdditions.size === 0) {
            console.log('NotebookUI: No changes to show UI for');
            return;
        }

        const batchUI = this.createBatchConfirmationUI();
        const notebookHeader = document.querySelector('.notebook-header');
        if (notebookHeader) {
            console.log('NotebookUI: Appending batch confirmation UI to header');
            notebookHeader.appendChild(batchUI);
        } else {
            console.warn('NotebookUI: Could not find notebook header');
        }
    }

    // Confirm all changes at once
    confirmAllChanges() {
        console.log('NotebookUI: confirmAllChanges called');
        console.log('NotebookUI: Current state:', {
            pendingChanges: new Map(this.pendingChanges),
            pendingDeletions: new Set(this.pendingDeletions),
            pendingAdditions: new Set(this.pendingAdditions)
        });

        // First handle all deletions
        const deletionsArray = Array.from(this.pendingDeletions).sort((a, b) => b - a);
        console.log('NotebookUI: Processing deletions:', deletionsArray);
        deletionsArray.forEach(index => {
            if (window.notebookFunctions) {
                window.notebookFunctions.deleteCell(index);
            }
        });
        this.pendingDeletions.clear();

        // Then handle all content changes
        const changesArray = Array.from(this.pendingChanges.entries());
        console.log('NotebookUI: Processing content changes:', changesArray);
        changesArray.forEach(([index, change]) => {
            if (window.notebookFunctions) {
                // Update the cell content in the notebook
                window.notebookFunctions.updateCellContent(index, change.newContent);
            }
        });

        // Handle additions (if any are actually being processed)
        const additionsArray = Array.from(this.pendingAdditions);
        console.log('NotebookUI: Processing additions:', additionsArray);
        additionsArray.forEach(index => {
            console.log('NotebookUI: Processing addition for cell:', index);
            // Note: We don't need to do anything here because the cells are already added,
            // we just need to clear the pending status
        });

        // Clear all pending changes
        this.pendingChanges.clear();
        this.pendingAdditions.clear();
        console.log('NotebookUI: Cleared all pending changes');
        console.log('NotebookUI: New state:', {
            pendingChanges: new Map(this.pendingChanges),
            pendingDeletions: new Set(this.pendingDeletions),
            pendingAdditions: new Set(this.pendingAdditions)
        });

        // Remove all confirmation UIs
        const confirmationUIs = document.querySelectorAll('.change-confirmation');
        confirmationUIs.forEach(ui => ui.remove());

        // Remove batch confirmation UI
        const batchUI = document.getElementById('batch-confirmation');
        if (batchUI) {
            batchUI.remove();
        }

        // Mark as saved if no more changes
        if (this.pendingChanges.size === 0 && this.pendingDeletions.size === 0 && this.pendingAdditions.size === 0) {
            this.markAsSaved();
        }

        // Refresh the notebook display to ensure everything is in sync
        if (window.notebookFunctions) {
            console.log('NotebookUI: Refreshing notebook display');
            window.notebookFunctions.displayNotebook(this.editorManager.notebook);
        }
    }

    // Cancel all changes at once
    cancelAllChanges() {
        // Remove added cells from the notebook
        const additionsArray = Array.from(this.pendingAdditions).sort((a, b) => b - a);
        additionsArray.forEach(index => {
            if (this.editorManager && this.editorManager.notebook) {
                // Remove the cell from the notebook
                this.editorManager.notebook.cells.splice(index, 1);
            }
        });

        this.pendingChanges.clear();
        this.pendingDeletions.clear();
        this.pendingAdditions.clear();

        // Remove all confirmation UIs
        const confirmationUIs = document.querySelectorAll('.change-confirmation');
        confirmationUIs.forEach(ui => ui.remove());

        // Remove batch confirmation UI
        const batchUI = document.getElementById('batch-confirmation');
        if (batchUI) {
            batchUI.remove();
        }

        // Mark as saved if no more changes
        if (this.pendingChanges.size === 0 && this.pendingDeletions.size === 0 && this.pendingAdditions.size === 0) {
            this.markAsSaved();
        }

        // Refresh the notebook display
        if (window.notebookFunctions) {
            window.notebookFunctions.displayNotebook(this.editorManager.notebook);
        }
    }

    // Add pending change
    addPendingChange(index, oldContent, newContent) {
        // Get the current content from the notebook
        let currentContent = oldContent;
        if (this.editorManager && this.editorManager.notebook && this.editorManager.notebook.cells[index]) {
            currentContent = this.editorManager.notebook.cells[index].source;
        }

        // If there's an existing pending change, use its newContent as the oldContent
        const existingChange = this.pendingChanges.get(index);
        if (existingChange) {
            currentContent = existingChange.newContent;
        }

        // Only add the change if the content is different
        if (currentContent !== newContent) {
            this.pendingChanges.set(index, { oldContent: currentContent, newContent });
            this.markAsUnsaved();
            this.refreshCell(index);
        }
    }

    // Add pending deletion
    addPendingDeletion(index) {
        this.pendingDeletions.add(index);
        this.markAsUnsaved();
        this.refreshCell(index);
    }

    // Refresh a specific cell
    refreshCell(index) {
        console.log('NotebookUI: Refreshing cell at index:', index);
        
        // Find existing cell or create container for new cell
        let cell = document.querySelector(`.notebook-cell[data-cell-index="${index}"]`);
        const notebookContent = document.getElementById('notebook-content');
        
        if (!this.editorManager || !this.editorManager.notebook?.cells?.[index]) {
            console.error('NotebookUI: Cannot refresh cell - invalid notebook or cell index');
            return;
        }

        const cellData = this.editorManager.notebook.cells[index];
        
        // Get or create editor
        let editor = this.editorManager.editors.get(index);
        if (!editor) {
            console.log('NotebookUI: Creating new editor for cell:', index);
            editor = this.editorManager.createEditor(cellData, index, (newContent) => {
                if (this.editorManager.notebook.cells[index]) {
                    this.editorManager.notebook.cells[index].source = newContent;
                }
            });
            this.editorManager.editors.set(index, editor);
        }

        // Create toolbar
        const toolbar = cell ? cell.querySelector('.cell-toolbar') : null;
        const newToolbar = toolbar || (window.notebookFunctions?.cellManager ? 
            window.notebookFunctions.cellManager.createCellToolbar(cellData, index, {
                onTypeChange: (idx, type) => window.notebookFunctions.changeCellType(idx, type),
                onAddCell: (idx) => window.notebookFunctions.addCell('code', idx),
                onDeleteCell: (idx) => window.notebookFunctions.deleteCell(idx)
            }) : null);

        // Create select area
        const selectArea = cell ? cell.querySelector('.cell-select-area') : null;
        const newSelectArea = selectArea || this.createSelectArea(
            index,
            false,
            (idx, shiftKey) => {
                if (window.notebookFunctions?.selectionManager) {
                    window.notebookFunctions.selectionManager.toggleCellSelection(idx, shiftKey);
                    window.notebookFunctions.selectionManager.updateCellSelection();
                }
            }
        );

        // Create new cell container
        const newCell = this.createCellContainer(index, newToolbar, editor, newSelectArea);
        
        if (cell) {
            // Replace existing cell
            cell.replaceWith(newCell);
        } else {
            // Insert new cell at correct position
            const cells = notebookContent.querySelectorAll('.notebook-cell');
            let inserted = false;
            
            for (const existingCell of cells) {
                const existingIndex = parseInt(existingCell.dataset.cellIndex);
                if (existingIndex > index) {
                    existingCell.before(newCell);
                    inserted = true;
                    break;
                }
            }
            
            if (!inserted) {
                notebookContent.appendChild(newCell);
            }
        }
        
        // Layout the editor
        if (editor && editor.layout) {
            editor.layout();
        }
    }

    // Clear notebook content
    clearNotebookContent() {
        const notebookDiv = document.getElementById('notebook-content');
        if (notebookDiv) {
            notebookDiv.innerHTML = '';
        }
    }

    // Handle proposed changes
    handleProposedChanges(changes) {
        console.log('NotebookUI: handleProposedChanges called with changes:', changes);
        console.log('NotebookUI: Current state before processing:', {
            pendingChanges: new Map(this.pendingChanges),
            pendingDeletions: new Set(this.pendingDeletions),
            pendingAdditions: new Set(this.pendingAdditions)
        });
        
        // If this is the start of a new set of changes, set the flag
        if (!this.isProcessingChanges) {
            this.isProcessingChanges = true;
            console.log('NotebookUI: Started processing changes');
        }

        changes.forEach(change => {
            console.log('NotebookUI: Processing change:', change);
            switch (change.type) {
                case 'update':
                    console.log('NotebookUI: Adding pending change for cell', change.index);
                    this.addPendingChange(change.index, change.old_content, change.new_content);
                    break;
                case 'delete':
                    console.log('NotebookUI: Adding pending deletion for cell', change.index);
                    this.addPendingDeletion(change.index);
                    break;
                case 'add':
                    console.log('NotebookUI: Adding pending addition for cell', change.index);
                    console.log('NotebookUI: Cell type from change:', change.cell_type);
                    this.addPendingAddition(change.index, change.new_content, change.cell_type);
                    break;
            }
        });

        console.log('NotebookUI: Current state after processing:', {
            pendingChanges: new Map(this.pendingChanges),
            pendingDeletions: new Set(this.pendingDeletions),
            pendingAdditions: new Set(this.pendingAdditions)
        });
    }

    // New method to finalize changes and show UI
    finalizeChanges() {
        console.log('NotebookUI: finalizeChanges called, isProcessingChanges =', this.isProcessingChanges);
        console.log('NotebookUI: pendingChanges size =', this.pendingChanges.size);
        console.log('NotebookUI: pendingDeletions size =', this.pendingDeletions.size);
        console.log('NotebookUI: pendingAdditions size =', this.pendingAdditions.size);
        
        if (this.isProcessingChanges) {
            this.isProcessingChanges = false;
            if (this.pendingChanges.size > 0 || this.pendingDeletions.size > 0 || this.pendingAdditions.size > 0) {
                console.log('NotebookUI: Showing batch confirmation UI');
                this.showBatchConfirmationUI();
            } else {
                console.log('NotebookUI: No changes to show UI for');
            }
        } else {
            console.log('NotebookUI: Not processing changes, skipping finalization');
        }
    }

    // Add pending addition
    addPendingAddition(index, content = '', cellType = 'code') {
        console.log('NotebookUI: addPendingAddition called for index:', index);
        console.log('NotebookUI: Adding cell with type:', cellType, 'and content:', content);
        console.log('NotebookUI: Current pendingAdditions before:', new Set(this.pendingAdditions));
        
        // Add to pending additions
        this.pendingAdditions.add(index);
        
        // Also add to pending changes to show the content
        this.pendingChanges.set(index, {
            oldContent: '',
            newContent: content
        });
        
        console.log('NotebookUI: Current pendingAdditions after:', new Set(this.pendingAdditions));
        
        // Add the cell to the notebook without triggering a full refresh
        if (this.editorManager && this.editorManager.notebook) {
            console.log('NotebookUI: Creating new cell with type:', cellType);
            const newCell = {
                cell_type: cellType,
                source: '',  // Start with empty source, will be updated after confirmation
                metadata: {},
                outputs: cellType === 'code' ? [] : undefined,
                execution_count: cellType === 'code' ? null : undefined
            };
            console.log('NotebookUI: New cell object:', newCell);
            
            if (index >= this.editorManager.notebook.cells.length) {
                this.editorManager.notebook.cells.push(newCell);
            } else {
                this.editorManager.notebook.cells.splice(index, 0, newCell);
            }
            
            // Only refresh the specific cell and its surroundings
            this.refreshCell(index);
            // Also refresh the next cell if it exists (to update indices)
            if (index + 1 < this.editorManager.notebook.cells.length) {
                this.refreshCell(index + 1);
            }
        }
        
        this.markAsUnsaved();
    }
} 