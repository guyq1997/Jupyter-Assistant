import React from 'react';
import { ICell } from '../types/notebook';
import './DiffCell.css';

interface DiffCellProps {
  oldCell?: ICell;
  newCell?: ICell;
  changeType: 'add' | 'delete' | 'update';
  onAccept: () => void;
  onReject: () => void;
}

const DiffCell: React.FC<DiffCellProps> = ({
  oldCell,
  newCell,
  changeType,
  onAccept,
  onReject
}) => {
  const renderDiffContent = () => {
    if (changeType === 'add') {
      return (
        <div className="diff-content diff-add">
          <div className="cell-type-label">{newCell?.cell_type}</div>
          <pre className="diff-text">{newCell?.source.join('\n')}</pre>
        </div>
      );
    }

    if (changeType === 'delete') {
      return (
        <div className="diff-content diff-delete">
          <div className="cell-type-label">{oldCell?.cell_type}</div>
          <pre className="diff-text">{oldCell?.source.join('\n')}</pre>
        </div>
      );
    }

    if (changeType === 'update' && oldCell && newCell) {
      const oldLines = oldCell.source;
      const newLines = newCell.source;
      const maxLines = Math.max(oldLines.length, newLines.length);
      
      return (
        <div className="diff-content diff-update">
          <div className="cell-type-label">
            {oldCell.cell_type} → {newCell.cell_type}
          </div>
          <div className="diff-lines">
            {Array.from({ length: maxLines }).map((_, i) => (
              <div key={i} className="diff-line">
                {oldLines[i] !== newLines[i] && (
                  <>
                    {oldLines[i] && (
                      <pre className="diff-text diff-old">{oldLines[i]}</pre>
                    )}
                    {newLines[i] && (
                      <pre className="diff-text diff-new">{newLines[i]}</pre>
                    )}
                  </>
                )}
                {oldLines[i] === newLines[i] && (
                  <pre className="diff-text diff-unchanged">{oldLines[i]}</pre>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`diff-cell diff-${changeType}`}>
      <div className="diff-header">
        <div className="diff-type">
          {changeType === 'add' && 'New Cell'}
          {changeType === 'delete' && 'Deleted Cell'}
          {changeType === 'update' && 'Modified Cell'}
        </div>
        <div className="diff-actions">
          <button className="diff-action accept" onClick={onAccept}>
            <span className="icon">✓</span>
            Accept
          </button>
          <button className="diff-action reject" onClick={onReject}>
            <span className="icon">✕</span>
            Reject
          </button>
        </div>
      </div>
      {renderDiffContent()}
    </div>
  );
};

export default DiffCell; 