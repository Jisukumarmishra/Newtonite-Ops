import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import { User, GitCommit } from 'lucide-react';

export default function WorkItemCard({ item }) {
  const navigate = useNavigate();

  const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className="work-item-card"
      onClick={() => navigate(`/work-items/${item.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          navigate(`/work-items/${item.id}`);
        }
      }}
    >
      <div className="work-item-card-header">
        <h3 className="work-item-card-title">{item.title}</h3>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          <PriorityBadge priority={item.priority} />
          <StatusBadge status={item.status} />
        </div>
      </div>

      {item.description && (
        <p className="work-item-card-desc">{item.description}</p>
      )}

      <div className="work-item-card-footer">
        <div className="assignee-badge">
          {item.assignedTo ? (
            <>
              <div className="assignee-avatar-sm" title={item.assignedTo.displayName}>
                {item.assignedTo.displayName ? item.assignedTo.displayName.charAt(0).toUpperCase() : 'U'}
              </div>
              <span>{item.assignedTo.displayName}</span>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <User size={13} /> Unassigned
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="badge-version" title={`Optimistic Lock Version ${item.version}`}>
            <GitCommit size={11} /> v{item.version}
          </span>
          <span>{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}
