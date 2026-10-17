import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Search,
  PlusCircle,
  ArrowUpDown,
  RefreshCw,
  CheckSquare,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as workItemsApi from '../api/workItems';
import { getErrorMessage } from '../api/client';
import WorkItemCard from '../components/WorkItemCard';
import Pagination from '../components/Pagination';

export default function WorkItemsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { selectedTeam, selectedTeamId, teams } = useAuth();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });

  // Filter state initialized from URL query params
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [priority, setPriority] = useState(searchParams.get('priority') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');
  const [page, setPage] = useState(parseInt(searchParams.get('page'), 10) || 1);

  // Sync state if URL query params change (e.g. from dashboard cards)
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam !== null) {
      setStatus(statusParam);
    }
  }, [searchParams]);

  const fetchWorkItems = useCallback(async () => {
    if (!selectedTeamId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const query = {
        page,
        limit: 12,
        sortBy,
        sortOrder,
      };

      if (status) query.status = status;
      if (priority) query.priority = priority;
      if (search.trim()) query.search = search.trim();

      const data = await workItemsApi.listWorkItems(selectedTeamId, query);
      setItems(data.items || []);
      setPagination(data.pagination || { page: 1, limit: 12, total: 0, totalPages: 1 });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedTeamId, page, status, priority, search, sortBy, sortOrder]);

  useEffect(() => {
    fetchWorkItems();
  }, [fetchWorkItems]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    updateUrlParams({ search, page: 1 });
  };

  const handleStatusChange = (e) => {
    const val = e.target.value;
    setStatus(val);
    setPage(1);
    updateUrlParams({ status: val, page: 1 });
  };

  const handlePriorityChange = (e) => {
    const val = e.target.value;
    setPriority(val);
    setPage(1);
    updateUrlParams({ priority: val, page: 1 });
  };

  const handleSortChange = (e) => {
    const val = e.target.value;
    setSortBy(val);
    updateUrlParams({ sortBy: val });
  };

  const handleSortOrderToggle = () => {
    const nextOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(nextOrder);
    updateUrlParams({ sortOrder: nextOrder });
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatus('');
    setPriority('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
    setSearchParams({});
  };

  const updateUrlParams = (newParams) => {
    const current = Object.fromEntries(searchParams.entries());
    const merged = { ...current, ...newParams };

    // Clean up empty params
    Object.keys(merged).forEach((k) => {
      if (!merged[k]) delete merged[k];
    });

    setSearchParams(merged);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    updateUrlParams({ page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (teams.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">
            <CheckSquare size={32} />
          </div>
          <h3 className="empty-title">No team selected</h3>
          <p className="empty-description">You must belong to a team to view and manage work items.</p>
          <button className="btn btn-primary" onClick={() => navigate('/teams')}>
            <span>Go to Teams</span>
          </button>
        </div>
      </div>
    );
  }

  const hasActiveFilters = Boolean(status || priority || search);

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Work Items</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Tracking operational items for <strong>{selectedTeam?.name}</strong>
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => navigate('/work-items/new')}>
          <PlusCircle size={16} />
          <span>Create Work Item</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="filter-bar">
        <form onSubmit={handleSearchSubmit} className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        {/* Status Filter */}
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: '150px' }}
          value={status}
          onChange={handleStatusChange}
        >
          <option value="">All Statuses</option>
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN PROGRESS</option>
          <option value="AWAITING_APPROVAL">AWAITING APPROVAL</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="CLOSED">CLOSED</option>
        </select>

        {/* Priority Filter */}
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: '140px' }}
          value={priority}
          onChange={handlePriorityChange}
        >
          <option value="">All Priorities</option>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>

        {/* Sort By */}
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: '140px' }}
          value={sortBy}
          onChange={handleSortChange}
        >
          <option value="createdAt">Date Created</option>
          <option value="updatedAt">Date Updated</option>
          <option value="priority">Priority</option>
          <option value="status">Status</option>
          <option value="title">Title</option>
        </select>

        {/* Sort Order Toggle */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleSortOrderToggle}
          title={`Sorting ${sortOrder.toUpperCase()}`}
        >
          <ArrowUpDown size={14} />
          <span>{sortOrder.toUpperCase()}</span>
        </button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleClearFilters}
            style={{ color: '#ef4444' }}
          >
            <XCircle size={14} />
            <span>Clear Filters</span>
          </button>
        )}

        {/* Refresh button */}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={fetchWorkItems}
          title="Refresh items"
        >
          <RefreshCw size={14} className={loading ? 'spinner' : ''} />
        </button>
      </div>

      {/* Items List or Loading / Empty state */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner spinner-primary"></div>
          <p>Loading work items...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">
              <CheckSquare size={32} />
            </div>
            <h3 className="empty-title">No work items found</h3>
            <p className="empty-description">
              {hasActiveFilters
                ? 'No items matched your current filters. Try resetting them.'
                : 'Get started by creating the first work item for this team.'}
            </p>
            {hasActiveFilters ? (
              <button className="btn btn-secondary" onClick={handleClearFilters}>
                <span>Reset Filters</span>
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => navigate('/work-items/new')}>
                <PlusCircle size={16} />
                <span>Create Work Item</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            {items.map((item) => (
              <WorkItemCard key={item.id} item={item} />
            ))}
          </div>

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}
