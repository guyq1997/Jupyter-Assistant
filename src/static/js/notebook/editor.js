import { EDITOR_CONFIG } from './config.js';

export class EditorManager {
    constructor() {
        this.editors = new Map();
        this.monacoLoaded = false;
        this.editorsReady = new Promise((resolve) => {
            require(['vs/editor/editor.main'], () => {
                this.monacoLoaded = true;
                resolve();
            });
        });
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
        container.className = 'cell-content markdown';
        
        const previewContainer = document.createElement('div');
        previewContainer.className = 'cell-content markdown preview';
        previewContainer.innerHTML = marked.parse(cell.source);
        
        const editorContainer = document.createElement('div');
        editorContainer.className = 'cell-content markdown editing';
        editorContainer.style.display = 'none';
        
        const textarea = document.createElement('textarea');
        textarea.value = cell.source;
        editorContainer.appendChild(textarea);
        
        container.appendChild(previewContainer);
        container.appendChild(editorContainer);
        
        let editor = null;
        
        const exitEditMode = () => {
            previewContainer.style.display = 'block';
            editorContainer.style.display = 'none';
            container.classList.remove('editing');
            // Find the parent notebook cell and remove editing class
            const notebookCell = container.closest('.notebook-cell');
            if (notebookCell) {
                notebookCell.classList.remove('editing');
            }
            if (editor) {
                previewContainer.innerHTML = marked.parse(editor.value());
            }
        };
        
        const enterEditMode = () => {
            previewContainer.style.display = 'none';
            editorContainer.style.display = 'block';
            container.classList.add('editing');
            // Find the parent notebook cell and add editing class
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
                    minHeight: '200px'
                });
                
                this.editors.set(index, editor);
                
                editor.codemirror.on('change', () => {
                    const newContent = editor.value();
                    onContentChange(newContent);
                });
                
                // Add Shift+Enter handler
                editor.codemirror.setOption('extraKeys', {
                    'Shift-Enter': (cm) => {
                        exitEditMode();
                    }
                });
            }
            
            // Focus the editor after a short delay to ensure it's ready
            setTimeout(() => {
                if (editor) {
                    editor.codemirror.focus();
                }
            }, 100);
        };
        
        previewContainer.addEventListener('dblclick', enterEditMode);
        
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