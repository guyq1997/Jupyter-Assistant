import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ICell } from '../types/notebook';
import './MarkdownCell.css';

interface MarkdownCellProps {
  cell: ICell;
  onChange: (source: string[]) => void;
  isSelected: boolean;
  onSelect: () => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
  onDelete: () => void;
  onTypeChange: () => void;
}

const MarkdownCell: React.FC<MarkdownCellProps> = ({
  cell,
  onChange,
  isSelected,
  onSelect,
  onAddAbove,
  onAddBelow,
  onDelete,
  onTypeChange
}) => {
  const [isEditing, setIsEditing] = useState(!cell.source.length);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Function to safely join source content
  const getSourceContent = () => {
    if (!cell.source) return '';
    return Array.isArray(cell.source) ? cell.source.join('') : String(cell.source);
  };

  // Function to safely update source content
  const handleSourceChange = (value: string) => {
    onChange([value]);
    requestAnimationFrame(adjustTextareaHeight);
  };

  // Auto-resize textarea function
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;
      textarea.style.height = '0';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${scrollHeight}px`;
      textarea.setSelectionRange(selectionStart, selectionEnd);
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [cell.source, isEditing]);

  const handleDoubleClick = () => {
    if (cell.cell_type === 'markdown') {
      setIsEditing(true);
      if (!isSelected) {
        onSelect();
      }
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && cell.cell_type === 'markdown') {
      // 移除此行，以防止按下Escape键取消编辑模式
    }
    if (e.key === 'Enter' && e.shiftKey && cell.cell_type === 'markdown') {
      e.preventDefault();
      setIsEditing(false);
    }
  };

  return (
    <div className="markdown-cell">
      <div className="cell-content" onDoubleClick={handleDoubleClick}>
        {isEditing ? (
          <div className="cell-editor">
            <textarea
              ref={textareaRef}
              value={getSourceContent()}
              onChange={(e) => handleSourceChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter markdown..."
              className="cell-textarea"
              autoFocus
            />
          </div>
        ) : (
          <div className="cell-preview markdown-preview">
            <ReactMarkdown>{getSourceContent() || ' '}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkdownCell; 