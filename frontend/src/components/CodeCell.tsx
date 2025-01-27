import React, { useRef, useEffect } from 'react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import { githubGist } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { ICell } from '../types/notebook';
import './CodeCell.css';

// Register Python language
SyntaxHighlighter.registerLanguage('python', python);

interface CodeCellProps {
  cell: ICell;
  onChange: (source: string[]) => void;
  isSelected: boolean;
  onSelect: () => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
  onDelete: () => void;
  onTypeChange: () => void;
}

const CodeCell: React.FC<CodeCellProps> = ({
  cell,
  onChange,
  isSelected,
  onSelect
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const codeEditorRef = useRef<HTMLDivElement>(null);
  const cellContentRef = useRef<HTMLDivElement>(null);

  // Function to safely join source content
  const getSourceContent = () => {
    if (!cell.source) return '';
    const content = Array.isArray(cell.source) ? cell.source.join('') : String(cell.source);
    return content;
  };

  // Improved auto-resize textarea function
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Set a minimum height
      const lineHeight = 20; // Approximate line height
      const padding = 16; // Total vertical padding (8px top + 8px bottom)
      const lines = textarea.value.split('\n').length;
      const calculatedHeight = Math.max(60, lines * lineHeight + padding);
      
      textarea.style.height = `${calculatedHeight}px`;
      
      // Also adjust the code editor container
      if (codeEditorRef.current) {
        codeEditorRef.current.style.height = `${calculatedHeight}px`;
      }
    }
  };

  // Call adjustTextareaHeight whenever the content changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [cell.source]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    onChange([newValue]);
    // Height will be adjusted in the useEffect
  };

  // 添加点击事件处理
  const handleClick = () => {
    console.log('CodeCell - Click event', {
      textareaExists: textareaRef.current !== null,
      editorExists: codeEditorRef.current !== null,
      content: getSourceContent()
    });
  };


  return (
    <div 
      ref={cellContentRef}
      className="cell-content"
      onClick={handleClick}
    >
      <div 
        ref={codeEditorRef}
        className="code-editor"
      >
        <textarea
          ref={textareaRef}
          className="code-textarea"
          value={getSourceContent()}
          onChange={handleChange}
          spellCheck={false}
        />
        <div className="syntax-highlight-layer">
          <SyntaxHighlighter
            language="python"
            style={githubGist}
            customStyle={{
              margin: 0,
              padding: '8px',
              background: 'transparent'
            }}
          >
            {getSourceContent()}
          </SyntaxHighlighter>
        </div>
      </div>
      {cell.outputs?.map((output, index) => (
        <div key={index} className="output">
          {output.text && <pre>{output.text.join('')}</pre>}
        </div>
      ))}
    </div>
  );
};

export default CodeCell; 