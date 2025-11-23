'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '../lib/auth';
import { useAuth } from '../contexts/AuthContext';

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

interface ActivityHistory {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  user_name?: string;
}

export default function CompanyNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activityHistory, setActivityHistory] = useState<ActivityHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'notifications' | 'history'>('notifications');
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      loadNotifications();
      loadActivityHistory();
    }
  }, [user?.id]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/notifications?user_id=${user?.id}&unread_only=false`, { headers });
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
      const headers = getAuthHeaders();
      const [notificationsRes, resultsRes] = await Promise.all([
        fetch(`/api/notifications?user_id=${user?.id}&unread_only=false`, { headers }),
        fetch('/api/evaluation-results', { headers })
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
      
      // Sort by timestamp (newest first)
      history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivityHistory(history);
    } catch (error) {
      console.error('Error loading activity history:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const headers = getAuthHeaders();
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers
      });
      await loadNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const headers = getAuthHeaders();
      await Promise.all(
        notifications.filter(n => !n.is_read).map(n =>
          fetch(`/api/notifications/${n.id}/read`, {
            method: 'PUT',
            headers
          })
        )
      );
      await loadNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-barnes-dark-violet mb-2">Notificaties</h1>
        <p className="text-barnes-dark-gray">
          Bekijk alle notificaties en activiteiten
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-6 py-4 font-medium transition-colors ${
              activeTab === 'notifications'
                ? 'text-barnes-violet border-b-2 border-barnes-violet'
                : 'text-barnes-dark-gray hover:text-barnes-violet'
            }`}
          >
            Notificaties {unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-barnes-violet text-white text-xs rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-4 font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-barnes-violet border-b-2 border-barnes-violet'
                : 'text-barnes-dark-gray hover:text-barnes-violet'
            }`}
          >
            Activiteiten Geschiedenis
          </button>
        </div>

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-8 text-barnes-dark-gray">Laden...</div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-barnes-dark-gray">Geen notificaties</p>
              </div>
            ) : (
              <div className="space-y-4">
                {unreadCount > 0 && (
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={markAllAsRead}
                      className="text-sm text-barnes-violet hover:text-barnes-dark-violet"
                    >
                      Markeer alles als gelezen
                    </button>
                  </div>
                )}
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      notification.is_read
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-barnes-violet rounded-full"></span>
                          )}
                          <h3 className="font-medium text-barnes-dark-violet">{notification.title}</h3>
                        </div>
                        {notification.message && (
                          <p className="text-sm text-barnes-dark-gray mt-1">{notification.message}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(notification.created_at).toLocaleString('nl-NL')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-barnes-violet hover:text-barnes-dark-violet"
                          >
                            Markeer als gelezen
                          </button>
                        )}
                        {notification.related_candidate_id && (
                          <button
                            onClick={() => router.push(`/company/kandidaten/${notification.related_candidate_id}`)}
                            className="text-xs text-barnes-violet hover:text-barnes-dark-violet"
                          >
                            Bekijk kandidaat →
                          </button>
                        )}
                        {notification.related_job_id && (
                          <button
                            onClick={() => router.push(`/company/vacatures/${notification.related_job_id}`)}
                            className="text-xs text-barnes-violet hover:text-barnes-dark-violet"
                          >
                            Bekijk vacature →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="p-6">
            {activityHistory.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-barnes-dark-gray">Geen activiteiten</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activityHistory.map((activity) => (
                  <div
                    key={activity.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-barnes-dark-gray">{activity.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(activity.timestamp).toLocaleString('nl-NL')}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">{activity.user_name || 'Systeem'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

