import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Send, Edit2, Trash2, Check, X, MessageSquare } from 'lucide-react';
import * as commentsApi from '../api/comments';
import { getErrorMessage } from '../api/client';

export default function CommentSection({ workItemId, currentUserId, userRole, onCommentAdded }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchComments = useCallback(async () => {
    try {
      const data = await commentsApi.listComments(workItemId);
      setComments(data.comments || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [workItemId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await commentsApi.addComment(workItemId, newComment.trim());
      setNewComment('');
      toast.success('Comment added');
      await fetchComments();
      if (onCommentAdded) onCommentAdded();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (commentId) => {
    if (!editContent.trim()) return;

    setActionLoadingId(commentId);
    try {
      await commentsApi.updateComment(workItemId, commentId, editContent.trim());
      toast.success('Comment updated');
      setEditingId(null);
      await fetchComments();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    setActionLoadingId(commentId);
    try {
      await commentsApi.deleteComment(workItemId, commentId);
      toast.success('Comment deleted');
      await fetchComments();
      if (onCommentAdded) onCommentAdded();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="comments-container">
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '20px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ borderColor: 'var(--primary-500)', borderTopColor: 'transparent' }}></div>
          <span>Loading comments...</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <MessageSquare size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No comments yet. Start the conversation!</p>
        </div>
      ) : (
        <div className="comment-list">
          {comments.map((comment) => {
            const isAuthor = comment.author?.id === currentUserId;
            const canDelete = isAuthor || userRole === 'LEAD' || userRole === 'ADMIN';
            const isEditing = editingId === comment.id;
            const isBusy = actionLoadingId === comment.id;

            const dateStr = new Date(comment.createdAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={comment.id} className="comment-card">
                <div className="comment-card-header">
                  <div className="comment-author-box">
                    <div className="assignee-avatar-sm">
                      {comment.author?.displayName ? comment.author.displayName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.85rem' }}>{comment.author?.displayName}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        {dateStr}
                      </span>
                    </div>
                  </div>

                  {!isEditing && (
                    <div className="comment-actions">
                      {isAuthor && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleStartEdit(comment)}
                          disabled={isBusy}
                          title="Edit comment"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#ef4444' }}
                          onClick={() => handleDelete(comment.id)}
                          disabled={isBusy}
                          title="Delete comment"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div style={{ marginTop: '8px' }}>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      maxLength={2000}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleCancelEdit}
                        disabled={isBusy}
                      >
                        <X size={14} /> Cancel
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSaveEdit(comment.id)}
                        disabled={isBusy || !editContent.trim()}
                      >
                        <Check size={14} /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="comment-content">{comment.content}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add comment form */}
      <form onSubmit={handleAddComment} style={{ marginTop: '20px' }}>
        <div className="form-group" style={{ marginBottom: '10px' }}>
          <label className="form-label" htmlFor="new-comment-input">
            Leave a comment
          </label>
          <textarea
            id="new-comment-input"
            className="form-textarea"
            rows={3}
            placeholder="Share an update or question..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            maxLength={2000}
            disabled={submitting}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {newComment.length} / 2000 characters
            </span>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={submitting || !newComment.trim()}
            >
              {submitting ? (
                <>
                  <div className="spinner" style={{ width: '12px', height: '12px' }}></div>
                  <span>Posting...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Post Comment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
