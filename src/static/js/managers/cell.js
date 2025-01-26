export class CellManager {
    constructor() {
        this.notebook = null;
        this.editorManager = null;
        this.selectionManager = null;
    }

    setEditorManager(editorManager) {
        this.editorManager = editorManager;
    }

    setSelectionManager(selectionManager) {
        this.selectionManager = selectionManager;
    }

    setNotebook(notebook) {
        this.notebook = notebook;
    }

    clearNotebookContent() {
        if (this.notebook) {
            this.notebook.cells = [];
        }
        if (this.editorManager) {
            this.editorManager.clear();
        }
        const notebookContent = document.getElementById('notebook-content');
        if (notebookContent) {
            notebookContent.innerHTML = '';
        }
    }

    // Create a new cell
    createNewCell(type = 'code') {
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

    // Add cell at specific index
    addCellAt(index, type = 'code') {
        console.log('CellManager: Adding cell at index', index, 'with type', type);
        if (!this.notebook) {
            console.error('CellManager: No notebook available');
            return;
        }

        const newCell = {
            cell_type: type,
            source: '',
            metadata: {}
        };

        if (type === 'code') {
            newCell.outputs = [];
            newCell.execution_count = null;
        }

        console.log('CellManager: Current cells count:', this.notebook.cells.length);
        if (index === null || index >= this.notebook.cells.length) {
            console.log('CellManager: Appending cell at the end');
            this.notebook.cells.push(newCell);
        } else {
            console.log('CellManager: Inserting cell at index', index);
            this.notebook.cells.splice(index, 0, newCell);
        }
        console.log('CellManager: New cells count:', this.notebook.cells.length);
    }

    // Delete cell at index
    deleteCell(index) {
        console.log('CellManager: Deleting cell at index', index);
        if (!this.notebook || index >= this.notebook.cells.length) {
            console.error('CellManager: Invalid delete operation');
            return;
        }
        this.notebook.cells.splice(index, 1);
        console.log('CellManager: Remaining cells:', this.notebook.cells.length);
    }

    // Move cell up or down
    moveCell(index, direction) {
        console.log('CellManager: Moving cell', { index, direction });
        if (!this.notebook) return;
        
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= this.notebook.cells.length) {
            console.log('CellManager: Cannot move cell - invalid new index');
            return;
        }
        
        const cell = this.notebook.cells[index];
        this.notebook.cells.splice(index, 1);
        this.notebook.cells.splice(newIndex, 0, cell);
        console.log('CellManager: Cell moved successfully');
    }

    // Change cell type
    changeCellType(index, newType) {
        console.log('CellManager: Changing cell type', { index, newType });
        if (!this.notebook || !this.notebook.cells[index]) {
            console.error('CellManager: Invalid cell type change operation');
            return;
        }
        
        const cell = this.notebook.cells[index];
        const oldContent = cell.source;
        
        cell.cell_type = newType;
        if (newType === 'code') {
            cell.outputs = [];
            cell.execution_count = null;
        } else {
            delete cell.outputs;
            delete cell.execution_count;
        }
        cell.source = oldContent;
        console.log('CellManager: Cell type changed successfully');
    }

    // Create cell toolbar
    createCellToolbar(cell, index, callbacks) {
        const toolbar = document.createElement('div');
        toolbar.className = 'cell-toolbar';
        
        // For markdown cells, add the non-editing class initially
        if (cell.cell_type === 'markdown') {
            toolbar.classList.add('markdown-toolbar');
        }
        
        const typeSelect = document.createElement('select');
        typeSelect.innerHTML = ['code', 'markdown']
            .map(type => `<option value="${type}" ${cell.cell_type === type ? 'selected' : ''}>${type.charAt(0).toUpperCase() + type.slice(1)}</option>`)
            .join('');
        typeSelect.addEventListener('change', (e) => callbacks.onTypeChange(index, e.target.value));
        
        toolbar.appendChild(typeSelect);
        toolbar.appendChild(this.createButton('Add Above', () => callbacks.onAddCell(index)));
        toolbar.appendChild(this.createButton('Add Below', () => callbacks.onAddCell(index + 1)));
        toolbar.appendChild(this.createButton('🗑️', () => callbacks.onDeleteCell(index)));
        
        return toolbar;
    }

    // Helper function to create buttons
    createButton(text, onClick, className = '') {
        const button = document.createElement('button');
        button.textContent = text;
        button.onclick = onClick;
        if (className) button.className = className;
        return button;
    }

    createSelectArea(index, isSelected, onSelect) {
        const selectArea = document.createElement('div');
        selectArea.className = 'cell-select-area';
        if (isSelected) {
            selectArea.classList.add('selected');
        }
        
        selectArea.addEventListener('click', (e) => {
            const newState = !this.selectionManager?.selectedCells.has(index);
            if (this.selectionManager) {
                this.selectionManager.toggleCellSelection(index, e.shiftKey);
                this.selectionManager.updateCellSelection();
            }
            onSelect(index, e.shiftKey);
        });

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isSelected;
        checkbox.style.display = 'none';
        selectArea.appendChild(checkbox);

        return selectArea;
    }

    createCellContainer(index, toolbar, editor, selectArea) {
        const container = document.createElement('div');
        container.className = 'notebook-cell';
        container.dataset.index = index;
        
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'cell-content-wrapper';
        
        if (toolbar) contentWrapper.appendChild(toolbar);
        if (editor) contentWrapper.appendChild(editor);
        
        container.appendChild(contentWrapper);
        if (selectArea) container.appendChild(selectArea);
        
        return container;
    }

    refreshCell(index) {
        const cellElement = document.querySelector(`.notebook-cell[data-index="${index}"]`);
        if (!cellElement) return;

        const selectArea = cellElement.querySelector('.cell-select-area');
        if (selectArea) {
            const checkbox = selectArea.querySelector('input[type="checkbox"]');
            const isSelected = this.selectionManager?.selectedCells.has(index);
            selectArea.classList.toggle('selected', isSelected);
            if (checkbox) {
                checkbox.checked = isSelected;
            }
        }

        // Update cell appearance based on selection
        cellElement.classList.toggle('selected', this.selectionManager?.selectedCells.has(index));
    }

    updateCellSelection(index, selected) {
        if (this.selectionManager) {
            if (selected) {
                this.selectionManager.selectedCells.add(index);
            } else {
                this.selectionManager.selectedCells.delete(index);
            }
            this.selectionManager.updateCellSelection();
        }
    }
} 