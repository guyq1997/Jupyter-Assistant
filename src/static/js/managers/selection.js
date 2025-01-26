export class SelectionManager {
    constructor() {
        this.selectedCells = new Set();
        this.notebook = null;
    }

    // Set notebook reference
    setNotebook(notebook) {
        this.notebook = notebook;
    }

    // Get selected cells content
    getSelectedCellsContent() {
        if (!this.notebook) return '';
        
        const selectedContent = [];
        Array.from(this.selectedCells).sort((a, b) => a - b).forEach(index => {
            const cell = this.notebook.cells[index];
            if (cell) {
                selectedContent.push({
                    index: index,
                    type: cell.cell_type,
                    content: Array.isArray(cell.source) ? cell.source.join('') : cell.source
                });
            }
        });
        
        if (selectedContent.length === 0) return '';
        
        return selectedContent.map(cell => 
            `<cell_${cell.index}_${cell.type}>\n${cell.content}\n</cell_${cell.index}_${cell.type}>`
        ).join('\n\n');
    }

    // Toggle cell selection
    toggleCellSelection(index, isShiftKey) {
        const lastSelected = Array.from(this.selectedCells).pop();
        
        if (isShiftKey && lastSelected !== undefined) {
            const start = Math.min(lastSelected, index);
            const end = Math.max(lastSelected, index);
            for (let i = start; i <= end; i++) {
                this.selectedCells.add(i);
            }
        } else {
            if (this.selectedCells.has(index)) {
                this.selectedCells.delete(index);
            } else {
                this.selectedCells.add(index);
            }
        }
    }

    // Update cell selection UI
    updateCellSelection() {
        document.querySelectorAll('.notebook-cell').forEach(cell => {
            const index = parseInt(cell.dataset.cellIndex);
            const isSelected = this.selectedCells.has(index);
            cell.classList.toggle('selected', isSelected);
            
            const selectArea = cell.querySelector('.cell-select-area');
            if (selectArea) {
                selectArea.classList.toggle('selected', isSelected);
                selectArea.innerHTML = isSelected ? '☒' : '☐';
            }
        });
        
        this.updateSelectedCellsDisplay();
    }

    // Update selected cells display
    updateSelectedCellsDisplay() {
        const container = document.getElementById('selected-cells');
        if (!container || !this.notebook) return;
        
        container.innerHTML = '';
        
        Array.from(this.selectedCells).sort((a, b) => a - b).forEach(index => {
            const cell = this.notebook.cells[index];
            if (!cell) return;
            
            const tag = document.createElement('div');
            tag.className = 'selected-cell-tag';
            tag.innerHTML = `
                Cell ${index} (${cell.cell_type})
                <span class="remove" onclick="window.notebookFunctions.removeSelectedCell(${index})">×</span>
            `;
            container.appendChild(tag);
        });
    }

    // Remove selected cell
    removeSelectedCell(index) {
        this.selectedCells.delete(index);
        this.updateCellSelection();
    }

    // Clear all selections
    clear() {
        this.selectedCells.clear();
    }
}
