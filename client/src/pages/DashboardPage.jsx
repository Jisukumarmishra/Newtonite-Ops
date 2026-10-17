import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CircleDot,
  Clock,
  AlertCircle,
  CheckCircle2,
  Archive,
  AlertOctagon,
  UserCheck,
  PlusCircle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as workItemsApi from '../api/workItems';
import { getErrorMessage } from '../api/client';
import WorkItemCard from '../components/WorkItemCard';

export default function DashboardPage() {
  const { selectedTeam, selectedTeamId, user, teams } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [statusCounts, setStatusCounts] = useState({
    OPEN: 0,
    IN_PROGRESS: 0,
    AWAITING_APPROVAL: 0,
    RESOLVED: 0,
    CLOSED: 0,
  });

  const fetchDashboardData = useCallback(async () => {
    if (!selectedTeamId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch recent 50 work items for the active team to compute stats and display recent items
      const data = await workItemsApi.listWorkItems(selectedTeamId, {
        page: 1,
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      const workItems = data.items || [];
      setItems(workItems);

      // Compute status counts
      const counts = {
        OPEN: 0,
        IN_PROGRESS: 0,
        AWAITING_APPROVAL: 0,
        RESOLVED: 0,
        CLOSED: 0,
      };

      workItems.forEach((item) => {
        if (counts[item.status] !== undefined) {
          counts[item.status] += 1;
        }
      });

      setStatusCounts(counts);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedTeamId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (teams.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">
            <PlusCircle size={32} />
          </div>
          <h2 className="empty-title">You don't belong to any team yet</h2>
          <p className="empty-description">
            Teams let you collaborate on operations and assign work items. Create your first team or ask an admin to add you.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/teams')}>
            <PlusCircle size={16} />
            <span>Go to Teams</span>
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-primary"></div>
        <p>Loading dashboard overview...</p>
      </div>
    );
  }

  // Filter items assigned to current user
  const myItems = items.filter((item) => item.assignedTo?.id === user?.id);
  // High / Critical items needing attention
  const criticalItems = items.filter(
    (item) => (item.priority === 'CRITICAL' || item.priority === 'HIGH') && item.status !== 'CLOSED' && item.status !== 'RESOLVED'
  );

  return (
    <div>
      {/* Top Welcome & Summary Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>
            Overview for {selectedTeam?.name || 'Selected Team'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Real-time status overview and high-priority operations
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => navigate('/work-items/new')}
        >
          <PlusCircle size={16} />
          <span>Create Work Item</span>
        </button>
      </div>

      {/* Status Metric Cards Grid */}
      <div className="metrics-grid">
        <div
          className="metric-card"
          onClick={() => navigate('/work-items?status=OPEN')}
          style={{ cursor: 'pointer' }}
        >
          <div className="metric-info">
            <span className="metric-label">Open</span>
            <span className="metric-value">{statusCounts.OPEN}</span>
            <span className="metric-sub">Awaiting pickup</span>
          </div>
          <div className="metric-icon-box" style={{ backgroundColor: 'var(--status-open-bg)', color: 'var(--status-open-text)' }}>
            <CircleDot size={24} />
          </div>
        </div>

        <div
          className="metric-card"
          onClick={() => navigate('/work-items?status=IN_PROGRESS')}
          style={{ cursor: 'pointer' }}
        >
          <div className="metric-info">
            <span className="metric-label">In Progress</span>
            <span className="metric-value">{statusCounts.IN_PROGRESS}</span>
            <span className="metric-sub">Currently active</span>
          </div>
          <div className="metric-icon-box" style={{ backgroundColor: 'var(--status-in-progress-bg)', color: 'var(--status-in-progress-text)' }}>
            <Clock size={24} />
          </div>
        </div>

        <div
          className="metric-card"
          onClick={() => navigate('/work-items?status=AWAITING_APPROVAL')}
          style={{ cursor: 'pointer' }}
        >
          <div className="metric-info">
            <span className="metric-label">Awaiting Approval</span>
            <span className="metric-value">{statusCounts.AWAITING_APPROVAL}</span>
            <span className="metric-sub">Requires Lead/Admin</span>
          </div>
          <div className="metric-icon-box" style={{ backgroundColor: 'var(--status-awaiting-bg)', color: 'var(--status-awaiting-text)' }}>
            <AlertCircle size={24} />
          </div>
        </div>

        <div
          className="metric-card"
          onClick={() => navigate('/work-items?status=RESOLVED')}
          style={{ cursor: 'pointer' }}
        >
          <div className="metric-info">
            <span className="metric-label">Resolved</span>
            <span className="metric-value">{statusCounts.RESOLVED}</span>
            <span className="metric-sub">Verification ready</span>
          </div>
          <div className="metric-icon-box" style={{ backgroundColor: 'var(--status-resolved-bg)', color: 'var(--status-resolved-text)' }}>
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div
          className="metric-card"
          onClick={() => navigate('/work-items?status=CLOSED')}
          style={{ cursor: 'pointer' }}
        >
          <div className="metric-info">
            <span className="metric-label">Closed</span>
            <span className="metric-value">{statusCounts.CLOSED}</span>
            <span className="metric-sub">Completed</span>
          </div>
          <div className="metric-icon-box" style={{ backgroundColor: 'var(--status-closed-bg)', color: 'var(--status-closed-text)' }}>
            <Archive size={24} />
          </div>
        </div>
      </div>

      {/* Main Dashboard Layout */}
      <div className="dashboard-grid">
        {/* Left column: Recent Work Items */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="var(--primary-600)" />
              <span>Recent Work Items</span>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => navigate('/work-items')}
            >
              <span>View All</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="card-body">
            {items.length === 0 ? (
              <div className="empty-state">
                <CircleDot size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                <p className="empty-title">No work items found</p>
                <p className="empty-description">Create your team's first work item to get started.</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/work-items/new')}
                >
                  <PlusCircle size={14} />
                  <span>Create Item</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {items.slice(0, 6).map((item) => (
                  <WorkItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Highlights (Assigned to Me & Urgent items) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Assigned to Me */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                <UserCheck size={18} color="#10b981" />
                <span>Assigned to You</span>
                <span className="badge" style={{ backgroundColor: '#ecfdf5', color: '#047857' }}>
                  {myItems.length}
                </span>
              </div>
            </div>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              {myItems.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No items currently assigned to you in this team.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {myItems.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/work-items/${item.id}`)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-surface-subtle)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                        {item.title}
                      </span>
                      <span className={`badge badge-status-${item.status}`} style={{ fontSize: '0.7rem' }}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Attention Required (High & Critical Priority) */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                <AlertOctagon size={18} color="#ef4444" />
                <span>Urgent Attention</span>
                <span className="badge" style={{ backgroundColor: '#fef2f2', color: '#b91c1c' }}>
                  {criticalItems.length}
                </span>
              </div>
            </div>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              {criticalItems.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No urgent or critical open items right now. All clear!
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {criticalItems.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/work-items/${item.id}`)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-surface-subtle)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                        {item.title}
                      </span>
                      <span className={`badge badge-priority-${item.priority}`} style={{ fontSize: '0.7rem' }}>
                        {item.priority}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
