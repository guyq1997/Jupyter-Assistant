import React from 'react';
import './ChangesNavigator.css';

interface ChangesNavigatorProps {
  changes: Array<{
    id: string;
    type: 'update';
    index: number;
    status: 'pending' | 'accepted' | 'rejected';
  }>;
  currentIndex: number;
  onNavigate: (index: number) => void;
}

const ChangesNavigator: React.FC<ChangesNavigatorProps> = ({
  changes,
  currentIndex,
  onNavigate
}) => {
  const pendingChanges = changes.filter(c => c.status === 'pending')
    .sort((a, b) => a.index - b.index);

  if (pendingChanges.length === 0) return null;

  return (
    <div className="changes-navigator">
      <div className="navigator-header">
        Changes Navigator
      </div>
      <div className="change-groups">
        {pendingChanges.map((change) => (
          <div
            key={change.id}
            className={`change-group ${currentIndex === change.index ? 'active' : ''}`}
            onClick={() => onNavigate(change.index)}
          >
            <div className="group-summary">
              Line {change.index + 1}
              <div className="group-types">
                <span className="type-indicator update">↻</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChangesNavigator; 