import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  GitCommit,
  UserCheck,
  UserMinus,
  Edit2,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Clock,
  ArrowRight,
  MessageSquare,
  Activity as ActivityIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as workItemsApi from '../api/workItems';
import { getErrorMessage } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import ActivityTimeline from '../components/ActivityTimeline';
import CommentSection from '../components/CommentSection';

// Workflow state machine definitions matching backend
const WORKFLOW_ORDER = ['OPEN', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'RESOLVED', 'CLOSED'];

const VALID_TRANSITIONS = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['AWAITING_APPROVAL', 'OPEN'],
  AWAITING_APPROVAL: ['RESOLVED', 'IN_PROGRESS'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['OPEN'],
};

const LEAD_REQUIRED_TRANSITIONS = [
  { from: 'AWAITING_APPROVAL', to: 'RESOLVED' },
  { from: 'AWAITING_APPROVAL', to: 'IN_PROGRESS' },
];

export default function WorkItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, teams } = useAuth();

  const [item, setItem] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [conflictError, setConflictError] = useState(null);

  // Edit item state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('MEDIUM');

  // Active tab: 'comments' or 'activity'
  const [activeTab, setActiveTab] = useState('comments');

  const fetchWorkItemData = useCallback(async () => {
    setLoading(true);
    setConflictError(null);
    try {
      const [itemRes, actRes] = await Promise.all([
        workItemsApi.getWorkItem(id),
        workItemsApi.getActivities(id).catch(() => ({ activities: [] })),
      ]);

      const workItem = itemRes.workItem;
      setItem(workItem);
      setActivities(actRes.activities || workItem.activities || []);

      setEditTitle(workItem.title);
      setEditDescription(workItem.description || '');
      setEditPriority(workItem.priority);
    } catch (err) {
      toast.error(getErrorMessage(err));
      navigate('/work-items');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchWorkItemData();
  }, [fetchWorkItemData]);

  // Determine current user's role in this work item's team
  const userTeam = teams.find((t) => t.id === item?.teamId);
  const userRole = userTeam?.role || 'VIEWER';
  const isLeadOrAdmin = userRole === 'LEAD' || userRole === 'ADMIN';
  const isMemberOrAbove = ['MEMBER', 'LEAD', 'ADMIN'].includes(userRole);

  // Status transitions available from current status
  const allowedNextStatuses = item ? VALID_TRANSITIONS[item.status] || [] : [];

  const handleTransition = async (newStatus) => {
    if (!item) return;

    // Check if transition requires Lead/Admin
    const requiresLead = LEAD_REQUIRED_TRANSITIONS.some(
      (t) => t.from === item.status && t.to === newStatus
    );

    if (requiresLead && !isLeadOrAdmin) {
      toast.error('Only team Leads and Admins can approve or reject items');
      return;
    }

    setActionLoading(true);
    try {
      const data = await workItemsApi.transitionStatus(item.id, {
        status: newStatus,
        version: item.version,
      });

      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
      setItem(data.workItem);
      setConflictError(null);
      // Refresh activities
      const actRes = await workItemsApi.getActivities(item.id);
      setActivities(actRes.activities || []);
    } catch (err) {
      if (err.response?.status === 409) {
        setConflictError(
          err.response.data?.error ||
          'Conflict detected: this item was modified by another user. Please refresh.'
        );
      }
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!item) return;

    setActionLoading(true);
    try {
      const data = await workItemsApi.claimWorkItem(item.id, item.version);
      toast.success('You have claimed this work item!');
      setItem(data.workItem);
      setConflictError(null);
      const actRes = await workItemsApi.getActivities(item.id);
      setActivities(actRes.activities || []);
    } catch (err) {
      if (err.response?.status === 409) {
        setConflictError(
          err.response.data?.error ||
          'Failed to claim item due to a conflict. Please refresh to see latest state.'
        );
      }
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnassign = async () => {
    if (!item) return;

    if (!isLeadOrAdmin) {
      toast.error('Only Leads and Admins can unassign work items');
      return;
    }

    if (!window.confirm('Are you sure you want to unassign this work item?')) {
      return;
    }

    setActionLoading(true);
    try {
      const data = await workItemsApi.unassignWorkItem(item.id, item.version);
      toast.success('Work item unassigned');
      setItem(data.workItem);
      setConflictError(null);
      const actRes = await workItemsApi.getActivities(item.id);
      setActivities(actRes.activities || []);
    } catch (err) {
      if (err.response?.status === 409) {
        setConflictError(
          err.response.data?.error ||
          'Conflict detected while unassigning. Please refresh.'
        );
      }
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    setActionLoading(true);
    try {
      const data = await workItemsApi.updateWorkItem(item.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        priority: editPriority,
        version: item.version,
      });

      toast.success('Work item updated successfully');
      setItem(data.workItem);
      setIsEditing(false);
      setConflictError(null);
      const actRes = await workItemsApi.getActivities(item.id);
      setActivities(actRes.activities || []);
    } catch (err) {
      if (err.response?.status === 409) {
        setConflictError(
          err.response.data?.error ||
          'Conflict: someone else updated this item. Please refresh before saving.'
        );
      }
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchWorkItemData();
    toast.success('Refreshed to latest version');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-primary"></div>
        <p>Loading work item details...</p>
      </div>
    );
  }

  if (!item) return null;

  return (
    <div>
      {/* Top back navigation & action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate('/work-items')}
        >
          <ArrowLeft size={16} />
          <span>Back to Work Items</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Optimistic locking version indicator */}
          <span className="badge-version" title="Optimistic lock version prevents concurrent overwrite conflicts">
            <GitCommit size={13} />
            <span>Lock Version: <strong>v{item.version}</strong></span>
          </span>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRefresh}
            disabled={actionLoading}
            title="Refresh item data"
          >
            <RefreshCw size={14} className={actionLoading ? 'spinner' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Optimistic Locking Conflict Banner if 409 occurred */}
      {conflictError && (
        <div className="conflict-banner">
          <AlertTriangle size={20} color="#b91c1c" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <strong>Concurrent Modification Conflict!</strong>
            <p style={{ marginTop: '2px' }}>{conflictError}</p>
          </div>
          <button className="btn btn-danger btn-sm" onClick={handleRefresh}>
            <RefreshCw size={12} /> Reload Latest
          </button>
        </div>
      )}

      {/* Workflow State Machine Visualizer */}
      <div className="state-machine-box">
        <div className="state-machine-header">
          <div className="state-machine-title">
            <Clock size={16} color="#60a5fa" />
            <span>Workflow State Machine</span>
          </div>

          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Current State: <strong style={{ color: '#ffffff' }}>{item.status.replace('_', ' ')}</strong>
          </div>
        </div>

        {/* Visual Pipeline Nodes */}
        <div className="state-machine-flow">
          {WORKFLOW_ORDER.map((st, index) => {
            const isCurrent = item.status === st;
            const isAllowedNext = allowedNextStatuses.includes(st);
            const requiresLead = LEAD_REQUIRED_TRANSITIONS.some(
              (t) => t.from === item.status && t.to === st
            );

            return (
              <React.Fragment key={st}>
                <div
                  className={`state-node ${isCurrent ? 'current' : ''} ${isAllowedNext ? 'allowed' : ''}`}
                  onClick={() => {
                    if (isAllowedNext && !actionLoading) {
                      handleTransition(st);
                    }
                  }}
                  title={
                    isCurrent
                      ? 'Current Status'
                      : isAllowedNext
                      ? `Click to transition to ${st}`
                      : 'Not a valid transition from current state'
                  }
                >
                  <div className="state-node-name">{st.replace('_', ' ')}</div>
                  <div className="state-node-tag">
                    {isCurrent && <span style={{ color: '#60a5fa' }}>● ACTIVE</span>}
                    {isAllowedNext && (
                      <span style={{ color: '#34d399', fontWeight: 600 }}>
                        ➔ {requiresLead ? 'LEAD REQ' : 'TRANSITION'}
                      </span>
                    )}
                    {!isCurrent && !isAllowedNext && <span style={{ color: '#64748b' }}>LOCKED</span>}
                  </div>
                </div>

                {index < WORKFLOW_ORDER.length - 1 && (
                  <ArrowRight size={16} className="state-arrow" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Status Transition Action Buttons */}
        {allowedNextStatuses.length > 0 && isMemberOrAbove && (
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid #1e293b', paddingTop: '14px' }}>
            <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Available Transitions:</span>
            {allowedNextStatuses.map((st) => {
              const requiresLead = LEAD_REQUIRED_TRANSITIONS.some(
                (t) => t.from === item.status && t.to === st
              );
              const disabled = requiresLead && !isLeadOrAdmin;

              return (
                <button
                  key={st}
                  className="btn btn-sm"
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    opacity: disabled ? 0.5 : 1,
                  }}
                  onClick={() => handleTransition(st)}
                  disabled={actionLoading || disabled}
                  title={disabled ? 'Requires Team Lead or Admin role' : ''}
                >
                  <ArrowRight size={13} />
                  <span>Move to {st.replace('_', ' ')}</span>
                  {requiresLead && <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>(Lead Only)</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Grid: Details (Left 2 cols) & Sidebar Metadata (Right 1 col) */}
      <div className="dashboard-grid">
        {/* Left Column: Work Item Content & Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Main Item Card */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <StatusBadge status={item.status} />
                <PriorityBadge priority={item.priority} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ID: <span style={{ fontFamily: 'monospace' }}>{item.id.substring(0, 8)}...</span>
                </span>
              </div>

              {!isEditing && isMemberOrAbove && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 size={13} />
                  <span>Edit Details</span>
                </button>
              )}
            </div>

            <div className="card-body">
              {isEditing ? (
                <form onSubmit={handleSaveDetails}>
                  <div className="form-group">
                    <label className="form-label form-label-required" htmlFor="edit-title">
                      Title
                    </label>
                    <input
                      id="edit-title"
                      type="text"
                      className="form-input"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={200}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label form-label-required" htmlFor="edit-priority">
                      Priority
                    </label>
                    <select
                      id="edit-priority"
                      className="form-select"
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="CRITICAL">CRITICAL</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-desc">
                      Description
                    </label>
                    <textarea
                      id="edit-desc"
                      className="form-textarea"
                      rows={6}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      maxLength={5000}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsEditing(false)}
                      disabled={actionLoading}
                    >
                      <X size={15} />
                      <span>Cancel</span>
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={actionLoading || !editTitle.trim()}
                    >
                      <Check size={15} />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <h1 style={{ fontSize: '1.45rem', fontWeight: 700, lineHeight: 1.3, marginBottom: '16px' }}>
                    {item.title}
                  </h1>

                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    {item.description ? (
                      item.description
                    ) : (
                      <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No description provided for this work item.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tabs for Comments and Activity */}
          <div className="card">
            <div className="card-header" style={{ padding: '0 24px', display: 'flex', gap: '20px' }}>
              <button
                className="btn btn-ghost"
                style={{
                  padding: '16px 4px',
                  borderRadius: 0,
                  borderBottom: activeTab === 'comments' ? '2px solid var(--primary-600)' : '2px solid transparent',
                  color: activeTab === 'comments' ? 'var(--primary-600)' : 'var(--text-secondary)',
                  fontWeight: activeTab === 'comments' ? 600 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => setActiveTab('comments')}
              >
                <MessageSquare size={16} />
                <span>Comments</span>
              </button>

              <button
                className="btn btn-ghost"
                style={{
                  padding: '16px 4px',
                  borderRadius: 0,
                  borderBottom: activeTab === 'activity' ? '2px solid var(--primary-600)' : '2px solid transparent',
                  color: activeTab === 'activity' ? 'var(--primary-600)' : 'var(--text-secondary)',
                  fontWeight: activeTab === 'activity' ? 600 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => setActiveTab('activity')}
              >
                <ActivityIcon size={16} />
                <span>Activity History ({activities.length})</span>
              </button>
            </div>

            <div className="card-body">
              {activeTab === 'comments' ? (
                <CommentSection
                  workItemId={item.id}
                  currentUserId={user?.id}
                  userRole={userRole}
                  onCommentAdded={async () => {
                    const actRes = await workItemsApi.getActivities(item.id);
                    setActivities(actRes.activities || []);
                  }}
                />
              ) : (
                <ActivityTimeline activities={activities} />
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Metadata & Assignment Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Assignment & Claim Box */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ fontSize: '1rem' }}>Assignment</span>
            </div>
            <div className="card-body">
              {item.assignedTo ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <div className="user-avatar" style={{ width: '40px', height: '40px' }}>
                      {item.assignedTo.displayName ? item.assignedTo.displayName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.assignedTo.displayName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.assignedTo.email}</div>
                    </div>
                  </div>

                  {item.assignedTo.id === user?.id ? (
                    <div className="badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', width: '100%', justifyContent: 'center', padding: '6px' }}>
                      Assigned to You
                    </div>
                  ) : null}

                  {isLeadOrAdmin && (
                    <button
                      className="btn btn-danger-outline btn-sm"
                      style={{ width: '100%', marginTop: '12px' }}
                      onClick={handleUnassign}
                      disabled={actionLoading}
                    >
                      <UserMinus size={14} />
                      <span>Unassign Item</span>
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '14px' }}>
                    This work item currently has no assignee.
                  </p>

                  {isMemberOrAbove ? (
                    <button
                      className="btn btn-success"
                      style={{ width: '100%' }}
                      onClick={handleClaim}
                      disabled={actionLoading}
                    >
                      <UserCheck size={16} />
                      <span>Claim this Item</span>
                    </button>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Viewer role cannot claim items.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Details & Audit Information */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ fontSize: '1rem' }}>Details</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>
                  Team
                </span>
                <strong>{item.team?.name || 'Assigned Team'}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>
                  Created By
                </span>
                <strong>{item.createdBy?.displayName || 'Unknown'}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>
                  Created At
                </span>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>
                  Last Updated
                </span>
                <span>{new Date(item.updatedAt).toLocaleString()}</span>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>
                  Concurrency Lock
                </span>
                <span className="badge-version">Version {item.version}</span>
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Increments on every update to ensure concurrent edits are safe.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
