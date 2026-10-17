import React from 'react';
import {
  PlusCircle,
  ArrowRightCircle,
  UserCheck,
  UserX,
  AlertTriangle,
  Edit3,
  MessageSquare,
  Activity as ActivityIcon,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';

export default function ActivityTimeline({ activities = [] }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '24px 0' }}>
        <ActivityIcon size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No activity history recorded yet.</p>
      </div>
    );
  }

  const renderActionContent = (activity) => {
    switch (activity.action) {
      case 'CREATED':
        return <span>Created this work item</span>;

      case 'STATUS_CHANGE':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span>Changed status from</span>
            {activity.oldValue && <StatusBadge status={activity.oldValue} />}
            <span>to</span>
            <StatusBadge status={activity.newValue} />
          </span>
        );

      case 'ASSIGNMENT_CHANGE':
        if (!activity.newValue) {
          return <span>Unassigned the work item</span>;
        }
        return <span>Claimed or assigned this work item</span>;

      case 'PRIORITY_CHANGE':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span>Changed priority from</span>
            {activity.oldValue && <PriorityBadge priority={activity.oldValue} />}
            <span>to</span>
            <PriorityBadge priority={activity.newValue} />
          </span>
        );

      case 'UPDATED':
        return (
          <span>
            Updated <strong>{activity.field}</strong>
          </span>
        );

      case 'COMMENTED':
        return <span>Added a comment</span>;

      default:
        return <span>{activity.action}</span>;
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'CREATED':
        return <PlusCircle size={14} color="#3b82f6" />;
      case 'STATUS_CHANGE':
        return <ArrowRightCircle size={14} color="#8b5cf6" />;
      case 'ASSIGNMENT_CHANGE':
        return <UserCheck size={14} color="#10b981" />;
      case 'PRIORITY_CHANGE':
        return <AlertTriangle size={14} color="#f59e0b" />;
      case 'UPDATED':
        return <Edit3 size={14} color="#6366f1" />;
      case 'COMMENTED':
        return <MessageSquare size={14} color="#06b6d4" />;
      default:
        return <ActivityIcon size={14} color="#64748b" />;
    }
  };

  return (
    <div className="timeline">
      {activities.map((act) => {
        const date = new Date(act.createdAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <div key={act.id} className="timeline-item">
            <div className="timeline-marker">{getActionIcon(act.action)}</div>
            <div className="timeline-header">
              <span className="timeline-author">{act.performedBy?.displayName || 'User'}</span>
              <span className="timeline-time">{date}</span>
            </div>
            <div className="timeline-description">{renderActionContent(act)}</div>
          </div>
        );
      })}
    </div>
  );
}
