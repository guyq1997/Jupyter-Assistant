import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import { githubGist } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { ICell, IOutput } from '../types/notebook';
import './Cell.css';

interface CellProps {
  cell: ICell;
  onChange: (source: string) => void;
  onTypeChange: (cell_type: 'code' | 'markdown') => void;
  onDelete: () => void;
  isSelected: boolean;
  onSelect: () => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
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
  onAddBelow
}) => {
  const [isEditing, setIsEditing] = useState(!cell.source.length && cell.cell_type === 'markdown');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea function
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto first to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Add extra padding to ensure all content is visible
      textarea.style.height = `${textarea.scrollHeight + 2}px`;
      // Force a reflow
      textarea.scrollTop = 0;
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
    // Only handle double click for markdown cells
    if (cell.cell_type === 'markdown') {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    // Only handle blur for markdown cells
    if (cell.cell_type === 'markdown') {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && cell.cell_type === 'markdown') {
      setIsEditing(false);
    }
    // Add handling for Shift+Enter
    if (e.key === 'Enter' && e.shiftKey && cell.cell_type === 'markdown') {
      e.preventDefault(); // Prevent default behavior
      setIsEditing(false);
    }
  };

  const renderOutput = (output: IOutput) => {
    if (output.output_type === 'stream' && output.text) {
      return <pre className="output-content">{output.text.join('')}</pre>;
    } else if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
      if (output.data?.['text/html']) {
        return <div dangerouslySetInnerHTML={{ __html: output.data['text/html'].join('') }} />;
      } else if (output.data?.['text/plain']) {
        return <pre className="output-content">{output.data['text/plain'].join('')}</pre>;
      }
    }
    return null;
  };

  return (
    <div className={`notebook-cell ${cell.cell_type}-cell ${isSelected ? 'selected' : ''}`}>
      <div className="cell-select">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="cell-select-checkbox"
        />
      </div>
      <div className="cell-toolbar">
        <div className="cell-actions">
          <button onClick={onAddAbove} className="cell-action-button" title="Add cell above">
            <span className="button-icon">⬆️</span>
          </button>
          <button onClick={onAddBelow} className="cell-action-button" title="Add cell below">
            <span className="button-icon">⬇️</span>
          </button>
          <select
            className="cell-type-select"
            value={cell.cell_type}
            onChange={(e) => onTypeChange(e.target.value as 'code' | 'markdown')}
          >
            <option value="code">Code</option>
            <option value="markdown">Markdown</option>
          </select>
          <button className="cell-action-btn" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
      
      <div className="cell-content" onDoubleClick={handleDoubleClick}>
        {cell.cell_type === 'code' ? (
          <div className="cell-editor code-editor">
            <div className="syntax-highlight-layer">
              <SyntaxHighlighter
                language="python"
                style={githubGist}
                customStyle={{
                  background: 'transparent',
                  padding: '4px 8px',
                  margin: '0',
                  fontSize: '14px',
                  lineHeight: '1.4',
                  fontFamily: "'Fira Code', 'Consolas', monospace",
                }}
              >
                {cell.source.join('') || ' '}
              </SyntaxHighlighter>
            </div>
            <textarea
              ref={textareaRef}
              value={cell.source.join('')}
              onChange={(e) => {
                onChange(e.target.value);
                adjustTextareaHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter code..."
              className="cell-textarea code-textarea"
              spellCheck="false"
              autoCorrect="off"
              autoCapitalize="off"
              autoComplete="off"
              data-gramm="false"
              data-gramm_editor="false"
              data-enable-grammarly="false"
            />
          </div>
        ) : isEditing ? (
          // Markdown cells in edit mode
          <div className="cell-editor">
            <textarea
              ref={textareaRef}
              value={cell.source.join('')}
              onChange={(e) => {
                onChange(e.target.value);
                adjustTextareaHeight();
              }}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="Enter markdown..."
              className="cell-textarea"
              autoFocus
            />
          </div>
        ) : (
          // Markdown cells in preview mode
          <div className="cell-preview markdown-preview">
            <ReactMarkdown>{cell.source.join('') || ' '}</ReactMarkdown>
          </div>
        )}
      </div>
      
      {cell.cell_type === 'code' && cell.outputs && cell.outputs.length > 0 && (
        <div className="cell-output">
          {cell.outputs.map((output, index) => (
            <div key={index} className="output-item">
              {renderOutput(output)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Cell; 