import React, { useEffect, useState } from 'react';
import './ChangesNavigator.css';

interface ChangesNavigatorProps {
  changes: Array<{
    id: string;
    type: 'add' | 'delete' | 'update';
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
  const [groups, setGroups] = useState<Array<{
    startIndex: number;
    endIndex: number;
    changes: typeof changes;
  }>>([]);

  // Group nearby changes together
  useEffect(() => {
    const pendingChanges = changes.filter(c => c.status === 'pending')
      .sort((a, b) => a.index - b.index);

    const newGroups = [];
    let currentGroup = {
      startIndex: -1,
      endIndex: -1,
      changes: [] as typeof changes
    };

    for (const change of pendingChanges) {
      if (currentGroup.startIndex === -1) {
        currentGroup.startIndex = change.index;
        currentGroup.endIndex = change.index;
        currentGroup.changes = [change];
      } else if (change.index <= currentGroup.endIndex + 3) {
        // Group changes that are within 3 lines of each other
        currentGroup.endIndex = Math.max(currentGroup.endIndex, change.index);
        currentGroup.changes.push(change);
      } else {
        newGroups.push({ ...currentGroup });
        currentGroup = {
          startIndex: change.index,
          endIndex: change.index,
          changes: [change]
        };
      }
    }

    if (currentGroup.startIndex !== -1) {
      newGroups.push(currentGroup);
    }

    setGroups(newGroups);
  }, [changes]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowUp' && event.altKey) {
      event.preventDefault();
      const prevGroup = groups.findIndex(g => g.endIndex >= currentIndex) - 1;
      if (prevGroup >= 0) {
        onNavigate(groups[prevGroup].startIndex);
      }
    } else if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      const nextGroup = groups.findIndex(g => g.startIndex > currentIndex);
      if (nextGroup !== -1) {
        onNavigate(groups[nextGroup].startIndex);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown as any);
    return () => window.removeEventListener('keydown', handleKeyDown as any);
  }, [groups, currentIndex]);

  if (groups.length === 0) return null;

  return (
    <div className="changes-navigator">
      <div className="navigator-header">
        Changes Navigator
        <div className="navigator-shortcuts">
          Alt + ↑/↓ to navigate
        </div>
      </div>
      <div className="change-groups">
        {groups.map((group, index) => (
          <div
            key={group.changes[0].id}
            className={`change-group ${
              currentIndex >= group.startIndex && currentIndex <= group.endIndex
                ? 'active'
                : ''
            }`}
            onClick={() => onNavigate(group.startIndex)}
          >
            <div className="group-indicator">
              <div className="group-line" />
              <div className="group-count">
                {group.changes.length} change{group.changes.length > 1 ? 's' : ''}
              </div>
            </div>
            <div className="group-summary">
              Lines {group.startIndex + 1}-{group.endIndex + 1}
              <div className="group-types">
                {group.changes.map(c => (
                  <span key={c.id} className={`type-indicator ${c.type}`}>
                    {c.type === 'add' && '+'}
                    {c.type === 'delete' && '-'}
                    {c.type === 'update' && '↻'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChangesNavigator; 