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
  onSelect: (id: string, index: number) => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
  index: number;
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
  index,
}) => {

  return (
    <div 
      className={`notebook-cell ${isSelected ? 'selected' : ''}`}
    >
      <div className="cell-toolbar">
        <div className="cell-actions">
          <span className="cell-index">[{index}]</span>
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
            onChange={() => onSelect(cell.id, index)}
            className="cell-select-checkbox"
          />
        </div>
      </div>
      {cell.cell_type === 'code' ? (
        <CodeCell
          cell={cell}
          onChange={onChange}
        />
      ) : (
        <MarkdownCell
          cell={cell}
          onChange={onChange}
        />
      )}
    </div>
  );
};

export default Cell; 