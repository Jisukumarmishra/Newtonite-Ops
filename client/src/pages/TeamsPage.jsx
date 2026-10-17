import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Users, Plus, Shield, CheckSquare, Calendar, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as teamsApi from '../api/teams';
import { getErrorMessage } from '../api/client';
import RoleBadge from '../components/RoleBadge';

export default function TeamsPage() {
  const { teams, refreshTeams, setSelectedTeamId } = useAuth();
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    refreshTeams();
  }, [refreshTeams]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Team name is required');
      return;
    }

    setCreating(true);
    try {
      const data = await teamsApi.createTeam({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      toast.success(`Team "${data.team.name}" created!`);
      setShowModal(false);
      setName('');
      setDescription('');
      await refreshTeams();
      setSelectedTeamId(data.team.id);
      navigate(`/teams/${data.team.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Your Teams</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage and collaborate with teams across operations
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} />
          <span>Create New Team</span>
        </button>
      </div>

      {teams.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">
              <Users size={32} />
            </div>
            <h3 className="empty-title">No teams yet</h3>
            <p className="empty-description">
              Create a team to start assigning and managing operational work items.
            </p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} />
              <span>Create Your First Team</span>
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {teams.map((team) => (
            <div
              key={team.id}
              className="card card-hover"
              style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
              onClick={() => navigate(`/teams/${team.id}`)}
            >
              <div className="card-header" style={{ padding: '18px 20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{team.name}</h3>
                  <div style={{ marginTop: '4px' }}>
                    <RoleBadge role={team.role} />
                  </div>
                </div>
              </div>

              <div className="card-body" style={{ padding: '18px 20px', flex: 1 }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', minHeight: '40px', marginBottom: '16px' }}>
                  {team.description || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No description provided</span>}
                </p>

                <div style={{ display: 'flex', gap: '20px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={15} color="var(--primary-600)" />
                    <span>{team._count?.members || 1} members</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckSquare size={15} color="#10b981" />
                    <span>{team._count?.workItems || 0} work items</span>
                  </div>
                </div>
              </div>

              <div className="card-footer" style={{ padding: '12px 20px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Created {new Date(team.createdAt).toLocaleDateString()}
                </span>
                <span style={{ fontSize: '0.825rem', color: 'var(--primary-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Manage <ArrowRight size={14} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create a New Team</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTeam}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="team-name">
                    Team Name
                  </label>
                  <input
                    id="team-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Platform Reliability"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="team-desc">
                    Description (optional)
                  </label>
                  <textarea
                    id="team-desc"
                    className="form-textarea"
                    rows={3}
                    placeholder="Brief description of the team's operational scope..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                  />
                  <div className="form-hint">You will automatically become the ADMIN of this team.</div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating || !name.trim()}
                >
                  {creating ? (
                    <>
                      <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>Create Team</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
