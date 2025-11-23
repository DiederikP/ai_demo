'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string;
  related_candidate_id?: string;
  related_job_id?: string;
  related_result_id?: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationCenterProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ActivityHistory {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  user_name?: string;
}

export default function NotificationCenter({ userId, isOpen, onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activityHistory, setActivityHistory] = useState<ActivityHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'notifications' | 'history'>('notifications');
  const router = useRouter();

  useEffect(() => {
    if (isOpen && userId) {
      loadNotifications();
      loadActivityHistory();
    }
  }, [isOpen, userId]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/notifications?user_id=${userId}&unread_only=false`);
      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadActivityHistory = async () => {
    try {
      // Load activity history from notifications and evaluation results
      const [notificationsRes, resultsRes] = await Promise.all([
        fetch(`/api/notifications?user_id=${userId}&unread_only=false`),
        fetch('/api/evaluation-results')
      ]);
      
      const history: ActivityHistory[] = [];
      
      if (notificationsRes.ok) {
        const notifData = await notificationsRes.json();
        if (notifData.success && notifData.notifications) {
          notifData.notifications.forEach((n: Notification) => {
            history.push({
              id: n.id,
              type: n.type,
              description: `${n.title}${n.message ? ': ' + n.message : ''}`,
              timestamp: n.created_at,
              user_name: 'Systeem'
            });
          });
        }
      }
      
      if (resultsRes.ok) {
        const resultsData = await resultsRes.json();
        if (resultsData.results) {
          resultsData.results.slice(0, 20).forEach((r: any) => {
            history.push({
              id: r.id,
              type: r.result_type === 'evaluation' ? 'evaluation_complete' : 'debate_complete',
              description: `${r.result_type === 'evaluation' ? 'Evaluatie' : 'Debat'} voltooid voor ${r.candidate_name || 'kandidaat'}`,
              timestamp: r.created_at,
              user_name: 'Systeem'
            });
          });
        }
      }
      
      // Sort by timestamp, most recent first
      history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivityHistory(history.slice(0, 50)); // Keep last 50 activities
    } catch (error) {
      console.error('Error loading activity history:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, { method: 'PUT' });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `user_id=${userId}`
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    if (notification.related_candidate_id) {
      router.push(`/company/kandidaten/${notification.related_candidate_id}`);
    } else if (notification.related_job_id) {
      router.push(`/company/vacatures/${notification.related_job_id}`);
    } else if (notification.related_result_id) {
      router.push(`/company/results/${notification.related_result_id}`);
    }
    
    onClose();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'evaluation_complete':
        return '✅';
      case 'debate_complete':
        return '💬';
      case 'conversation_added':
        return '📞';
      case 'job_created':
        return '💼';
      case 'candidate_update':
        return '📄';
      default:
        return '🔔';
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Group notifications by vacancy (job_id)
  const notificationsByVacancy = useMemo(() => {
    const grouped: Record<string, Notification[]> = {};
    const ungrouped: Notification[] = [];
    
    notifications.forEach(notification => {
      if (notification.related_job_id) {
        if (!grouped[notification.related_job_id]) {
          grouped[notification.related_job_id] = [];
        }
        grouped[notification.related_job_id].push(notification);
      } else {
        ungrouped.push(notification);
      }
    });
    
    // Sort each group by created_at (most recent first)
    Object.keys(grouped).forEach(jobId => {
      grouped[jobId].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
    
    return { grouped, ungrouped };
  }, [notifications]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end pt-16" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-barnes-dark-violet">Notificaties</h2>
              {unreadCount > 0 && (
                <span className="px-2 py-1 bg-barnes-violet text-white text-xs rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && activeTab === 'notifications' && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-barnes-violet hover:underline"
                >
                  Alles lezen
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'notifications'
                  ? 'text-barnes-violet border-b-2 border-barnes-violet'
                  : 'text-barnes-dark-gray hover:text-barnes-violet'
              }`}
            >
              Notificaties {unreadCount > 0 && `(${unreadCount})`}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'text-barnes-violet border-b-2 border-barnes-violet'
                  : 'text-barnes-dark-gray hover:text-barnes-violet'
              }`}
            >
              Geschiedenis
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block w-6 h-6 border-2 border-barnes-violet border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : activeTab === 'notifications' ? (
            notifications.length === 0 ? (
              <div className="p-8 text-center text-barnes-dark-gray">
                <p className="text-sm">Geen notificaties</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* Grouped by Vacancy */}
                {Object.entries(notificationsByVacancy.grouped).map(([jobId, jobNotifications]) => {
                  const unreadCountForJob = jobNotifications.filter(n => !n.is_read).length;
                  return (
                    <div key={jobId} className="border-b border-gray-200 last:border-b-0">
                      <div className="p-3 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-barnes-dark-violet uppercase">
                            Vacature Updates
                          </p>
                          {unreadCountForJob > 0 && (
                            <span className="px-2 py-0.5 bg-barnes-violet text-white text-xs rounded-full">
                              {unreadCountForJob} nieuw
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            router.push(`/company/vacatures/${jobId}`);
                            onClose();
                          }}
                          className="text-xs text-barnes-violet hover:underline mt-1"
                        >
                          Bekijk vacature →
                        </button>
                      </div>
                      {jobNotifications.map(notification => (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                            !notification.is_read ? 'bg-barnes-violet/5' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{getTypeIcon(notification.type)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-barnes-dark-violet">{notification.title}</p>
                                {!notification.is_read && (
                                  <span className="w-2 h-2 bg-barnes-violet rounded-full"></span>
                                )}
                              </div>
                              {notification.message && (
                                <p className="text-sm text-barnes-dark-gray line-clamp-2">
                                  {notification.message}
                                </p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(notification.created_at).toLocaleString('nl-NL')}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })}
                
                {/* Ungrouped Notifications */}
                {notificationsByVacancy.ungrouped.map(notification => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      !notification.is_read ? 'bg-barnes-violet/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getTypeIcon(notification.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-barnes-dark-violet">{notification.title}</p>
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-barnes-violet rounded-full"></span>
                          )}
                        </div>
                        {notification.message && (
                          <p className="text-sm text-barnes-dark-gray line-clamp-2">
                            {notification.message}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(notification.created_at).toLocaleString('nl-NL')}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            // History Tab
            activityHistory.length === 0 ? (
              <div className="p-8 text-center text-barnes-dark-gray">
                <p className="text-sm">Geen geschiedenis beschikbaar</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {activityHistory.map(activity => (
                  <div
                    key={activity.id}
                    className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getTypeIcon(activity.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-barnes-dark-violet">{activity.description}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                          <span>{new Date(activity.timestamp).toLocaleString('nl-NL')}</span>
                          {activity.user_name && (
                            <>
                              <span>•</span>
                              <span>{activity.user_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

