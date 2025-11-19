'use client';

import { useState, useEffect } from 'react';

interface Comment {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  content: string;
  created_at: string;
  updated_at?: string;
}

interface CommentsSectionProps {
  candidateId?: string;
  jobId?: string;
  resultId?: string;
  currentUserId: string;
}

export default function CommentsSection({
  candidateId,
  jobId,
  resultId,
  currentUserId
}: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
  }, [candidateId, jobId, resultId]);

  const loadComments = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (candidateId) params.append('candidate_id', candidateId);
      if (jobId) params.append('job_id', jobId);
      if (resultId) params.append('result_id', resultId);

      const response = await fetch(`/api/comments?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('user_id', currentUserId);
      formData.append('content', newComment);
      if (candidateId) formData.append('candidate_id', candidateId);
      if (jobId) formData.append('job_id', jobId);
      if (resultId) formData.append('result_id', resultId);

      const response = await fetch('/api/comments', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setNewComment('');
        loadComments();
      } else {
        alert('Fout bij toevoegen commentaar');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Fout bij toevoegen commentaar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Weet je zeker dat je dit commentaar wilt verwijderen?')) return;

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        loadComments();
      } else {
        alert('Fout bij verwijderen commentaar');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Fout bij verwijderen commentaar');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-barnes-dark-violet mb-4">Opmerkingen</h3>

      {/* Comments List */}
      <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-4 text-barnes-dark-gray">Laden...</div>
        ) : comments.length === 0 ? (
          <div className="text-center py-4 text-barnes-dark-gray text-sm">
            Nog geen opmerkingen
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="border-b border-gray-100 pb-4 last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-barnes-dark-violet">
                      {comment.user_name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(comment.created_at).toLocaleString('nl-NL')}
                    </span>
                  </div>
                  <p className="text-sm text-barnes-dark-gray whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
                {comment.user_id === currentUserId && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Verwijderen
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Voeg een opmerking toe..."
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet focus:border-transparent resize-none"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !newComment.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Toevoegen...' : 'Opmerking toevoegen'}
          </button>
        </div>
      </form>
    </div>
  );
}

