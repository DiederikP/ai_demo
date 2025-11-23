'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import CompanyNavigation from '../../../components/CompanyNavigation';
import { getAuthHeaders } from '../../../lib/auth';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  related_job_id?: string;
  related_candidate_id?: string;
  is_read: boolean;
  created_at: string;
}

interface Vacancy {
  id: string;
  title: string;
  company: string;
  created_at: string;
  candidates_count?: number;
}

export default function CompanyOverviewPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const headers = getAuthHeaders();
      
      // Load notifications
      const notifRes = await fetch('/api/notifications', { headers });
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const allNotifs = notifData.notifications || [];
        setNotifications(allNotifs);
        setUnreadCount(allNotifs.filter((n: Notification) => !n.is_read).length);
      }

      // Load vacancies
      const jobsRes = await fetch('/api/job-descriptions', { headers });
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setVacancies(jobsData.jobs || []);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const headers = getAuthHeaders();
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers,
      });
      await loadData();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const headers = getAuthHeaders();
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers,
      });
      await loadData();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-barnes-light-gray flex items-center justify-center">
          <div className="text-barnes-dark-gray">Laden...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-barnes-light-gray">
        <CompanyNavigation
          activeModule="overview"
          onModuleChange={(module) => {
            router.push(`/company/dashboard?module=${module}`);
          }}
        />
        <div className="p-4 md:p-8 transition-all duration-300" style={{ marginLeft: 'var(--nav-width, 16rem)' }}>
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-barnes-dark-violet mb-2">Overzicht</h1>
              <p className="text-sm text-barnes-dark-gray">Welkom terug! Hier is een overzicht van je activiteiten.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Notifications Panel */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-barnes-dark-violet">
                    Notificaties {unreadCount > 0 && (
                      <span className="ml-2 px-2 py-1 bg-barnes-violet text-white text-xs rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </h2>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-sm text-barnes-violet hover:underline"
                    >
                      Alles als gelezen markeren
                    </button>
                  )}
                </div>
                
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 rounded-lg border ${
                          notification.is_read
                            ? 'bg-gray-50 border-gray-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-barnes-dark-violet">
                                {notification.title}
                              </h3>
                              {!notification.is_read && (
                                <span className="w-2 h-2 bg-barnes-violet rounded-full"></span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                            <div className="flex items-center gap-3">
                              {notification.related_job_id && (
                                <button
                                  onClick={() => router.push(`/company/vacatures/${notification.related_job_id}`)}
                                  className="text-xs text-barnes-violet hover:underline"
                                >
                                  Bekijk vacature →
                                </button>
                              )}
                              {notification.related_candidate_id && (
                                <button
                                  onClick={() => router.push(`/company/kandidaten/${notification.related_candidate_id}`)}
                                  className="text-xs text-barnes-violet hover:underline"
                                >
                                  Bekijk kandidaat →
                                </button>
                              )}
                            </div>
                          </div>
                          {!notification.is_read && (
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="text-xs text-gray-500 hover:text-gray-700 ml-2"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                          {new Date(notification.created_at).toLocaleString('nl-NL')}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Geen notificaties
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="space-y-6">
                {/* Vacancies Summary */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-barnes-dark-violet mb-4">Vacatures</h2>
                  <div className="text-3xl font-bold text-barnes-violet mb-2">{vacancies.length}</div>
                  <p className="text-sm text-gray-500 mb-4">Totaal aantal vacatures</p>
                  <button
                    onClick={() => router.push('/company/dashboard?module=vacatures')}
                    className="w-full btn-secondary text-sm"
                  >
                    Bekijk alle vacatures →
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-barnes-dark-violet mb-4">Snelle Acties</h2>
                  <div className="space-y-3">
                    <button
                      onClick={() => router.push('/company/vacatures/nieuw')}
                      className="w-full btn-primary text-sm"
                    >
                      + Nieuwe Vacature
                    </button>
                    <button
                      onClick={() => router.push('/company/dashboard?module=evaluatie')}
                      className="w-full btn-secondary text-sm"
                    >
                      Nieuwe Evaluatie
                    </button>
                    <button
                      onClick={() => router.push('/company/dashboard?module=kandidaten')}
                      className="w-full btn-secondary text-sm"
                    >
                      Bekijk Kandidaten
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

