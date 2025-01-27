import React from 'react';
import { ICell } from '../types/notebook';
import './DiffCell.css';

interface DiffCellProps {
  oldCell?: ICell;
  newCell?: ICell;
  changeType: 'update';
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
    if (oldCell && newCell) {
      const oldLines = oldCell.source;
      const newLines = newCell.source;
      console.log('Old Lines:', oldLines);
      console.log('New Lines:', newLines);
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
    <div className="diff-cell diff-update">
      <div className="diff-header">
        <div className="diff-type">Modified Cell</div>
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