import React from 'react';
import { ShieldAlert, Award, User, Eye } from 'lucide-react';

const ROLE_CONFIG = {
  ADMIN: {
    label: 'Admin',
    icon: ShieldAlert,
  },
  LEAD: {
    label: 'Lead',
    icon: Award,
  },
  MEMBER: {
    label: 'Member',
    icon: User,
  },
  VIEWER: {
    label: 'Viewer',
    icon: Eye,
  },
};

export default function RoleBadge({ role, className = '' }) {
  const config = ROLE_CONFIG[role] || { label: role, icon: User };
  const Icon = config.icon;

  return (
    <span className={`badge badge-role-${role} ${className}`}>
      <Icon size={12} strokeWidth={2.5} />
      <span>{config.label}</span>
    </span>
  );
}
