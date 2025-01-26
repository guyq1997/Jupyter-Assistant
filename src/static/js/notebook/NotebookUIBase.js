export class NotebookUIBase {
    constructor() {
        this.hasUnsavedChanges = false;
        this.editorManager = null;
        this.setupWindowEvents();
    }

    setEditorManager(editorManager) {
        this.editorManager = editorManager;
    }

    setupWindowEvents() {
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
    }

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

    markAsSaved() {
        this.hasUnsavedChanges = false;
        this.updateSaveIndicator();
    }

    markAsUnsaved() {
        this.hasUnsavedChanges = true;
        this.updateSaveIndicator();
    }

    clearNotebookContent() {
        const notebookDiv = document.getElementById('notebook-content');
        if (notebookDiv) {
            notebookDiv.innerHTML = '';
        }
    }

    getNotebookCell(index) {
        return this.editorManager?.notebook?.cells?.[index];
    }

    validateEditorManager() {
        if (!this.editorManager || !this.editorManager.notebook) {
            console.error('Invalid editor manager or notebook');
            return false;
        }
        return true;
    }
} 