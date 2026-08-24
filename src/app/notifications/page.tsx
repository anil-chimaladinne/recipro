'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Coins,
  ShieldCheck,
  Video,
  BookOpen,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  Mail,
  Check,
  Sparkles,
  Inbox,
} from 'lucide-react';

export default function NotificationsInboxPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [pagination, setPagination] = useState<any>({ total: 0, totalPages: 1, page: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Notification Preferences Drawer
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [preferences, setPreferences] = useState<any>({
    in_app_enabled: 1,
    email_enabled: 1,
    session_updates: 1,
    mentor_available: 1,
    credits: 1,
    security: 1,
    system: 1,
  });

  const fetchNotifications = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const query = new URLSearchParams({
        category: activeCategory,
        unreadOnly: unreadOnly ? 'true' : 'false',
        page: page.toString(),
        limit: '15',
      });
      const res = await fetch(`/api/notifications?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setPagination(data.pagination || { total: 0, totalPages: 1, page: 1 });
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const res = await fetch('/api/notifications/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.preferences) setPreferences(data.preferences);
      }
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    fetchPreferences();
  }, [activeCategory, unreadOnly, page]);

  // Live polling every 4s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeCategory, unreadOnly, page]);

  const markSingleAsRead = async (notificationId: string) => {
    try {
      const res = await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === notificationId ? { ...n, is_read: 1 } : n))
        );
        setUnreadCount(c => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const markAllAsRead = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'POST' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all read:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const savePreferences = async (newPrefs: any) => {
    setPreferences(newPrefs);
    try {
      await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPrefs),
      });
    } catch (err) {
      console.error('Failed to save preferences:', err);
    }
  };

  const getCategoryIcon = (type: string) => {
    if (type.startsWith('SESSION_')) return <Video className="w-4 h-4 text-emerald-400" />;
    if (type === 'MENTOR_AVAILABLE') return <Sparkles className="w-4 h-4 text-brand-400" />;
    if (type.startsWith('CREDIT_')) return <Coins className="w-4 h-4 text-indigo-400" />;
    if (type.startsWith('SECURITY_')) return <ShieldCheck className="w-4 h-4 text-rose-400" />;
    return <Bell className="w-4 h-4 text-cyan-400" />;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center font-bold text-xl relative">
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-extrabold text-[10px] ring-2 ring-slate-950">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Notifications &amp; Activity</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Live updates on session bookings, mentor availability matches, and escrow credit settlements.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              disabled={actionLoading}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mark all as read</span>
            </button>
          )}

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2.5 rounded-xl border transition-colors ${
              showSettings
                ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
            }`}
            title="Notification Settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Modal Drawer */}
      {showSettings && (
        <div className="glass-panel p-6 rounded-3xl border border-brand-500/30 bg-slate-950/90 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-brand-400" />
              <span>Multi-Channel Notification Preferences</span>
            </h3>
            <button onClick={() => setShowSettings(false)} className="text-xs text-slate-400 hover:text-white">
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="font-bold text-white block">Channels</span>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={preferences.in_app_enabled === 1}
                  onChange={(e) => savePreferences({ ...preferences, in_app_enabled: e.target.checked ? 1 : 0 })}
                  className="rounded border-slate-700 text-brand-500"
                />
                <span>In-App Notifications</span>
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={preferences.email_enabled === 1}
                  onChange={(e) => savePreferences({ ...preferences, email_enabled: e.target.checked ? 1 : 0 })}
                  className="rounded border-slate-700 text-brand-500"
                />
                <span>Email Notifications</span>
              </label>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="font-bold text-white block">Alert Categories</span>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={preferences.mentor_available === 1}
                  onChange={(e) => savePreferences({ ...preferences, mentor_available: e.target.checked ? 1 : 0 })}
                />
                <span>Mentor Available Alerts</span>
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={preferences.session_updates === 1}
                  onChange={(e) => savePreferences({ ...preferences, session_updates: e.target.checked ? 1 : 0 })}
                />
                <span>Session Status &amp; Scheduling</span>
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={preferences.credits === 1}
                  onChange={(e) => savePreferences({ ...preferences, credits: e.target.checked ? 1 : 0 })}
                />
                <span>Credit Transfers &amp; Settlement</span>
              </label>
              <label className="flex items-center gap-2 text-slate-400 opacity-70">
                <input type="checkbox" checked disabled />
                <span>Security Alerts (Mandatory)</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'ALL', label: 'All Notifications' },
          { id: 'SESSIONS', label: '🎥 Sessions' },
          { id: 'MENTORS', label: '✨ Mentor Available' },
          { id: 'LEARNING_REQUESTS', label: '📚 Learner Requests' },
          { id: 'CREDITS', label: '🪙 Credits' },
          { id: 'SECURITY', label: '🛡️ Security' },
          { id: 'SYSTEM', label: '⚙️ System' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveCategory(tab.id); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === tab.id
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-slate-400 flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }}
              className="rounded border-slate-700 text-brand-500"
            />
            <span>Unread Only</span>
          </label>
        </div>
      </div>

      {/* Notifications Feed */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-400" />
            <p>Loading notification feed...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center space-y-3">
            <Inbox className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">Your Inbox is Clear</h3>
            <p className="text-xs text-slate-400">No notifications found in this category.</p>
          </div>
        ) : (
          notifications.map((notif: any) => (
            <div
              key={notif.id}
              className={`glass-panel p-4 sm:p-5 rounded-2xl border transition-all flex items-start gap-4 ${
                notif.is_read
                  ? 'border-slate-800/80 bg-slate-950/40 opacity-80 hover:opacity-100'
                  : 'border-brand-500/40 bg-slate-950/90 shadow-glow-sm'
              }`}
            >
              {/* Category Icon */}
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                {getCategoryIcon(notif.type)}
              </div>

              {/* Message Content */}
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{notif.title}</span>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                    )}
                  </h4>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{notif.message}</p>

                {/* Direct Action Link */}
                <div className="pt-2 flex items-center gap-3">
                  {notif.action_url && (
                    <Link
                      href={notif.action_url}
                      onClick={() => markSingleAsRead(notif.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-extrabold text-xs shadow-glow-brand transition-all inline-flex items-center gap-1"
                    >
                      <span>
                        {notif.type === 'MENTOR_AVAILABLE' ? 'Review & Take Course' :
                         notif.type.startsWith('SESSION_') ? 'View Session' :
                         notif.type.startsWith('CREDIT_') ? 'View Wallet' : 'View Details'}
                      </span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}

                  {!notif.is_read && (
                    <button
                      onClick={() => markSingleAsRead(notif.id)}
                      className="text-[11px] text-slate-400 hover:text-white font-semibold transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Mark Read</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} notifications)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
