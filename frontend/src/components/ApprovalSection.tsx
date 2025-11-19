'use client';

import { useState, useEffect } from 'react';

interface Approval {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  approval_type: string;
  status: 'approved' | 'rejected' | 'pending';
  comment?: string;
  created_at: string;
  updated_at?: string;
}

interface ApprovalSectionProps {
  candidateId?: string;
  jobId?: string;
  resultId?: string;
  currentUserId: string;
  approvalType: 'candidate_hire' | 'candidate_reject' | 'evaluation_approve' | 'decision_approve';
}

export default function ApprovalSection({
  candidateId,
  jobId,
  resultId,
  currentUserId,
  approvalType
}: ApprovalSectionProps) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'approved' | 'rejected' | 'pending'>('pending');
  const [comment, setComment] = useState('');

  useEffect(() => {
    loadApprovals();
  }, [candidateId, jobId, resultId, approvalType]);

  const loadApprovals = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (candidateId) params.append('candidate_id', candidateId);
      if (jobId) params.append('job_id', jobId);
      if (resultId) params.append('result_id', resultId);
      params.append('approval_type', approvalType);

      const response = await fetch(`/api/approvals?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setApprovals(data.approvals || []);
        // Check if current user has an approval
        const userApproval = data.approvals?.find((a: Approval) => a.user_id === currentUserId);
        if (userApproval) {
          setSelectedStatus(userApproval.status);
          setComment(userApproval.comment || '');
        }
      }
    } catch (error) {
      console.error('Error loading approvals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('user_id', currentUserId);
      formData.append('approval_type', approvalType);
      formData.append('status', selectedStatus);
      if (candidateId) formData.append('candidate_id', candidateId);
      if (jobId) formData.append('job_id', jobId);
      if (resultId) formData.append('result_id', resultId);
      if (comment) formData.append('comment', comment);

      const response = await fetch('/api/approvals', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setComment('');
        loadApprovals();
      } else {
        alert('Fout bij opslaan goedkeuring');
      }
    } catch (error) {
      console.error('Error submitting approval:', error);
      alert('Fout bij opslaan goedkeuring');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getApprovalTypeLabel = () => {
    switch (approvalType) {
      case 'candidate_hire':
        return 'Kandidaat Aannemen';
      case 'candidate_reject':
        return 'Kandidaat Afwijzen';
      case 'evaluation_approve':
        return 'Evaluatie Goedkeuren';
      case 'decision_approve':
        return 'Beslissing Goedkeuren';
      default:
        return 'Goedkeuring';
    }
  };

  const approvedCount = approvals.filter(a => a.status === 'approved').length;
  const rejectedCount = approvals.filter(a => a.status === 'rejected').length;
  const pendingCount = approvals.filter(a => a.status === 'pending').length;
  const currentUserApproval = approvals.find(a => a.user_id === currentUserId);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-barnes-dark-violet">{getApprovalTypeLabel()}</h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-barnes-dark-gray">{approvedCount} Goedgekeurd</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-barnes-dark-gray">{rejectedCount} Afgewezen</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span className="text-barnes-dark-gray">{pendingCount} In afwachting</span>
          </span>
        </div>
      </div>

      {/* Approval Form */}
      <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="mb-4">
          <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
            Jouw beslissing
          </label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="approved"
                checked={selectedStatus === 'approved'}
                onChange={(e) => setSelectedStatus(e.target.value as 'approved')}
                className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
              />
              <span className="text-sm font-medium text-green-700">✓ Goedkeuren</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="rejected"
                checked={selectedStatus === 'rejected'}
                onChange={(e) => setSelectedStatus(e.target.value as 'rejected')}
                className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
              />
              <span className="text-sm font-medium text-red-700">✗ Afwijzen</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="pending"
                checked={selectedStatus === 'pending'}
                onChange={(e) => setSelectedStatus(e.target.value as 'pending')}
                className="w-4 h-4 text-yellow-600 border-gray-300 focus:ring-yellow-500"
              />
              <span className="text-sm font-medium text-yellow-700">⏸ In afwachting</span>
            </label>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-barnes-dark-gray mb-2">
            Opmerking (optioneel)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Voeg een opmerking toe..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-barnes-violet focus:border-transparent min-h-20"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-barnes-violet text-white rounded-lg hover:bg-barnes-dark-violet transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Opslaan...' : currentUserApproval ? 'Bijwerken' : 'Opslaan'}
        </button>
      </form>

      {/* Approvals List */}
      {approvals.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-barnes-dark-violet mb-2">Alle goedkeuringen</h4>
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className={`p-3 rounded-lg border-2 ${
                approval.status === 'approved'
                  ? 'bg-green-50 border-green-200'
                  : approval.status === 'rejected'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1">
                  <p className="font-medium text-barnes-dark-violet">{approval.user_name}</p>
                  <p className="text-xs text-barnes-dark-gray">
                    {new Date(approval.created_at).toLocaleString('nl-NL')}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded ${
                    approval.status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : approval.status === 'rejected'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {approval.status === 'approved'
                    ? '✓ Goedgekeurd'
                    : approval.status === 'rejected'
                    ? '✗ Afgewezen'
                    : '⏸ In afwachting'}
                </span>
              </div>
              {approval.comment && (
                <p className="text-sm text-barnes-dark-gray mt-2">{approval.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

