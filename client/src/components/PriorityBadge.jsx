import React from 'react';
import { ArrowDown, Equal, ArrowUp, Flame } from 'lucide-react';

const PRIORITY_CONFIG = {
  LOW: {
    label: 'Low',
    icon: ArrowDown,
  },
  MEDIUM: {
    label: 'Medium',
    icon: Equal,
  },
  HIGH: {
    label: 'High',
    icon: ArrowUp,
  },
  CRITICAL: {
    label: 'Critical',
    icon: Flame,
  },
};

export default function PriorityBadge({ priority, className = '' }) {
  const config = PRIORITY_CONFIG[priority] || { label: priority, icon: Equal };
  const Icon = config.icon;

  return (
    <span className={`badge badge-priority-${priority} ${className}`}>
      <Icon size={12} strokeWidth={2.5} />
      <span>{config.label}</span>
    </span>
  );
}
