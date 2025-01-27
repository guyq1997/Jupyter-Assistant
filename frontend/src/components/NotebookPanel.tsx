import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Cell from './Cell';
import { ICell, INotebook, IOutput } from '../types/notebook';
import { websocketService } from '../services/websocket';
import './NotebookPanel.css';
import DiffCell from './DiffCell';
import ChangesSummary from './ChangesSummary';

interface NotebookPanelProps {
  notebook: INotebook;
  onCellsSelected: (cells: ICell[]) => void;
  onSave: (notebookPath: string) => void;
}

const NotebookPanel: React.FC<NotebookPanelProps> = ({ notebook, onCellsSelected, onSave }) => {
  const [cells, setCells] = useState<ICell[]>(notebook.cells);
  const [currentFile, setCurrentFile] = useState<FileSystemFileHandle | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [proposedChanges, setProposedChanges] = useState<any[]>([]);

  // Update cells when notebook changes
  useEffect(() => {
    setCells(notebook.cells);
  }, [notebook]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey) {
        switch (event.key.toLowerCase()) {
          case 'a':
            event.preventDefault();
            handleAcceptAll();
            break;
          case 'r':
            event.preventDefault();
            handleRejectAll();
            break;
          case 's':
            event.preventDefault();
            handleSave();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [proposedChanges]);

  // Handle file change notifications and proposed changes from backend
  useEffect(() => {
    const handleMessage = async (message: any) => {
      if (message.type === 'file_change' && currentFile) {
        try {
          const notebook = JSON.parse(message.content);
          if (notebook.cells) {
            const notebookWithIds = notebook.cells.map((cell: any) => ({
              id: cell.id || uuidv4(),
              cell_type: cell.cell_type,
              source: cell.source
            }));
            setCells(notebookWithIds);
            setIsDirty(false);
          }
        } catch (error) {
          console.error('Error processing file change:', error);
        }
      } else if (message.type === 'propose_changes') {
        // Transform the changes to include IDs and status
        const changesWithIds = message.changes.map((change: any) => ({
          ...change,
          id: uuidv4(),
          status: 'pending' as 'pending' | 'accepted' | 'rejected'
        }));
        setProposedChanges(prev => [...prev, ...changesWithIds]);
      }
    };

    websocketService.addMessageHandler(handleMessage);
    return () => websocketService.removeMessageHandler(handleMessage);
  }, [currentFile]);

  // Update useEffect to handle selected cells changes with index and type
  useEffect(() => {
    const selectedCellsArray = cells
      .map((cell, index) => ({ 
        ...cell, 
        notebookIndex: index,
        cell_type: cell.cell_type // Explicitly include cell_type
      }))
      .filter(cell => selectedCells.has(cell.id));
    onCellsSelected(selectedCellsArray);
  }, [selectedCells, cells, onCellsSelected]);

  const handleCellChange = (id: string, source: string[]) => {
    const updatedCells = cells.map(cell => 
      cell.id === id ? { 
        ...cell, 
        source: source
      } : cell
    );
    
    setCells(updatedCells);
    setIsDirty(true);
  };

  const handleCellTypeChange = (id: string, cell_type: 'code' | 'markdown') => {
    setCells(cells.map(cell => 
      cell.id === id ? { ...cell, cell_type } : cell
    ));
    setIsDirty(true);
  };

  const deleteCell = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this cell?');
    if (!confirmed) return;

    // Find the index of the cell being deleted
    const deletedIndex = cells.findIndex(cell => cell.id === id);
    
    // Update cells
    setCells(cells.filter(cell => cell.id !== id));
    setIsDirty(true);
    
    // Update indices of pending changes
    setProposedChanges(prev => prev.map(change => {
      if (change.status !== 'pending') return change;
      
      // If the change is after the deleted cell, decrease its index
      if (change.index > deletedIndex) {
        return { ...change, index: change.index - 1 };
      }
      return change;
    }));
    
    // Auto-save after deletion
    await handleSave();
  };

  const handleFileOpen = async () => {
    try {
      console.log('Starting file open process...');
      const handle = await window.showOpenFilePicker({
        types: [
          {
            description: 'Jupyter Notebook',
            accept: {
              'application/json': ['.ipynb'],
            },
          },
        ],
        multiple: false,
      });
      
      const fileHandle = handle[0];
      const file = await fileHandle.getFile();
      const text = await file.text();
      
      // Keep all original notebook content when opening
      const notebook = JSON.parse(text) as any;
      if (!notebook.cells) {
        console.error('Invalid notebook format - no cells array found');
        throw new Error('Invalid notebook format');
      }

      // Send the notebook content to the backend with the file path
      await websocketService.send({
        type: 'notebook_opened',
        path: fileHandle.name,
        content: JSON.stringify(notebook),
        timestamp: new Date().toISOString()
      });
      
      // Include outputs when extracting cell data
      const notebookWithIds = notebook.cells.map((cell: any) => {
        // Ensure source is always an array of strings
        let source: string[];
        if (typeof cell.source === 'string') {
          source = [cell.source];
        } else if (Array.isArray(cell.source)) {
          source = cell.source.map((line: any) => 
            typeof line === 'string' ? line : String(line)
          );
        } else {
          source = [''];
        }

        return {
          id: cell.id || uuidv4(),
          cell_type: cell.cell_type || 'markdown',
          source: source,
          outputs: Array.isArray(cell.outputs) ? cell.outputs : [],
          execution_count: cell.execution_count,
          metadata: cell.metadata
        };
      });
      
      setCells(notebookWithIds);
      setCurrentFile(fileHandle);
      setIsDirty(false);
      
      console.log('File loading complete. Cells state updated:', notebookWithIds);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error reading notebook file:', error);
        alert('Failed to open notebook. Please make sure it\'s a valid Jupyter notebook file.');
      }
    }
  };

  const handleSave = async () => {
    try {
      // Keep full content for file saving
      const notebook: INotebook = {
        cells: cells.map(({ id, cell_type, source, outputs }) => ({
          id,
          cell_type,
          source,
          outputs
        })),
        metadata: {
          kernelspec: {
            name: 'python3',
            display_name: 'Python 3',
            language: 'python'
          }
        }
      };

      if (currentFile) {
        const notebookContent = JSON.stringify(notebook, null, 2);
        
        // Save full content to file
        const writable = await currentFile.createWritable();
        await writable.write(notebookContent);
        await writable.close();

        // Send simplified version for syncing
        const simplifiedNotebook = {
          ...notebook,
          cells: notebook.cells.map(cell => ({
            id: cell.id,
            cell_type: cell.cell_type,
            source: cell.source
          }))
        };

        await websocketService.send({
          type: 'notebook_updated',
          path: currentFile.name,
          content: JSON.stringify(simplifiedNotebook),
          timestamp: new Date().toISOString()
        });

        onSave(currentFile.name);
        setIsDirty(false);
      } else {
        // Save as new file
        const handle = await window.showSaveFilePicker({
          types: [
            {
              description: 'Jupyter Notebook',
              accept: {
                'application/json': ['.ipynb'],
              },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(notebook, null, 2));
        await writable.close();
        setCurrentFile(handle);
        
        onSave(handle.name);
      }
      setIsDirty(false);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error saving notebook:', error);
        alert('Failed to save notebook. Please try again.');
      }
    }
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

      const items = event.dataTransfer.items;
      if (items) {
        const item = items[0];
        if (item.kind === 'file') {
          try {
            const handle = await (item.getAsFileSystemHandle() as Promise<FileSystemFileHandle>);
            if (!handle.name.endsWith('.ipynb')) {
              alert('Please drop a valid Jupyter notebook file (.ipynb)');
              return;
            }

            const file = await handle.getFile();
            const text = await file.text();
            const notebook = JSON.parse(text) as INotebook;
            
            if (!notebook.cells) {
              throw new Error('Invalid notebook format');
            }

            const notebookWithIds = notebook.cells.map(cell => ({
              id: cell.id || uuidv4(),
              cell_type: cell.cell_type || 'markdown',
              source: Array.isArray(cell.source) ? cell.source : [cell.source || ''],
              outputs: cell.outputs || [],
              execution_count: cell.execution_count,
              metadata: cell.metadata
            }));

            setCells(notebookWithIds);
            setCurrentFile(handle);
            setIsDirty(false);
          } catch (error) {
            console.error('Error reading notebook file:', error);
            alert('Failed to open notebook. Please make sure it\'s a valid Jupyter notebook file.');
          }
        }
      }
    };

    const handleDragOver = (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const toggleCellSelection = (id: string) => {
      setSelectedCells(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(id)) {
          newSelection.delete(id);
        } else {
          newSelection.add(id);
        }
        return newSelection;
      });
    };

    const handleContentChange = async (newContent: string) => {
      try {
        if (!currentFile) return;
        
        // Update the original file
        const writable = await currentFile.createWritable();
        await writable.write(newContent);
        await writable.close();
        
      } catch (error) {
        console.error('Error updating file:', error);
      }
    };

    const handleAcceptChange = async (changeId: string) => {
      // Get all changes up to and including the current change
      const allChanges = proposedChanges.filter(change => change.status === 'pending');
      const currentChangeIndex = allChanges.findIndex(change => change.id === changeId);
      const changesToApply = allChanges.slice(0, currentChangeIndex + 1);
      
      // Apply changes in sequence
      const updatedCells = [...cells];
      
      changesToApply.forEach(change => {
        const targetIndex = change.index;
        
        // Only handle update type
        if (targetIndex < updatedCells.length) {
          updatedCells[targetIndex] = {
            ...updatedCells[targetIndex],
            source: Array.isArray(change.new_content) 
              ? change.new_content 
              : [change.new_content],
            cell_type: change.cell_type
          };
        }
      });
      
      setCells(updatedCells);
      setIsDirty(true);

      // Update the status of all applied changes
      setProposedChanges(prev => 
        prev.map(change => {
          if (changesToApply.some(c => c.id === change.id)) {
            return { ...change, status: 'accepted' };
          }
          return change;
        }).filter(change => change.status === 'pending')
      );

      // Notify backend
      websocketService.send({
        type: 'change_accepted',
        changeId: changeId,
        timestamp: new Date().toISOString()
      });

      // Auto-save after accepting the change
      await handleSave();
    };

    const handleRejectChange = (changeId: string) => {
      setProposedChanges(prev => prev.filter(change => change.id !== changeId));
      
      // Notify backend
      websocketService.send({
        type: 'change_rejected',
        changeId: changeId,
        timestamp: new Date().toISOString()
      });
    };

    const handleAcceptAll = () => {
      const pendingChanges = proposedChanges.filter(change => change.status === 'pending');
      pendingChanges.forEach(change => handleAcceptChange(change.id));
    };

    const handleRejectAll = () => {
      const pendingChanges = proposedChanges.filter(change => change.status === 'pending');
      pendingChanges.forEach(change => handleRejectChange(change.id));
    };

    const addCell = async (index: number, position: 'above' | 'below') => {
      const newCell: ICell = {
        id: uuidv4(),
        cell_type: 'code',
        source: [''],  // Initialize with an empty string in array
        outputs: []
      };

      const newIndex = position === 'above' ? index : index + 1;
      const updatedCells = [
        ...cells.slice(0, newIndex),
        newCell,
        ...cells.slice(newIndex)
      ];
      
      setCells(updatedCells);
      setIsDirty(true);
      
      // Update indices of pending changes
      setProposedChanges(prev => prev.map(change => {
        if (change.status !== 'pending') return change;
        
        // If the change is at or after the insertion point, increase its index
        if (change.index >= newIndex) {
          return { ...change, index: change.index + 1 };
        }
        return change;
      }));
      
      // Auto-save after adding new cell
      await handleSave();
    };

    return (
      <div 
        className="notebook-panel"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="notebook-toolbar">
          <button 
            className="save-button"
            onClick={handleSave} 
            disabled={!isDirty}
          >
            {isDirty ? "Save Changes" : "Saved"}
          </button>
          <button onClick={handleFileOpen} className="toolbar-button">
            Open
          </button>
        </div>

        {proposedChanges.length > 0 && (
          <ChangesSummary
            changes={proposedChanges}
            onAcceptAll={handleAcceptAll}
            onRejectAll={handleRejectAll}
          />
        )}

        <div className="notebook-content">
          {cells.map((cell, index) => {
            const pendingChange = proposedChanges.find(
              change => change.index === index && 
                       change.status === 'pending' && 
                       change.type === 'update'
            );

            if (pendingChange) {
              return (
                <DiffCell
                  key={pendingChange.id}
                  oldCell={cell}
                  newCell={{
                    id: uuidv4(),
                    cell_type: pendingChange.cell_type,
                    source: Array.isArray(pendingChange.new_content) 
                      ? pendingChange.new_content 
                      : [pendingChange.new_content]
                  }}
                  changeType="update"
                  onAccept={() => handleAcceptChange(pendingChange.id)}
                  onReject={() => handleRejectChange(pendingChange.id)}
                />
              );
            }

            return (
              <Cell
                key={cell.id}
                cell={cell}
                onChange={(source) => handleCellChange(cell.id, source)}
                onTypeChange={(type) => handleCellTypeChange(cell.id, type)}
                onDelete={() => deleteCell(cell.id)}
                isSelected={selectedCells.has(cell.id)}
                onSelect={() => toggleCellSelection(cell.id)}
                onAddAbove={() => addCell(index, 'above')}
                onAddBelow={() => addCell(index, 'below')}
              />
            );
          })}
        </div>
      </div>
    );
  }

NotebookPanel.displayName = 'NotebookPanel';

export default NotebookPanel; 