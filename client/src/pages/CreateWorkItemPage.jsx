import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as workItemsApi from '../api/workItems';
import { getErrorMessage } from '../api/client';

export default function CreateWorkItemPage() {
  const navigate = useNavigate();
  const { teams, selectedTeamId } = useAuth();

  const [teamId, setTeamId] = useState(selectedTeamId || (teams.length > 0 ? teams[0].id : ''));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [loading, setLoading] = useState(false);

  // Generate an idempotency key on form mount/load
  const [idempotencyKey] = useState(() => `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!teamId) {
      toast.error('Please select a team');
      return;
    }

    if (!title.trim()) {
      toast.error('Work item title is required');
      return;
    }

    setLoading(true);
    try {
      const data = await workItemsApi.createWorkItem(teamId, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        idempotencyKey,
      });

      if (data.wasIdempotent) {
        toast('Returned existing work item (idempotency key matched)', { icon: 'ℹ️' });
      } else {
        toast.success('Work item created successfully!');
      }

      navigate(`/work-items/${data.workItem.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (teams.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3 className="empty-title">You need to join or create a team first</h3>
          <p className="empty-description">Work items belong to a team.</p>
          <button className="btn btn-primary" onClick={() => navigate('/teams')}>
            <span>Go to Teams</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <button
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: '16px' }}
        onClick={() => navigate('/work-items')}
      >
        <ArrowLeft size={16} />
        <span>Back to Work Items</span>
      </button>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Create Work Item</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="card-body">
            {/* Team Selection */}
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="create-team-select">
                Target Team
              </label>
              <select
                id="create-team-select"
                className="form-select"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                required
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (Role: {t.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="create-title-input">
                Title
              </label>
              <input
                id="create-title-input"
                type="text"
                className="form-input"
                placeholder="e.g. Investigate high CPU usage in worker pods"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
                autoFocus
              />
              <div className="form-hint">{title.length} / 200 characters</div>
            </div>

            {/* Priority */}
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="create-priority-select">
                Priority
              </label>
              <select
                id="create-priority-select"
                className="form-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="LOW">LOW - Non-urgent tasks or enhancements</option>
                <option value="MEDIUM">MEDIUM - Standard operational tasks</option>
                <option value="HIGH">HIGH - Urgent issues needing prompt resolution</option>
                <option value="CRITICAL">CRITICAL - Severe incident, immediate attention required</option>
              </select>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label" htmlFor="create-desc-input">
                Description
              </label>
              <textarea
                id="create-desc-input"
                className="form-textarea"
                rows={6}
                placeholder="Provide relevant details, steps to reproduce, or operational instructions..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
              />
              <div className="form-hint">{description.length} / 5000 characters</div>
            </div>

            {/* Idempotency Key information */}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', padding: '8px 12px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-sm)' }}>
              Idempotency Key: {idempotencyKey}
            </div>
          </div>

          <div className="card-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/work-items')}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !title.trim()}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <PlusCircle size={16} />
                  <span>Create Item</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
