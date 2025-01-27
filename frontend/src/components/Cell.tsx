import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import { githubGist } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { ICell, IOutput } from '../types/notebook';
import './MarkdownCell.css';
import './CodeCell.css';
import CodeCell from './CodeCell';
import MarkdownCell from './MarkdownCell';
import './Cell.css';
import { FaTrash } from 'react-icons/fa';

interface CellProps {
  cell: ICell;
  onChange: (source: string[]) => void;
  onTypeChange: (cell_type: 'code' | 'markdown') => void;
  onDelete: () => void;
  isSelected: boolean;
  onSelect: () => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
  onRemove: () => void;
}

// Register Python language
SyntaxHighlighter.registerLanguage('python', python);

const Cell: React.FC<CellProps> = ({ 
  cell, 
  onChange, 
  onTypeChange, 
  onDelete,
  isSelected,
  onSelect,
  onAddAbove,
  onAddBelow,
  onRemove
}) => {
  const [isEditing, setIsEditing] = useState(!cell.source.length && cell.cell_type === 'markdown');
  const textareaRef = useRef<HTMLTextAreaElement>(null);



  // Auto-resize textarea function
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // 先保存当前光标位置
      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;
      
      textarea.style.height = '0';  // 先重置高度
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${scrollHeight}px`;
      
      // 恢复光标位置
      textarea.setSelectionRange(selectionStart, selectionEnd);
    }
  };

  // Adjust height on mount and content change
  useEffect(() => {
    adjustTextareaHeight();
  }, [cell.source, isEditing]);

  // Also adjust height when switching to edit mode
  useEffect(() => {
    if (isEditing) {
      adjustTextareaHeight();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (cell.cell_type === 'markdown') {
      setIsEditing(true);
      if (!isSelected) {
        onSelect();
      }
    }
  };

  return (
    <div 
      className={`notebook-cell ${isSelected ? 'selected' : ''}`}
      onDoubleClick={handleDoubleClick}
    >
      <div className="cell-toolbar">
        <div className="cell-actions">
          <select 
            className="cell-type-select"
            value={cell.cell_type}
            onChange={(e) => onTypeChange(e.target.value as 'code' | 'markdown')}
          >
            <option value="code">Code</option>
            <option value="markdown">Markdown</option>
          </select>
          <button onClick={onAddAbove} className="cell-action-button" title="Add cell above">
            Add Cell Above
          </button>
          <button onClick={onAddBelow} className="cell-action-button" title="Add cell below">
            Add Cell Below
          </button>
          <button className="cell-action-button" onClick={onDelete} title="Delete">
            <FaTrash />
          </button>

        </div>
        <div className="cell-select">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="cell-select-checkbox"
          />
        </div>
      </div>
      {cell.cell_type === 'code' ? (
        <CodeCell
          cell={cell}
          onChange={onChange}
          isSelected={isSelected}
          onSelect={onSelect}
          onAddAbove={onAddAbove}
          onAddBelow={onAddBelow}
          onDelete={onDelete}
          onTypeChange={() => onTypeChange('markdown')}
        />
      ) : (
        <MarkdownCell
          cell={cell}
          onChange={onChange}
          isSelected={isSelected && isEditing}
          onSelect={onSelect}
          onAddAbove={onAddAbove}
          onAddBelow={onAddBelow}
          onDelete={onDelete}
          onTypeChange={() => onTypeChange('code')}
        />
      )}
    </div>
  );
};

export default Cell; 