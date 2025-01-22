// Global variables
let monacoLoaded = false;
let editors = new Map();  // Map to store editor instances
let currentNotebook = null;
let selectedCells = new Set();  // Track selected cell indices
let hasUnsavedChanges = false;

// Constants and configuration
const EDITOR_CONFIG = {
    theme: 'vs',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    fontSize: 15,
    lineNumbers: 'off',
    padding: { top: 8, bottom: 8 },
    renderLineHighlight: 'none',
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    mouseWheelScrollSensitivity: 0,
    scrollbar: {
        vertical: 'hidden',
        horizontal: 'auto',
        alwaysConsumeMouseWheel: false
    }
};

// Helper function to get cell content
function getCellContent(cell, index) {
    const editor = editors.get(index);
    if (editor) {
        if (editor.getValue) {
            return editor.getValue();
        } else if (editor.value) {
            return editor.value();
        }
    }
    return Array.isArray(cell.source) ? cell.source.join('') : cell.source;
}

// Function to get selected cells content
function getSelectedCellsContent() {
    console.log('getSelectedCellsContent called');
    console.log('currentNotebook:', currentNotebook);
    console.log('selectedCells:', selectedCells);
    
    if (!currentNotebook) return '';
    
    const selectedContent = [];
    Array.from(selectedCells).sort((a, b) => a - b).forEach(index => {
        const cell = currentNotebook.cells[index];
        if (cell) {
            const content = getCellContent(cell, index);
            selectedContent.push({
                index: index + 1,
                type: cell.cell_type,
                content: content
            });
        }
    });
    
    if (selectedContent.length === 0) return '';
    
    // Format the content as markdown
    return selectedContent.map(cell => 
        `**Selected Cell ${cell.index} (${cell.type}):**\n\`\`\`${cell.type === 'code' ? 'python' : ''}\n${cell.content}\n\`\`\``
    ).join('\n\n');
}

// Initialize notebook functions
function initializeNotebookFunctions() {
    console.log('Initializing notebook functions...');
    
    // Wait for Monaco editor to be ready
    editorsReady.then(() => {
        console.log('Monaco editor ready, setting up notebook functions');
        window.notebookFunctions = {
            displayNotebook,
            addCell,
            deleteCell,
            moveCell,
            changeCellType,
            saveNotebook,
            removeSelectedCell,
            getSelectedCellsContent
        };
        console.log('Notebook functions initialized:', window.notebookFunctions);
    }).catch(error => {
        console.error('Error initializing Monaco editor:', error);
    });
}

