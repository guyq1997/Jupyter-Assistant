import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './CollapsibleCodeBlock.css';

interface CollapsibleCodeBlockProps {
  language: string;
  value: string;
}

const CollapsibleCodeBlock: React.FC<CollapsibleCodeBlockProps> = ({ language, value }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => setIsOpen(!isOpen);

  return (
    <div className="collapsible-code-block">
      <button className="toggle-button" onClick={toggleOpen}>
        {isOpen ? `Hide Code (${language})` : `Show Code (${language})`}
      </button>
      {isOpen && (
        <SyntaxHighlighter language={language} style={coy} className="code-block">
          {value}
        </SyntaxHighlighter>
      )}
    </div>
  );
};

export default CollapsibleCodeBlock;