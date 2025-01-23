export class CellManager {
    constructor(notebook = null) {
        this.notebook = notebook;
    }

    setNotebook(notebook) {
        this.notebook = notebook;
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
        if (!this.notebook) return;
        this.notebook.cells.splice(index, 0, this.createNewCell(type));
        return this.notebook;
    }

    // Delete cell at index
    deleteCell(index) {
        if (!this.notebook) return;
        this.notebook.cells.splice(index, 1);
        return this.notebook;
    }

    // Move cell up or down
    moveCell(index, direction) {
        if (!this.notebook) return;
        
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= this.notebook.cells.length) return;
        
        const cell = this.notebook.cells[index];
        this.notebook.cells.splice(index, 1);
        this.notebook.cells.splice(newIndex, 0, cell);
        return this.notebook;
    }

    // Change cell type
    changeCellType(index, newType) {
        if (!this.notebook) return;
        
        const cell = this.notebook.cells[index];
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
        
        return this.notebook;
    }

    // Create cell toolbar
    createCellToolbar(cell, index, callbacks) {
        const toolbar = document.createElement('div');
        toolbar.className = 'cell-toolbar';
        
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
} 