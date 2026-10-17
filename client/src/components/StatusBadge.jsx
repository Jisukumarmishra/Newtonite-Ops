import React from 'react';
import { CircleDot, Clock, AlertCircle, CheckCircle2, Archive } from 'lucide-react';

const STATUS_CONFIG = {
  OPEN: {
    label: 'Open',
    icon: CircleDot,
  },
  IN_PROGRESS: {
    label: 'In Progress',
    icon: Clock,
  },
  AWAITING_APPROVAL: {
    label: 'Awaiting Approval',
    icon: AlertCircle,
  },
  RESOLVED: {
    label: 'Resolved',
    icon: CheckCircle2,
  },
  CLOSED: {
    label: 'Closed',
    icon: Archive,
  },
};

export default function StatusBadge({ status, className = '' }) {
  const config = STATUS_CONFIG[status] || { label: status, icon: CircleDot };
  const Icon = config.icon;

  return (
    <span className={`badge badge-status-${status} ${className}`}>
      <Icon size={12} strokeWidth={2.5} />
      <span>{config.label}</span>
    </span>
  );
}
