import { NotebookUIBase } from './NotebookUIBase.js';

export class CellUIManager extends NotebookUIBase {
    createCellContainer(index, toolbar, editor, selectArea) {
        console.log('CellUIManager: createCellContainer called for index:', index);
        
        const cellDiv = document.createElement('div');
        cellDiv.className = 'notebook-cell';
        cellDiv.dataset.cellIndex = index;
        
        const cellData = this.getNotebookCell(index);
        const cellType = cellData?.cell_type || 'code';
        console.log('CellUIManager: Cell type:', cellType);
        
        cellDiv.classList.add(cellType === 'markdown' ? 'markdown-cell' : 'code-cell');
        
        if (this.pendingDeletions?.has(index)) {
            cellDiv.classList.add('pending-deletion');
        }

        if (this.pendingAdditions?.has(index)) {
            cellDiv.classList.add('pending-addition');
        }
        
        const cellContentWrapper = document.createElement('div');
        cellContentWrapper.className = 'cell-content-wrapper';
        
        if (toolbar) cellContentWrapper.appendChild(toolbar);
        
        if ((this.pendingAdditions?.has(index) || this.pendingChanges?.has(index)) && this.createDiffView) {
            const diffView = this.createDiffView(index);
            if (diffView) {
                cellContentWrapper.appendChild(diffView);
            }
        } else if (editor instanceof Node) {
            cellContentWrapper.appendChild(editor);
        }
        
        cellDiv.appendChild(cellContentWrapper);
        if (selectArea) cellDiv.appendChild(selectArea);
        
        return cellDiv;
    }

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

    refreshCell(index) {
        console.log('CellUIManager: Refreshing cell at index:', index);
        
        if (!this.validateEditorManager()) return;

        const cellData = this.getNotebookCell(index);
        if (!cellData) {
            console.error('CellUIManager: Invalid cell data for index:', index);
            return;
        }

        // Find or create cell container
        let cell = document.querySelector(`.notebook-cell[data-cell-index="${index}"]`);
        const notebookContent = document.getElementById('notebook-content');
        
        // Get or create editor
        let editor = this.editorManager.editors.get(index);
        if (!editor) {
            editor = this.editorManager.createEditor(cellData, index, (newContent) => {
                if (this.getNotebookCell(index)) {
                    this.getNotebookCell(index).source = newContent;
                }
            });
            this.editorManager.editors.set(index, editor);
        }

        // Create toolbar and select area
        const toolbar = cell?.querySelector('.cell-toolbar') || 
            (window.notebookFunctions?.cellManager ? 
                window.notebookFunctions.cellManager.createCellToolbar(cellData, index, {
                    onTypeChange: (idx, type) => window.notebookFunctions.changeCellType(idx, type),
                    onAddCell: (idx) => window.notebookFunctions.addCell('code', idx),
                    onDeleteCell: (idx) => window.notebookFunctions.deleteCell(idx)
                }) : null);

        const selectArea = cell?.querySelector('.cell-select-area') || 
            this.createSelectArea(
                index,
                false,
                (idx, shiftKey) => {
                    if (window.notebookFunctions?.selectionManager) {
                        window.notebookFunctions.selectionManager.toggleCellSelection(idx, shiftKey);
                        window.notebookFunctions.selectionManager.updateCellSelection();
                    }
                }
            );

        // Create and insert new cell
        const newCell = this.createCellContainer(index, toolbar, editor, selectArea);
        
        if (cell) {
            cell.replaceWith(newCell);
        } else {
            this.insertCellInOrder(notebookContent, newCell, index);
        }
        
        if (editor?.layout) {
            editor.layout();
        }
    }

    insertCellInOrder(container, newCell, index) {
        const cells = container.querySelectorAll('.notebook-cell');
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
            container.appendChild(newCell);
        }
    }
} 