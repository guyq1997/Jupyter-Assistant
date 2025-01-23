export class NotebookUI {
    constructor() {
        this.hasUnsavedChanges = false;
        this.setupWindowEvents();
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
        const cellDiv = document.createElement('div');
        cellDiv.className = 'notebook-cell';
        cellDiv.dataset.cellIndex = index;
        
        // Add markdown-cell class if it's a markdown editor
        if (editor.classList.contains('markdown')) {
            cellDiv.classList.add('markdown-cell');
        } else {
            cellDiv.classList.add('code-cell');
        }
        
        const cellContentWrapper = document.createElement('div');
        cellContentWrapper.className = 'cell-content-wrapper';
        
        // Always append toolbar, let CSS control visibility
        cellContentWrapper.appendChild(toolbar);
        cellContentWrapper.appendChild(editor);
        
        cellDiv.appendChild(cellContentWrapper);
        cellDiv.appendChild(selectArea);
        
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

    // Clear notebook content
    clearNotebookContent() {
        const notebookDiv = document.getElementById('notebook-content');
        if (notebookDiv) {
            notebookDiv.innerHTML = '';
        }
    }
} 