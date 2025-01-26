import { NotebookUIBase } from '../notebook/NotebookUIBase.js';

export class DiffUIManager extends NotebookUIBase {
    constructor() {
        super();
        this._pendingChanges = new Map();
        this._pendingDeletions = new Set();
        this._pendingAdditions = new Set();
    }

    get pendingChanges() {
        return this._pendingChanges;
    }

    get pendingDeletions() {
        return this._pendingDeletions;
    }

    get pendingAdditions() {
        return this._pendingAdditions;
    }

    createDiffView(index) {
        console.log('DiffUIManager: Creating diff view for cell:', index);
        const changes = this._pendingChanges.get(index);
        if (!changes) return null;

        const diffView = document.createElement('div');
        diffView.className = 'diff-view';
        
        const cellData = this.getNotebookCell(index);
        const cellType = cellData?.cell_type || 'code';
        console.log('DiffUIManager: Diff view for cell type:', cellType);
        
        // Show deleted content
        if (changes.oldContent && !this._pendingAdditions.has(index)) {
            const deletedContent = document.createElement('pre');
            deletedContent.className = 'deleted-content';
            deletedContent.textContent = changes.oldContent;
            diffView.appendChild(deletedContent);
        }
        
        // Show new content
        if (changes.newContent) {
            console.log('DiffUIManager: Adding new content to diff view');
            const newContent = document.createElement('pre');
            newContent.className = 'new-content';
            
            if (cellType === 'markdown') {
                console.log('DiffUIManager: Rendering markdown content in diff view');
                newContent.innerHTML = marked.parse(changes.newContent);
                newContent.classList.add('markdown-preview');
                diffView.classList.add('markdown-diff-view');
            } else {
                newContent.textContent = changes.newContent;
            }
            
            if (this._pendingAdditions.has(index)) {
                console.log('DiffUIManager: Adding pending-addition class to diff view content');
                newContent.classList.add('pending-addition-content');
            }
            
            diffView.appendChild(newContent);
        }
        
        return diffView;
    }

    addPendingChange(index, oldContent, newContent) {
        let currentContent = oldContent;
        if (this.getNotebookCell(index)) {
            currentContent = this.getNotebookCell(index).source;
        }

        const existingChange = this._pendingChanges.get(index);
        if (existingChange) {
            currentContent = existingChange.newContent;
        }

        if (currentContent !== newContent) {
            this._pendingChanges.set(index, { oldContent: currentContent, newContent });
            this.markAsUnsaved();
            if (this.refreshCell) {
                this.refreshCell(index);
            }
        }
    }

    addPendingDeletion(index) {
        this._pendingDeletions.add(index);
        this.markAsUnsaved();
        if (this.refreshCell) {
            this.refreshCell(index);
        }
    }

    addPendingAddition(index, content = '', cellType = 'code') {
        console.log('DiffUIManager: addPendingAddition called for index:', index);
        
        this._pendingAdditions.add(index);
        this._pendingChanges.set(index, {
            oldContent: '',
            newContent: content
        });
        
        if (this.validateEditorManager()) {
            const newCell = {
                cell_type: cellType,
                source: '',
                metadata: {},
                outputs: cellType === 'code' ? [] : undefined,
                execution_count: cellType === 'code' ? null : undefined
            };
            
            if (index >= this.editorManager.notebook.cells.length) {
                this.editorManager.notebook.cells.push(newCell);
            } else {
                this.editorManager.notebook.cells.splice(index, 0, newCell);
            }
            
            if (this.refreshCell) {
                this.refreshCell(index);
                if (index + 1 < this.editorManager.notebook.cells.length) {
                    this.refreshCell(index + 1);
                }
            }
        }
        
        this.markAsUnsaved();
    }

    clearPendingChanges() {
        this._pendingChanges.clear();
        this._pendingDeletions.clear();
        this._pendingAdditions.clear();
        this.markAsSaved();
    }

    hasPendingChanges() {
        return this._pendingChanges.size > 0 || 
               this._pendingDeletions.size > 0 || 
               this._pendingAdditions.size > 0;
    }
} 