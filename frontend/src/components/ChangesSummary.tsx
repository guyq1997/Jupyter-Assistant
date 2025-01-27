import React from 'react';
import './ChangesSummary.css';

interface ChangesSummaryProps {
  changes: Array<{
    type: 'update';
    status: 'pending' | 'accepted' | 'rejected';
  }>;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

const ChangesSummary: React.FC<ChangesSummaryProps> = ({
  changes,
  onAcceptAll,
  onRejectAll
}) => {
  const pendingChanges = changes.filter(c => c.status === 'pending');
  const updateCount = pendingChanges.length;

  if (pendingChanges.length === 0) {
    return null;
  }

  return (
    <div className="changes-summary">
      <div className="changes-stats">
        <div className="stat-item">
          <span className="stat-icon update">↻</span>
          <span className="stat-count">{updateCount}</span>
          <span className="stat-label">Modified</span>
        </div>
      </div>
      
      <div className="batch-actions">
        <button 
          className="batch-action accept-all"
          onClick={onAcceptAll}
          title="Accept all changes (Alt+A)"
        >
          <span className="icon">✓</span>
          Accept All
        </button>
        <button 
          className="batch-action reject-all"
          onClick={onRejectAll}
          title="Reject all changes (Alt+R)"
        >
          <span className="icon">✕</span>
          Reject All
        </button>
      </div>
    </div>
  );
};

export default ChangesSummary; 