// Initialize Monaco Editor
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.47.0/min/vs' }});
window.MonacoEnvironment = {
    getWorkerUrl: function(workerId, label) {
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
            self.MonacoEnvironment = {
                baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.47.0/min/'
            };
            importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.47.0/min/vs/base/worker/workerMain.js');`
        )}`;
    }
};

// Wait for both editors to be ready
let editorsReady = new Promise((resolve) => {
    require(['vs/editor/editor.main'], function() {
        monacoLoaded = true;
        resolve();
    });
});

// Helper function to update editor height based on content
function updateEditorHeight(editor) {
    const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
    const lineCount = editor.getModel().getLineCount();
    const padding = 16; // 8px padding top + 8px padding bottom
    const height = Math.min(Math.max(lineCount * lineHeight + padding, 100), 500); // Min 100px, max 500px
    editor.getDomNode().style.height = `${height}px`;
    editor.layout();
}

function displayNotebook(notebook) {
    currentNotebook = notebook;
    const notebookDiv = document.getElementById('notebook-content');
    notebookDiv.innerHTML = '';
    editors.clear();
    selectedCells.clear();  // Clear selected cells when notebook changes
    updateSelectedCellsDisplay();
    
    notebook.cells.forEach((cell, index) => {
        const cellDiv = document.createElement('div');
        cellDiv.className = `notebook-cell ${cell.cell_type}-cell`;
        cellDiv.dataset.cellIndex = index;
        
        // Create cell content wrapper
        const cellContentWrapper = document.createElement('div');
        cellContentWrapper.className = 'cell-content-wrapper';
        
        // Add cell toolbar
        cellContentWrapper.appendChild(createCellToolbar(cell, index));
        
        // Add editor
        cellContentWrapper.appendChild(createEditor(cell, index));
        
        // Add cell content wrapper to cell div
        cellDiv.appendChild(cellContentWrapper);
        
        // Add select area last to ensure it's on top
        const selectArea = document.createElement('div');
        selectArea.className = 'cell-select-area';
        selectArea.innerHTML = selectedCells.has(index) ? '☒' : '☐';
        selectArea.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleCellSelection(index, e.shiftKey);
        };
        cellDiv.appendChild(selectArea);
        
        notebookDiv.appendChild(cellDiv);
    });
}

function createCellToolbar(cell, index) {
    const toolbar = document.createElement('div');
    toolbar.className = 'cell-toolbar';
    
    const typeSelect = document.createElement('select');
    typeSelect.innerHTML = ['code', 'markdown']
        .map(type => `<option value="${type}" ${cell.cell_type === type ? 'selected' : ''}>${type.charAt(0).toUpperCase() + type.slice(1)}</option>`)
        .join('');
    typeSelect.addEventListener('change', (e) => changeCellType(index, e.target.value));
    
    toolbar.appendChild(typeSelect);
    toolbar.appendChild(createButton('Add Above', () => addCellAt(index)));
    toolbar.appendChild(createButton('Add Below', () => addCellAt(index + 1)));
    toolbar.appendChild(createButton('🗑️', () => deleteCell(index)));
    
    return toolbar;
}

function createEditor(cell, index) {
    const cellDiv = document.createElement('div');
    cellDiv.className = `notebook-cell ${cell.cell_type}-cell`;
    
    if (cell.cell_type === 'markdown') {
        // Create both preview and editor containers
        const previewContainer = document.createElement('div');
        previewContainer.className = 'cell-content markdown';
        previewContainer.innerHTML = marked.parse(cell.source);
        
        const editorContainer = document.createElement('div');
        editorContainer.className = 'cell-content markdown editing';
        editorContainer.style.display = 'none';
        
        const textarea = document.createElement('textarea');
        textarea.value = cell.source;
        editorContainer.appendChild(textarea);
        
        // Add cell toolbar first
        cellDiv.appendChild(createCellToolbar(cell, index));
        cellDiv.appendChild(previewContainer);
        cellDiv.appendChild(editorContainer);
        
        // Toggle between preview and editor on double click
        previewContainer.addEventListener('dblclick', () => {
            previewContainer.style.display = 'none';
            editorContainer.style.display = 'block';
            cellDiv.classList.add('editing');
            
            if (!editors.has(index)) {
                const editor = new SimpleMDE({
                    element: textarea,
                    initialValue: cell.source,
                    spellChecker: false,
                    status: false,
                    toolbar: false
                });
                
                editors.set(index, editor);
                editor.codemirror.on('change', () => {
                    cell.source = editor.value();
                    previewContainer.innerHTML = marked.parse(cell.source);
                    hasUnsavedChanges = true;
                    updateSaveIndicator();
                });
                
                editor.codemirror.on('keydown', (cm, event) => {
                    if (event.shiftKey && event.key === 'Enter') {
                        event.preventDefault();
                        previewContainer.style.display = 'block';
                        editorContainer.style.display = 'none';
                        cellDiv.classList.remove('editing');
                    }
                });
            }
        });
        
        return cellDiv;
    } else {
        // Code cell
        const editorContainer = document.createElement('div');
        editorContainer.className = 'cell-editor';
        editorContainer.id = `editor-${index}`;
        editorContainer.style.minHeight = '100px'; // Set minimum height
        
        cellDiv.appendChild(editorContainer);
        
        editorsReady.then(() => {
            const editor = monaco.editor.create(editorContainer, {
                value: cell.source,
                language: 'python',
                theme: 'vs',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                fontSize: 15,
                lineNumbers: 'off',
                padding: { top: 8, bottom: 8 },
                renderLineHighlight: 'none',
                scrollbar: {
                    vertical: 'hidden',
                    horizontal: 'auto'
                },
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                mouseWheelScrollSensitivity: 0,
                scrollbar: {
                    vertical: 'hidden',
                    horizontal: 'auto',
                    alwaysConsumeMouseWheel: false
                }
            });
            
            editorContainer.addEventListener('wheel', (e) => {
                const notebookDisplay = document.getElementById('notebook-display');
                notebookDisplay.scrollTop += e.deltaY;
            }, { passive: true });
            
            editors.set(index, editor);
            
            // Update height initially
            updateEditorHeight(editor);
            
            // Update height when content changes
            editor.onDidChangeModelContent(() => {
                cell.source = editor.getValue();
                updateEditorHeight(editor);
                hasUnsavedChanges = true;
                updateSaveIndicator();
            });
        });
    }
    
    return cellDiv;
}

// Helper function to create a new cell object
function createNewCell(type = 'code') {
    const cell = {
        cell_type: type,
        source: '',
        metadata: {}
    };
    
    if (type === 'code') {
        cell.outputs = [];
        cell.execution_count = null;
    }
    
    return cell;
}

// Helper function to create UI elements
function createButton(text, onClick, className = '') {
    const button = document.createElement('button');
    button.textContent = text;
    button.onclick = onClick;
    if (className) button.className = className;
    return button;
}

// Simplified cell management functions
function addCell(type = 'code') {
    if (!currentNotebook) return;
    addCellAt(currentNotebook.cells.length, type);
}

function deleteCell(index) {
    if (!currentNotebook) return;
    currentNotebook.cells.splice(index, 1);
    displayNotebook(currentNotebook);
}

function moveCell(index, direction) {
    if (!currentNotebook) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentNotebook.cells.length) return;
    
    const cell = currentNotebook.cells[index];
    currentNotebook.cells.splice(index, 1);
    currentNotebook.cells.splice(newIndex, 0, cell);
    displayNotebook(currentNotebook);
}

function changeCellType(index, newType) {
    if (!currentNotebook) return;
    
    const cell = currentNotebook.cells[index];
    const oldSource = cell.source;
    
    cell.cell_type = newType;
    cell.source = oldSource;
    
    if (newType === 'code') {
        cell.outputs = [];
        cell.execution_count = null;
    } else {
        delete cell.outputs;
        delete cell.execution_count;
    }
    
    displayNotebook(currentNotebook);
}

function saveNotebook() {
    if (!currentNotebook) return;
    
    // Update all cell sources from editors
    currentNotebook.cells.forEach((cell, index) => {
        const editor = editors.get(index);
        if (editor) {
            cell.source = editor.getValue ? editor.getValue() : editor.value();
        }
    });
    
    // Send to server
    ws.send(JSON.stringify({
        type: 'save_notebook',
        content: currentNotebook
    }));

    // Reset unsaved changes flag
    hasUnsavedChanges = false;
    updateSaveIndicator();
}

function addCellAt(index, type = 'code') {
    if (!currentNotebook) return;
    currentNotebook.cells.splice(index, 0, createNewCell(type));
    displayNotebook(currentNotebook);
}

// Unified cell selection management
function updateCellSelection() {
    document.querySelectorAll('.notebook-cell').forEach(cell => {
        const index = parseInt(cell.dataset.cellIndex);
        const isSelected = selectedCells.has(index);
        cell.classList.toggle('selected', isSelected);
        
        const selectArea = cell.querySelector('.cell-select-area');
        if (selectArea) {
            selectArea.classList.toggle('selected', isSelected);
            selectArea.innerHTML = isSelected ? '☒' : '☐';
        }
    });
    
    updateSelectedCellsDisplay();
}

function toggleCellSelection(index, isShiftKey) {
    const lastSelected = Array.from(selectedCells).pop();
    
    if (isShiftKey && lastSelected !== undefined) {
        // Select range of cells
        const start = Math.min(lastSelected, index);
        const end = Math.max(lastSelected, index);
        for (let i = start; i <= end; i++) {
            selectedCells.add(i);
        }
    } else {
        // Toggle single cell
        if (selectedCells.has(index)) {
            selectedCells.delete(index);
        } else {
            selectedCells.add(index);
        }
    }
    
    // Update UI
    updateCellSelection();
}

function updateSelectedCellsDisplay() {
    const container = document.getElementById('selected-cells');
    container.innerHTML = '';
    
    Array.from(selectedCells).sort((a, b) => a - b).forEach(index => {
        const cell = currentNotebook.cells[index];
        const tag = document.createElement('div');
        tag.className = 'selected-cell-tag';
        tag.innerHTML = `
            Cell ${index + 1} (${cell.cell_type})
            <span class="remove" onclick="window.notebookFunctions.removeSelectedCell(${index})">×</span>
        `;
        container.appendChild(tag);
    });
}

function removeSelectedCell(index) {
    selectedCells.delete(index);
    updateCellSelection();
}

// Add function to update save indicator
function updateSaveIndicator() {
    const saveButton = document.getElementById('save-notebook-btn');
    if (hasUnsavedChanges) {
        saveButton.classList.add('unsaved');
        saveButton.textContent = 'Save Notebook*';
    } else {
        saveButton.classList.remove('unsaved');
        saveButton.textContent = 'Save Notebook';
    }
}

// Add window beforeunload handler
window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
    }
}); 