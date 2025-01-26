import { EDITOR_CONFIG } from '../core/config.js';

export class EditorManager {
    constructor() {
        this.editors = new Map();
        this.monacoLoaded = false;
        this.notebook = null;  // Add notebook reference
        this.editorsReady = new Promise((resolve) => {
            require(['vs/editor/editor.main'], () => {
                this.monacoLoaded = true;
                resolve();
            });
        });
    }

    // Set notebook reference
    setNotebook(notebook) {
        this.notebook = notebook;
    }

    // Get cell content from editor
    getCellContent(cell, index) {
        const editor = this.editors.get(index);
        if (editor) {
            if (editor.getValue) {
                return editor.getValue();
            } else if (editor.value) {
                return editor.value();
            }
        }
        return Array.isArray(cell.source) ? cell.source.join('') : cell.source;
    }

    // Update cell content
    updateCellContent(index, content) {
        if (!this.notebook || !this.notebook.cells || !this.notebook.cells[index]) {
            console.error('Cannot update cell content: invalid notebook or cell index');
            return;
        }

        // Update the notebook data structure
        this.notebook.cells[index].source = content;

        // Update the editor if it exists
        const editor = this.editors.get(index);
        if (editor) {
            if (editor.setValue) {
                editor.setValue(content);
            } else if (editor.value) {
                editor.value(content);
            }
        }
    }

    // Create editor for a cell
    createEditor(cell, index, onContentChange) {
        if (cell.cell_type === 'markdown') {
            return this.createMarkdownEditor(cell, index, onContentChange);
        } else {
            return this.createCodeEditor(cell, index, onContentChange);
        }
    }

    // Create markdown editor
    createMarkdownEditor(cell, index, onContentChange) {
        const container = document.createElement('div');
        container.className = 'notebook-cell-content markdown';
        
        const previewContainer = document.createElement('div');
        previewContainer.className = 'markdown-preview-container';
        previewContainer.innerHTML = marked.parse(cell.source);
        
        const editorContainer = document.createElement('div');
        editorContainer.className = 'markdown-editor-container';
        editorContainer.style.display = 'none';
        
        const textarea = document.createElement('textarea');
        textarea.value = cell.source;
        editorContainer.appendChild(textarea);
        
        container.appendChild(previewContainer);
        container.appendChild(editorContainer);
        
        let editor = null;
        let isExiting = false;  // Add flag to prevent re-entry during exit
        
        const exitEditMode = () => {
            if (isExiting) return;  // Prevent re-entry
            isExiting = true;
            
            try {
                if (editor) {
                    // Get content before cleanup
                    const content = editor.value();
                    
                    // Clean up the editor first
                    editor.toTextArea();  // Convert back to textarea
                    this.editors.delete(index);  // Remove from editors map
                    editor = null;
                    
                    // Update UI and content after cleanup
                    previewContainer.innerHTML = marked.parse(content);
                    this.updateCellContent(index, content);  // Update notebook data
                    onContentChange(content);
                }
                
                // Update UI state
                previewContainer.style.display = 'block';
                editorContainer.style.display = 'none';
                container.classList.remove('editing');
                const notebookCell = container.closest('.notebook-cell');
                if (notebookCell) {
                    notebookCell.classList.remove('editing');
                }
            } finally {
                isExiting = false;
            }
        };
        
        const enterEditMode = () => {
            if (isExiting) return;  // Don't enter if we're in the process of exiting
            
            previewContainer.style.display = 'none';
            editorContainer.style.display = 'block';
            container.classList.add('editing');
            const notebookCell = container.closest('.notebook-cell');
            if (notebookCell) {
                notebookCell.classList.add('editing');
            }
            
            if (!editor) {
                editor = new SimpleMDE({
                    element: textarea,
                    initialValue: cell.source,
                    spellChecker: false,
                    status: false,
                    toolbar: false,
                    minHeight: '200px',
                    forceSync: true  // Force sync with textarea
                });
                
                this.editors.set(index, editor);
                
                // Debounce the change handler to prevent rapid updates
                let changeTimeout;
                editor.codemirror.on('change', () => {
                    if (changeTimeout) clearTimeout(changeTimeout);
                    changeTimeout = setTimeout(() => {
                        if (editor) {  // Check if editor still exists
                            const newContent = editor.value();
                            this.updateCellContent(index, newContent);  // Update notebook data
                            onContentChange(newContent);
                        }
                    }, 100);
                });
                
                editor.codemirror.setOption('extraKeys', {
                    'Shift-Enter': (cm) => {
                        if (isExiting) return;  // Prevent if already exiting
                        exitEditMode();
                    },
                    'Enter': 'newlineAndIndent',
                    'Tab': false,
                    'Shift-Tab': false
                });

                // Focus the editor after setup is complete
                requestAnimationFrame(() => {
                    if (editor && editor.codemirror) {
                        editor.codemirror.refresh();
                        editor.codemirror.focus();
                    }
                });
            }
        };
        
        // Add double click handler to the preview container
        previewContainer.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            enterEditMode();
        });
        
        // Add click handler to show hover effect
        previewContainer.addEventListener('mouseenter', () => {
            previewContainer.classList.add('hover');
        });
        
        previewContainer.addEventListener('mouseleave', () => {
            previewContainer.classList.remove('hover');
        });
        
        return container;
    }

    // Create code editor
    createCodeEditor(cell, index, onContentChange) {
        const container = document.createElement('div');
        container.className = 'cell-editor';
        container.id = `editor-${index}`;
        
        const createMonacoEditor = () => {
            const editor = monaco.editor.create(container, {
                value: cell.source,
                language: 'python',
                ...EDITOR_CONFIG
            });
            
            this.editors.set(index, editor);
            
            setTimeout(() => {
                this.updateEditorHeight(editor);
                editor.onDidChangeModelContent(() => {
                    onContentChange(editor.getValue());
                    this.updateEditorHeight(editor);
                });
            }, 0);
        };
        
        if (this.monacoLoaded) {
            createMonacoEditor();
        } else {
            this.editorsReady.then(createMonacoEditor);
        }
        
        return container;
    }

    // Update editor height based on content
    updateEditorHeight(editor) {
        const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
        const lineCount = editor.getModel().getLineCount();
        const padding = 16;
        const height = Math.min(Math.max(lineCount * lineHeight + padding, 100), 500);
        editor.getDomNode().style.height = `${height}px`;
        editor.layout();
    }

    // Clear all editors
    clear() {
        this.editors.clear();
    }

    // Layout all editors
    layoutAll() {
        if (this.monacoLoaded) {
            this.editors.forEach(editor => {
                if (editor && editor.layout) {
                    editor.layout();
                    this.updateEditorHeight(editor);
                }
            });
        }
    }
} 