import React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import {
  LayoutDashboard,
  CheckSquare,
  PlusCircle,
  Users,
  LogOut,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import RoleBadge from './RoleBadge';

export default function Layout() {
  const { user, logout, teams, selectedTeam, selectedTeamId, setSelectedTeamId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleTeamChange = (e) => {
    setSelectedTeamId(e.target.value);
  };

  // Determine current page title
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path === '/work-items/new') return 'New Work Item';
    if (path.startsWith('/work-items/') && path !== '/work-items') return 'Work Item Details';
    if (path === '/work-items') return 'Work Items';
    if (path.startsWith('/teams/') && path !== '/teams') return 'Team Details';
    if (path === '/teams') return 'Teams';
    return 'Newtonite Ops';
  };

  return (
    <div className="app-container">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#ffffff',
            border: '1px solid #334155',
            fontSize: '0.875rem',
            borderRadius: '8px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
          },
        }}
      />

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-icon">
              <Layers size={18} strokeWidth={2.5} />
            </div>
            <span>Newtonite Ops</span>
            <span className="brand-badge">V1</span>
          </div>
        </div>

        {/* Team Selector Box */}
        <div className="team-selector-box">
          <div className="team-selector-label">
            <span>Active Team</span>
            {selectedTeam?.role && <RoleBadge role={selectedTeam.role} />}
          </div>
          {teams.length > 0 ? (
            <select
              className="team-select-dropdown"
              value={selectedTeamId || ''}
              onChange={handleTeamChange}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : (
            <button
              className="btn btn-outline btn-sm"
              style={{ width: '100%', color: '#93c5fd', borderColor: '#3b82f6' }}
              onClick={() => navigate('/teams')}
            >
              <PlusCircle size={14} />
              <span>Create / Join Team</span>
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-section-title">Navigation</div>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/work-items"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <CheckSquare size={18} />
            <span>Work Items</span>
            {selectedTeam?._count?.workItems !== undefined && (
              <span className="nav-link-badge">{selectedTeam._count.workItems}</span>
            )}
          </NavLink>

          <NavLink
            to="/work-items/new"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <PlusCircle size={18} />
            <span>Create Item</span>
          </NavLink>

          <div className="nav-section-title" style={{ marginTop: '16px' }}>Organization</div>
          <NavLink
            to="/teams"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Users size={18} />
            <span>Teams</span>
            <span className="nav-link-badge">{teams.length}</span>
          </NavLink>
        </nav>

        {/* User Profile in Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar" title={user?.displayName}>
              {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.displayName || 'User'}</div>
              <div className="user-email">{user?.email || ''}</div>
            </div>
          </div>
          <button
            className="btn-logout"
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-wrapper">
        <header className="top-header">
          <div className="header-left">
            <div className="header-title-box">
              <h1>{getPageTitle()}</h1>
              <div className="header-subtitle">
                {selectedTeam ? (
                  <span>
                    Team: <strong>{selectedTeam.name}</strong> • Role: <strong>{selectedTeam.role || 'Member'}</strong>
                  </span>
                ) : (
                  <span>No active team selected</span>
                )}
              </div>
            </div>
          </div>

          <div className="header-right">
            <button
              className="btn btn-primary"
              onClick={() => navigate('/work-items/new')}
            >
              <PlusCircle size={16} />
              <span>New Work Item</span>
            </button>
          </div>
        </header>

        <main className="content-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
