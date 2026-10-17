import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Users,
  UserPlus,
  Trash2,
  ArrowLeft,
  CheckSquare,
  X,
  Mail,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as teamsApi from '../api/teams';
import { getErrorMessage } from '../api/client';
import RoleBadge from '../components/RoleBadge';

export default function TeamDetailPage() {
  const { id: teamId } = useParams();
  const navigate = useNavigate();
  const { user, refreshTeams, setSelectedTeamId } = useAuth();

  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('MEMBER');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const data = await teamsApi.getTeam(teamId);
      setTeam(data.team);
    } catch (err) {
      toast.error(getErrorMessage(err));
      navigate('/teams');
    } finally {
      setLoading(false);
    }
  }, [teamId, navigate]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // Find current user's membership and check if ADMIN
  const currentMembership = team?.members?.find((m) => m.userId === user?.id || m.user?.id === user?.id);
  const isAdmin = currentMembership?.role === 'ADMIN';

  // Load candidate users when opening Add Member modal
  const handleOpenAddModal = async () => {
    setShowAddModal(true);
    try {
      const data = await teamsApi.listUsers();
      // Filter out users who are already members
      const existingUserIds = new Set(team.members.map((m) => m.userId || m.user.id));
      const candidates = (data.users || []).filter((u) => !existingUserIds.has(u.id));
      setAllUsers(candidates);
      if (candidates.length > 0) {
        setSelectedUserId(candidates[0].id);
      } else {
        setSelectedUserId('');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error('Please select a user to add');
      return;
    }

    setActionLoading(true);
    try {
      await teamsApi.addMember(teamId, {
        userId: selectedUserId,
        role: selectedRole,
      });
      toast.success('Member added successfully');
      setShowAddModal(false);
      await fetchTeam();
      await refreshTeams();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      await teamsApi.updateMemberRole(teamId, memberId, newRole);
      toast.success(`Role updated to ${newRole}`);
      await fetchTeam();
      await refreshTeams();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this team?`)) {
      return;
    }

    try {
      await teamsApi.removeMember(teamId, memberId);
      toast.success(`${memberName} has been removed from the team`);
      await fetchTeam();
      await refreshTeams();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleMakeActiveTeam = () => {
    setSelectedTeamId(teamId);
    toast.success(`Active team set to "${team.name}"`);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-primary"></div>
        <p>Loading team details...</p>
      </div>
    );
  }

  if (!team) return null;

  return (
    <div>
      {/* Back button */}
      <button
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: '16px' }}
        onClick={() => navigate('/teams')}
      >
        <ArrowLeft size={16} />
        <span>Back to Teams</span>
      </button>

      {/* Team Header Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{team.name}</h2>
                {currentMembership && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Your role:</span>
                    <RoleBadge role={currentMembership.role} />
                  </div>
                )}
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.95rem' }}>
                {team.description || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No description provided</span>}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={handleMakeActiveTeam}>
                <span>Set as Active Team</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSelectedTeamId(teamId);
                  navigate('/work-items');
                }}
              >
                <CheckSquare size={16} />
                <span>View Team Work Items</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Members Section */}
      <div className="card">
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} color="var(--primary-600)" />
            <span>Team Members ({team.members?.length || 0})</span>
          </div>

          {isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={handleOpenAddModal}>
              <UserPlus size={14} />
              <span>Add Member</span>
            </button>
          )}
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {team.members?.map((member) => {
                const memberUser = member.user || {};
                const isMe = memberUser.id === user?.id;

                return (
                  <tr key={member.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="assignee-avatar-sm">
                          {memberUser.displayName ? memberUser.displayName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <strong>{memberUser.displayName || 'Unknown'}</strong>
                          {isMe && (
                            <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: 'var(--primary-600)', fontWeight: 600 }}>
                              (You)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Mail size={13} color="var(--text-muted)" />
                        <span>{memberUser.email}</span>
                      </div>
                    </td>

                    <td>
                      {isAdmin ? (
                        <select
                          className="form-select"
                          style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto', minWidth: '110px' }}
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        >
                          <option value="VIEWER">VIEWER</option>
                          <option value="MEMBER">MEMBER</option>
                          <option value="LEAD">LEAD</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      ) : (
                        <RoleBadge role={member.role} />
                      )}
                    </td>

                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>

                    {isAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#ef4444' }}
                          onClick={() => handleRemoveMember(member.id, memberUser.displayName)}
                          title="Remove member"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Member to {team.name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddMember}>
              <div className="modal-body">
                {allUsers.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    All existing users are already members of this team!
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label form-label-required" htmlFor="user-select">
                        Select User
                      </label>
                      <select
                        id="user-select"
                        className="form-select"
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        required
                      >
                        {allUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.displayName} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label form-label-required" htmlFor="role-select">
                        Assign Role
                      </label>
                      <select
                        id="role-select"
                        className="form-select"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                      >
                        <option value="VIEWER">VIEWER - Can view work items & comments</option>
                        <option value="MEMBER">MEMBER - Can create, claim, and update work items</option>
                        <option value="LEAD">LEAD - Can approve/reject items and unassign</option>
                        <option value="ADMIN">ADMIN - Full control including team members</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading || !selectedUserId}
                >
                  {actionLoading ? (
                    <>
                      <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      <span>Add Member</span>
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
