import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/auth';
import * as teamsApi from '../api/teams';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamIdState] = useState(() => localStorage.getItem('selectedTeamId') || null);
  const [loading, setLoading] = useState(true);

  const setSelectedTeamId = useCallback((teamId) => {
    setSelectedTeamIdState(teamId);
    if (teamId) {
      localStorage.setItem('selectedTeamId', teamId);
    } else {
      localStorage.removeItem('selectedTeamId');
    }
  }, []);

  const refreshTeams = useCallback(async () => {
    try {
      const data = await teamsApi.getTeams();
      const userTeams = data.teams || [];
      setTeams(userTeams);

      // If no team selected or current selected is not in teams, select the first team
      setSelectedTeamIdState((prev) => {
        if (prev && userTeams.some((t) => t.id === prev)) {
          return prev;
        }
        const nextId = userTeams.length > 0 ? userTeams[0].id : null;
        if (nextId) {
          localStorage.setItem('selectedTeamId', nextId);
        } else {
          localStorage.removeItem('selectedTeamId');
        }
        return nextId;
      });

      return userTeams;
    } catch (err) {
      console.error('Failed to fetch teams:', err);
      return [];
    }
  }, []);

  // Initialize auth check on mount
  useEffect(() => {
    async function initAuth() {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const profileData = await authApi.getProfile();
          setUser(profileData.user);
          localStorage.setItem('user', JSON.stringify(profileData.user));
          await refreshTeams();
        } catch (err) {
          console.error('Auth verification failed:', err);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    }

    initAuth();
  }, [refreshTeams]);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    await refreshTeams();
    return data;
  };

  const register = async (email, password, displayName) => {
    const data = await authApi.register(email, password, displayName);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    await refreshTeams();
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedTeamId');
    setToken(null);
    setUser(null);
    setTeams([]);
    setSelectedTeamIdState(null);
  };

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || (teams.length > 0 ? teams[0] : null);

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    loading,
    teams,
    selectedTeam,
    selectedTeamId,
    setSelectedTeamId,
    refreshTeams,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
