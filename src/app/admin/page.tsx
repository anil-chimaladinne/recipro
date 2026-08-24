'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Activity, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Coins, 
  Search, 
  Filter, 
  Download, 
  ArrowRight, 
  ShieldAlert, 
  Users, 
  BookOpen, 
  RefreshCw, 
  Lock,
  ChevronRight,
  TrendingUp,
  Award,
  Video,
  Sparkles,
  ShieldCheck,
  Check,
  Globe
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { user, loading: authLoading, login } = useAuth();
  const router = useRouter();

  // Admin login portal state
  const [adminEmail, setAdminEmail] = useState('admin@skillswap.campus.edu');
  const [adminPassword, setAdminPassword] = useState('Password123!');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Date selection state (Defaults to today or ALL)
  const todayStr = new Date().toISOString().substring(0, 10);
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toISOString().substring(0, 10);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr); // Default to Today for Day-wise data!
  const [dailyReport, setDailyReport] = useState<any | null>(null);
  const [reportLoading, setReportLoading] = useState(true);

  // User search & filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [userPage, setUserPage] = useState(1);
  const [usersData, setUsersData] = useState<any | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);

  // Sessions Directory State
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState('ALL');
  const [sessionDateFilter, setSessionDateFilter] = useState('ALL');
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionsData, setSessionsData] = useState<any | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SESSIONS' | 'USERS' | 'REQUESTS'>('OVERVIEW');

  // Fetch Daily Report & Platform Overview
  const fetchDailyReport = async (dateStr: string) => {
    setReportLoading(true);
    try {
      const res = await fetch(`/api/admin/reports/daily?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setDailyReport(data);
      }
    } catch (err) {
      console.error('Failed to load daily report:', err);
    } finally {
      setReportLoading(false);
    }
  };

  // Fetch User Activity List
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const query = new URLSearchParams({
        search: searchTerm,
        role: roleFilter,
        status: statusFilter,
        page: userPage.toString(),
        limit: '15',
      });
      const res = await fetch(`/api/admin/reports/users?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsersData(data);
      }
    } catch (err) {
      console.error('Failed to load users report:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  // Fetch Comprehensive Sessions Directory
  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const query = new URLSearchParams({
        search: sessionSearch,
        status: sessionStatusFilter,
        date: sessionDateFilter,
        page: sessionPage.toString(),
        limit: '15',
      });
      const res = await fetch(`/api/admin/reports/sessions?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSessionsData(data);
      }
    } catch (err) {
      console.error('Failed to load sessions directory:', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Refresh All Reports
  const refreshAll = () => {
    fetchDailyReport(selectedDate);
    fetchSessions();
    fetchUsers();
  };

  // Load and setup live polling
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      refreshAll();
      const interval = setInterval(() => {
        // Background live refresh
        fetch(`/api/admin/reports/daily?date=${selectedDate}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) setDailyReport(d); })
          .catch(() => {});
        
        const query = new URLSearchParams({
          search: sessionSearch,
          status: sessionStatusFilter,
          date: sessionDateFilter,
          page: sessionPage.toString(),
          limit: '15',
        });
        fetch(`/api/admin/reports/sessions?${query.toString()}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) setSessionsData(d); })
          .catch(() => {});
      }, 4000);

      return () => clearInterval(interval);
    }
  }, [user, selectedDate, sessionStatusFilter, sessionDateFilter, sessionPage]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    fetchDailyReport(newDate);
  };

  const handleUserSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setUserPage(1);
    fetchUsers();
  };

  const handleSessionSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSessionPage(1);
    fetchSessions();
  };

  const handleAdminLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const ok = await login(adminEmail, adminPassword);
      if (!ok) {
        setLoginError('Invalid administrator credentials.');
      } else {
        refreshAll();
      }
    } catch (err: any) {
      setLoginError('Failed to sign in as Administrator');
    } finally {
      setLoginLoading(false);
    }
  };

  // Authorization Guard & Inline Admin Login Portal
  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-xs text-slate-400">
        Verifying administrative authorization...
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 space-y-6">
        <div className="glass-panel p-8 rounded-3xl border border-rose-500/30 bg-slate-950/80 shadow-2xl space-y-6 text-center">
          
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>

          <div>
            <h2 className="text-xl font-extrabold text-white">Campus Administrator Portal</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Access to <code className="text-rose-400 bg-slate-900 px-1.5 py-0.5 rounded font-mono">/admin</code> requires authenticated Administrator credentials.
            </p>
          </div>

          {user && (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 text-left space-y-1">
              <div className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">Currently Logged In As:</div>
              <div className="font-bold text-white">{user.display_name} ({user.email})</div>
              <div className="text-[11px] text-amber-400">Current Role: <span className="font-mono">{user.role}</span> (Non-Admin)</div>
            </div>
          )}

          {loginError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold text-left">
              {loginError}
            </div>
          )}

          {/* Inline Admin Login Form */}
          <form onSubmit={handleAdminLogin} className="space-y-4 text-left">
            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                Admin Email
              </label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@skillswap.campus.edu"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                Admin Password
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-glow-rose transition-all flex items-center justify-center gap-2"
            >
              <Lock className={`w-3.5 h-3.5 ${loginLoading ? 'animate-spin' : ''}`} />
              <span>{loginLoading ? 'Authenticating...' : 'Sign In as Campus Administrator'}</span>
            </button>
          </form>

          {/* Quick Access Switch */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setAdminEmail('admin@skillswap.campus.edu');
                setAdminPassword('Password123!');
                handleAdminLogin();
              }}
              className="text-brand-400 hover:underline font-semibold text-[11px]"
            >
              1-Click Admin Authenticate
            </button>

            <Link href="/" className="text-slate-400 hover:text-white transition-colors text-[11px]">
              Back to Campus Home &rarr;
            </Link>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      
      {/* Platform-Wide Lifetime Live Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold text-xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white">SkillSwap Campus Admin Dashboard</h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Real-Time
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Authoritative operational monitoring, state machine auditing, and real-time escrow flow
            </p>
          </div>
        </div>

        {/* Date Filter & Day-Wise Mode Selector */}
        <div className="flex flex-wrap items-center gap-2">
          
          <button
            onClick={() => handleDateChange(todayStr)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
              selectedDate === todayStr
                ? 'bg-brand-500 text-dark-bg border-brand-400 shadow-glow-brand'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Today
          </button>

          <button
            onClick={() => handleDateChange(yesterdayStr)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
              selectedDate === yesterdayStr
                ? 'bg-brand-500 text-dark-bg border-brand-400 shadow-glow-brand'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            Yesterday
          </button>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Date:</span>
            <input
              type="date"
              value={selectedDate === 'ALL' ? todayStr : selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none"
            />
          </div>

          <button
            onClick={() => handleDateChange('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              selectedDate === 'ALL'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> Lifetime (Metrics Only)
          </button>

          <button
            onClick={refreshAll}
            disabled={reportLoading || sessionsLoading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title="Refresh live data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reportLoading || sessionsLoading ? 'animate-spin' : ''}`} />
          </button>

          <a
            href={`/api/admin/reports/export?type=daily&date=${selectedDate}`}
            download
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-1.5"
            title="Download CSV report"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Platform-Wide Lifetime Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">All-Time Sessions</span>
          <div className="text-xl font-extrabold text-white">{dailyReport?.platformLifetimeStats?.totalLifetimeSessions ?? 0}</div>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Active / Scheduled</span>
          <div className="text-xl font-extrabold text-emerald-300">{dailyReport?.platformLifetimeStats?.activeSessions ?? 0}</div>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl border border-brand-500/30 bg-brand-500/5 space-y-1">
          <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">Completed / Settled</span>
          <div className="text-xl font-extrabold text-brand-300">{dailyReport?.platformLifetimeStats?.completedSessions ?? 0}</div>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-1">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Disputed Sessions</span>
          <div className="text-xl font-extrabold text-amber-300">{dailyReport?.platformLifetimeStats?.disputedSessions ?? 0}</div>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 space-y-1">
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Escrow Locked</span>
          <div className="text-xl font-extrabold text-indigo-300">{dailyReport?.platformLifetimeStats?.totalEscrowLocked ?? 0} Credits</div>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 space-y-1">
          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Platform Users</span>
          <div className="text-xl font-extrabold text-cyan-300">{dailyReport?.platformLifetimeStats?.totalUsersCount ?? 0}</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'OVERVIEW'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          {selectedDate === 'ALL' ? 'Lifetime Metrics (Platform Total)' : `Day-Wise Report (${selectedDate})`}
        </button>
        <button
          onClick={() => {
            setActiveTab('SESSIONS');
            fetchSessions();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'SESSIONS'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          Campus Sessions Directory ({sessionsData?.pagination?.total ?? (dailyReport?.platformLifetimeStats?.totalLifetimeSessions || 0)})
        </button>
        <button
          onClick={() => {
            setActiveTab('USERS');
            fetchUsers();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'USERS'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          User Activity Reports ({usersData?.pagination?.totalUsers ?? (dailyReport?.platformLifetimeStats?.totalUsersCount || 0)})
        </button>
        <button
          onClick={() => setActiveTab('REQUESTS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'REQUESTS'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          Learner Demand Requests ({dailyReport?.learningRequests?.length || 0})
        </button>
      </div>

      {/* TAB 1: OVERVIEW & BREAKDOWN */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          
          {/* Active Mode Notice Banner */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {selectedDate === 'ALL' ? (
                <Globe className="w-5 h-5 text-indigo-400 shrink-0" />
              ) : (
                <Calendar className="w-5 h-5 text-brand-400 shrink-0" />
              )}
              <div>
                <strong className="text-white text-xs block font-bold">
                  {selectedDate === 'ALL' 
                    ? 'Platform Lifetime Mode — Displaying High-Level Aggregate Metrics'
                    : `Day-Wise Mode — Showing Detailed Chronological Events & Sessions for ${selectedDate}`
                  }
                </strong>
                <p className="text-[11px] text-slate-400">
                  {selectedDate === 'ALL'
                    ? 'For maximum performance, lifetime records show aggregate platform totals. To inspect granular chronological session events, select a specific date.'
                    : 'Displaying exact chronological sequence of session lifecycle events ("what happened first, then what happened next") and session details for this date.'
                  }
                </p>
              </div>
            </div>

            {selectedDate === 'ALL' ? (
              <button
                onClick={() => handleDateChange(todayStr)}
                className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shrink-0 shadow-glow-brand transition-all"
              >
                Inspect Today's Timeline &rarr;
              </button>
            ) : (
              <button
                onClick={() => handleDateChange('ALL')}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs shrink-0 border border-slate-700 transition-colors"
              >
                Switch to Lifetime Metrics
              </button>
            )}
          </div>

          {/* Main Stat Counters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {selectedDate === 'ALL' ? 'Lifetime Sessions' : 'Day Sessions'}
              </span>
              <div className="text-2xl font-extrabold text-white">{dailyReport?.overview?.totalSessions ?? 0}</div>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-brand-400 uppercase tracking-wider">Completed</span>
              <div className="text-2xl font-extrabold text-brand-300">{dailyReport?.overview?.completedSessions ?? 0}</div>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Cancelled</span>
              <div className="text-2xl font-extrabold text-rose-300">{dailyReport?.overview?.cancelledSessions ?? 0}</div>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Disputed</span>
              <div className="text-2xl font-extrabold text-amber-300">{dailyReport?.overview?.disputedSessions ?? 0}</div>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">Skill Exchanges</span>
              <div className="text-2xl font-extrabold text-cyan-300">{dailyReport?.overview?.successfulSkillExchanges ?? 0}</div>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Credit Sessions</span>
              <div className="text-2xl font-extrabold text-indigo-300">{dailyReport?.overview?.creditBasedSessions ?? 0}</div>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending</span>
              <div className="text-2xl font-extrabold text-slate-200">{dailyReport?.overview?.pendingSessions ?? 0}</div>
            </div>
          </div>

          {/* Detailed Two-Col Breakdown: Session Outcomes & Credit Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Box A: Daily / Lifetime Session Classification */}
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-brand-400" />
                  <span>Session Outcome &amp; Settlement Classification</span>
                </h3>
                <span className="text-xs text-slate-400">{selectedDate === 'ALL' ? 'Lifetime Total' : selectedDate}</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-300">Total Filtered Sessions</span>
                  <strong className="text-white font-mono text-sm">{dailyReport?.sessionStats?.totalScheduled ?? 0}</strong>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-300">Total Started / Live Sessions</span>
                  <strong className="text-cyan-300 font-mono text-sm">{dailyReport?.sessionStats?.totalStarted ?? 0}</strong>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-300">Direct Skill-for-Skill Exchanges</span>
                  <strong className="text-brand-300 font-mono text-sm">{dailyReport?.sessionStats?.directSkillExchanges ?? 0}</strong>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-300">Credit-Compensated Sessions</span>
                  <strong className="text-indigo-300 font-mono text-sm">{dailyReport?.sessionStats?.creditSettledSessions ?? 0}</strong>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-300">No-Shows / Participant Fault</span>
                  <strong className="text-rose-300 font-mono text-sm">{dailyReport?.sessionStats?.totalNoShows ?? 0}</strong>
                </div>
              </div>
            </div>

            {/* Box B: Credit Activity Ledger */}
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-brand-400" />
                  <span>Skill Credit Flows &amp; Escrow</span>
                </h3>
                <span className="text-xs text-slate-400">{dailyReport?.creditActivity?.transactionCount ?? 0} Transactions</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">Credits Earned</span>
                  <div className="text-lg font-bold text-brand-400">+{dailyReport?.creditActivity?.creditsEarned ?? 0}</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">Credits Spent</span>
                  <div className="text-lg font-bold text-indigo-400">-{dailyReport?.creditActivity?.creditsSpent ?? 0}</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">Credits Refunded</span>
                  <div className="text-lg font-bold text-cyan-400">{dailyReport?.creditActivity?.creditsRefunded ?? 0}</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">Disputed Credits (Frozen)</span>
                  <div className="text-lg font-bold text-rose-400">{dailyReport?.creditActivity?.creditsDisputed ?? 0}</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Total Volume Transferred:</span>
                <strong className="text-brand-300 text-sm">{dailyReport?.creditActivity?.totalTransferred ?? 0} Skill Credits</strong>
              </div>
            </div>

          </div>

          {/* ============================================================ */}
          {/* CASE 1: SPECIFIC DAY SELECTED — CHRONOLOGICAL TIMELINE & DETAILS */}
          {/* ============================================================ */}
          {selectedDate !== 'ALL' && (
            <div className="space-y-6">
              
              {/* Chronological Step-by-Step Sequence ("What happened first, then what happened next") */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-brand-400" />
                    <h3 className="text-sm font-extrabold text-white">
                      Day Event Timeline: What Happened First &rarr; Next ({selectedDate})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {dailyReport?.dayTimelineEvents?.length || 0} Chronological Events
                  </span>
                </div>

                {(!dailyReport?.dayTimelineEvents || dailyReport.dayTimelineEvents.length === 0) ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No session audit events logged for {selectedDate}.
                  </div>
                ) : (
                  <div className="space-y-3 relative before:absolute before:left-[17px] before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
                    {dailyReport.dayTimelineEvents.map((evt: any, idx: number) => {
                      const timeStr = new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      return (
                        <div key={evt.id || idx} className="relative flex items-start gap-4 pl-1 group">
                          {/* Step Number Badge */}
                          <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-brand-500/60 text-brand-300 font-extrabold text-xs flex items-center justify-center shrink-0 z-10 group-hover:scale-110 transition-transform">
                            {idx + 1}
                          </div>

                          {/* Event Card */}
                          <div className="flex-1 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2.5 py-0.5 rounded font-extrabold border ${
                                  evt.event_type.includes('COMPLETED') || evt.event_type.includes('SETTLED') ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                  evt.event_type.includes('STARTED') || evt.event_type.includes('JOINED') ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' :
                                  evt.event_type.includes('ACCEPTED') || evt.event_type.includes('SCHEDULED') ? 'bg-brand-500/20 text-brand-300 border-brand-500/30' :
                                  evt.event_type.includes('CANCELLED') || evt.event_type.includes('DISPUTED') ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                                  'bg-slate-800 text-slate-300 border-slate-700'
                                }`}>
                                  {evt.event_type}
                                </span>
                                <strong className="text-white text-xs font-bold">{evt.title}</strong>
                              </div>

                              <span className="text-[11px] font-mono text-slate-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                {timeStr}
                              </span>
                            </div>

                            <p className="text-xs text-slate-300 leading-relaxed">
                              {evt.description}
                            </p>

                            {/* Participant & Return Terms Breakdown */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                              <div className="flex flex-wrap items-center gap-3 text-slate-400">
                                <div>
                                  <strong className="text-slate-300">Skill:</strong> {evt.skill_name || 'Skill'} ({evt.session_id})
                                </div>
                                <div>
                                  <strong className="text-brand-400">Mentor:</strong> {evt.teacher_name || 'Mentor'}{' '}
                                  {evt.mentor_verification_status === 'PLATFORM_VERIFIED' && (
                                    <span className="text-[10px] text-emerald-400 font-bold ml-0.5">✓ Verified</span>
                                  )}
                                  {evt.teacher_college && <span className="text-slate-500"> ({evt.teacher_college})</span>}
                                </div>
                                <div>
                                  <strong className="text-indigo-400">Learner:</strong> {evt.learner_name || 'Learner'}
                                  {evt.learner_college && <span className="text-slate-500"> ({evt.learner_college})</span>}
                                </div>
                              </div>

                              {/* Return Terms Badge */}
                              <div className="flex items-center gap-2">
                                {evt.agreement_return_type === 'SKILL' ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                                    🔄 Return Skill: {evt.requested_return_skill_name} ({evt.agreement_status || 'AGREED'})
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                                    🪙 Return Credits: {evt.credits_amount || 1} Credit
                                  </span>
                                )}

                                {evt.previous_state && evt.new_state && (
                                  <div className="font-mono text-[10px] bg-slate-950 px-2 py-0.5 rounded text-slate-400 border border-slate-800">
                                    <span className="text-slate-300">{evt.previous_state}</span> &rarr; <span className="text-emerald-400 font-bold">{evt.new_state}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Day's Detailed Sessions Table */}
              <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Day Sessions Details List ({dailyReport?.sessions?.length || 0})</h3>
                  <span className="text-xs text-slate-400">Date: {selectedDate}</span>
                </div>

                {(!dailyReport?.sessions || dailyReport.sessions.length === 0) ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No sessions recorded on {selectedDate}.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[11px] text-slate-400 uppercase border-b border-slate-800 bg-slate-900/40">
                        <tr>
                          <th className="py-2.5 px-3">Session ID &amp; Time</th>
                          <th className="py-2.5 px-3">Skill &amp; Category</th>
                          <th className="py-2.5 px-3">Teaching Mentor</th>
                          <th className="py-2.5 px-3">Learner</th>
                          <th className="py-2.5 px-3">Return Exchange Terms</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Settlement</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {dailyReport.sessions.map((sess: any) => (
                          <tr key={sess.id} className="hover:bg-slate-900/30 transition-colors">
                            <td className="py-3 px-3">
                              <div className="font-mono text-[11px] text-slate-300 font-bold">{sess.id}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {sess.scheduled_start?.substring(11, 16) || 'Scheduled'}
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <div className="font-bold text-white">{sess.skill_name}</div>
                              <div className="text-[10px] text-brand-400">{sess.skill_category}</div>
                            </td>

                            <td className="py-3 px-3">
                              <div className="font-bold text-white flex items-center gap-1">
                                <span>{sess.teacher_name}</span>
                                {sess.mentor_verification_status === 'PLATFORM_VERIFIED' && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                                    ✓ Verified
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {sess.teacher_college || 'Campus'} {sess.teacher_major ? `• ${sess.teacher_major}` : ''}
                              </div>
                              {sess.teacher_email && (
                                <div className="text-[10px] text-slate-500 font-mono">{sess.teacher_email}</div>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              <div className="font-bold text-white">{sess.learner_name}</div>
                              <div className="text-[10px] text-slate-400">
                                {sess.learner_college || 'Campus'} {sess.learner_major ? `• ${sess.learner_major}` : ''}
                              </div>
                              {sess.learner_email && (
                                <div className="text-[10px] text-slate-500 font-mono">{sess.learner_email}</div>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              {sess.agreement_return_type === 'SKILL' ? (
                                <div className="space-y-0.5">
                                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 inline-flex items-center gap-1">
                                    🔄 Return Skill: {sess.requested_return_skill_name || 'Agreed'}
                                  </span>
                                  <div className="text-[9px] text-slate-400">Agreement: {sess.agreement_status || 'PROPOSED'}</div>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/40 inline-flex items-center gap-1">
                                    🪙 Return Credits: {sess.credits_amount || 1} Skill Credit
                                  </span>
                                  <div className="text-[9px] text-slate-400">
                                    {sess.status === 'CREDIT_SETTLED' ? 'Settled to Mentor' : 'Held in Escrow'}
                                  </div>
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              <span className={`text-[10px] px-2.5 py-1 rounded-xl font-extrabold border inline-flex items-center gap-1.5 ${
                                sess.status === 'CREDIT_SETTLED' || sess.status === 'COMPLETED' ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' :
                                sess.status === 'IN_PROGRESS' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse' :
                                sess.status === 'SCHEDULED' ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' :
                                sess.status === 'DISPUTED' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                                'bg-slate-800 text-slate-300 border-slate-700'
                              }`}>
                                {sess.status}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-slate-300 font-semibold">{sess.settlement_classification}</td>

                            <td className="py-3 px-3 text-right">
                              <Link
                                href={`/admin/sessions/${sess.id}`}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700 inline-flex items-center gap-1"
                              >
                                Inspect <ChevronRight className="w-3 h-3" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* CASE 2: LIFETIME SELECTED — DAY-WISE METRICS SUMMARY BREAKDOWN */}
          {/* ============================================================ */}
          {selectedDate === 'ALL' && (
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                    <span>Day-Wise Historical Metrics Summary (Past 30 Days)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Aggregated daily totals. Click "Inspect Day" on any date to view its full chronological event timeline.
                  </p>
                </div>
              </div>

              {(!dailyReport?.lifetimeDayWiseMetrics || dailyReport.lifetimeDayWiseMetrics.length === 0) ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No historical day metrics recorded.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[11px] text-slate-400 uppercase border-b border-slate-800 bg-slate-900/40">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Total Sessions</th>
                        <th className="py-2.5 px-3">Completed</th>
                        <th className="py-2.5 px-3">Live In-Progress</th>
                        <th className="py-2.5 px-3">Cancelled</th>
                        <th className="py-2.5 px-3">Disputed</th>
                        <th className="py-2.5 px-3">Credits Volume</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {dailyReport.lifetimeDayWiseMetrics.map((day: any) => (
                        <tr key={day.session_date} className="hover:bg-slate-900/30 transition-colors">
                          <td className="py-3 px-3 font-bold text-white font-mono">{day.session_date}</td>
                          <td className="py-3 px-3 text-white font-semibold">{day.total_sessions}</td>
                          <td className="py-3 px-3 text-emerald-300 font-semibold">{day.completed_sessions}</td>
                          <td className="py-3 px-3 text-sky-300 font-semibold">{day.in_progress_sessions}</td>
                          <td className="py-3 px-3 text-rose-300 font-semibold">{day.cancelled_sessions}</td>
                          <td className="py-3 px-3 text-amber-300 font-semibold">{day.disputed_sessions}</td>
                          <td className="py-3 px-3 text-brand-300 font-bold font-mono">{day.total_credits_volume || 0} Credits</td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleDateChange(day.session_date)}
                              className="px-3 py-1 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 font-bold text-[11px] border border-brand-500/30 inline-flex items-center gap-1"
                            >
                              Inspect Day &rarr;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* TAB 2: COMPREHENSIVE CAMPUS SESSIONS DIRECTORY */}
      {activeTab === 'SESSIONS' && (
        <div className="space-y-6">
          
          {/* Quick Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'ALL', label: 'All Sessions' },
              { id: 'IN_PROGRESS', label: '🟢 Live In-Progress' },
              { id: 'SCHEDULED', label: '📅 Scheduled' },
              { id: 'ACCEPTED', label: '🤝 Accepted' },
              { id: 'COMPLETED', label: '✓ Completed' },
              { id: 'CREDIT_SETTLED', label: '🪙 Credit Settled' },
              { id: 'DISPUTED', label: '⚠️ Disputed' },
              { id: 'CANCELLED', label: '❌ Cancelled' },
            ].map(pill => (
              <button
                key={pill.id}
                onClick={() => {
                  setSessionStatusFilter(pill.id);
                  setSessionPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  sessionStatusFilter === pill.id
                    ? 'bg-brand-500 text-dark-bg shadow-glow-brand'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Search & Status Filter Bar */}
          <form onSubmit={handleSessionSearch} className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                placeholder="Search skill name, mentor, learner, email, or session ID..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={sessionDateFilter}
                onChange={(e) => setSessionDateFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2"
              >
                <option value="ALL">All Dates (Lifetime)</option>
                <option value={todayStr}>Today ({todayStr})</option>
              </select>

              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand"
              >
                Search Sessions
              </button>
            </div>
          </form>

          {/* Sessions List Table */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Video className="w-4 h-4 text-brand-400" />
                <span>Live Campus Sessions Directory ({sessionsData?.pagination?.total ?? 0})</span>
              </h3>
              <button
                onClick={fetchSessions}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold border border-slate-700 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3 h-3 ${sessionsLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            {sessionsLoading ? (
              <div className="py-16 text-center text-xs text-slate-400">Loading live sessions from database...</div>
            ) : (!sessionsData?.sessions || sessionsData.sessions.length === 0) ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No sessions found matching your filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] text-slate-400 uppercase border-b border-slate-800 bg-slate-900/40">
                    <tr>
                      <th className="py-2.5 px-3">Session ID &amp; Time</th>
                      <th className="py-2.5 px-3">Skill &amp; Category</th>
                      <th className="py-2.5 px-3">Teaching Mentor</th>
                      <th className="py-2.5 px-3">Learner</th>
                      <th className="py-2.5 px-3">Return Agreement</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Settlement</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {sessionsData.sessions.map((sess: any) => (
                      <tr key={sess.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-mono text-[11px] text-slate-300">{sess.id}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(sess.scheduled_start).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(sess.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-bold text-white">{sess.skill_name}</div>
                          <div className="text-[11px] text-brand-400">{sess.skill_category}</div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-bold text-white">{sess.teacher_name}</div>
                          <div className="text-[10px] text-slate-400">{sess.teacher_college} • {sess.teacher_email}</div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-bold text-white">{sess.learner_name}</div>
                          <div className="text-[10px] text-slate-400">{sess.learner_college} • {sess.learner_email}</div>
                        </td>

                        <td className="py-3 px-3">
                          {sess.agreement_status === 'ACCEPTED' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 inline-flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" /> Return: {sess.requested_return_skill_name || 'Agreed'}
                            </span>
                          ) : sess.agreement_status === 'PROPOSED' ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                              ⏳ Proposed: {sess.requested_return_skill_name}
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700">
                              {sess.credits_amount || 1} Escrow Credit(s)
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span className={`text-[10px] px-2.5 py-1 rounded-xl font-extrabold border inline-flex items-center gap-1.5 ${
                            sess.status === 'CREDIT_SETTLED' || sess.status === 'COMPLETED' ? 'bg-brand-500/20 text-brand-300 border-brand-500/40' :
                            sess.status === 'IN_PROGRESS' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse' :
                            sess.status === 'SCHEDULED' ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' :
                            sess.status === 'DISPUTED' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                            'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {sess.status === 'IN_PROGRESS' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
                            {sess.status}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-semibold text-slate-300">
                          {sess.settlement_classification}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <Link
                            href={`/admin/sessions/${sess.id}`}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700 inline-flex items-center gap-1 transition-colors"
                          >
                            <span>Audit Deep-Dive</span>
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {sessionsData?.pagination && sessionsData.pagination.totalPages > 1 && (
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Page {sessionsData.pagination.page} of {sessionsData.pagination.totalPages} ({sessionsData.pagination.total} total sessions)</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={sessionPage <= 1}
                    onClick={() => { setSessionPage(p => p - 1); fetchSessions(); }}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={sessionPage >= sessionsData.pagination.totalPages}
                    onClick={() => { setSessionPage(p => p + 1); fetchSessions(); }}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 3: USER-WISE ACTIVITY REPORTS */}
      {activeTab === 'USERS' && (
        <div className="space-y-6">
          
          {/* User Search & Filters Bar */}
          <form onSubmit={handleUserSearch} className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search user name, email, or user ID..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2"
              >
                <option value="ALL">All Roles</option>
                <option value="STUDENT">Student</option>
                <option value="MODERATOR">Moderator</option>
                <option value="ADMIN">Admin</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>

              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand"
              >
                Filter Users
              </button>
            </div>
          </form>

          {/* User List Table */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Platform Members ({usersData?.pagination?.totalUsers ?? 0})</h3>
            </div>

            {usersLoading ? (
              <div className="py-16 text-center text-xs text-slate-400">Loading user activity data...</div>
            ) : (!usersData?.users || usersData.users.length === 0) ? (
              <div className="py-16 text-center text-xs text-slate-400">No users found matching your criteria.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] text-slate-400 uppercase border-b border-slate-800 bg-slate-900/40">
                    <tr>
                      <th className="py-2.5 px-3">User</th>
                      <th className="py-2.5 px-3 text-center">Total Sessions</th>
                      <th className="py-2.5 px-3 text-center">Learner</th>
                      <th className="py-2.5 px-3 text-center">Trainer</th>
                      <th className="py-2.5 px-3 text-center">Completed</th>
                      <th className="py-2.5 px-3 text-center">Cancelled</th>
                      <th className="py-2.5 px-3 text-center">Disputed</th>
                      <th className="py-2.5 px-3 text-center">Credits (E / S)</th>
                      <th className="py-2.5 px-3 text-right">Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {usersData.users.map((u: any) => (
                      <tr key={u.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-white">{u.display_name || 'Anonymous User'}</div>
                          <div className="text-[11px] text-slate-400">{u.email} • <span className="text-brand-400">{u.role}</span></div>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-white">{u.total_sessions}</td>
                        <td className="py-3 px-3 text-center text-indigo-300 font-semibold">{u.learner_sessions}</td>
                        <td className="py-3 px-3 text-center text-brand-300 font-semibold">{u.trainer_sessions}</td>
                        <td className="py-3 px-3 text-center text-emerald-400">{u.completed_sessions}</td>
                        <td className="py-3 px-3 text-center text-rose-400">{u.cancelled_sessions}</td>
                        <td className="py-3 px-3 text-center text-amber-400">{u.disputed_sessions}</td>
                        <td className="py-3 px-3 text-center font-mono">
                          <span className="text-brand-400">+{u.credits_earned}</span> / <span className="text-indigo-400">-{u.credits_spent}</span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand inline-flex items-center gap-1"
                          >
                            <span>View Report</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {usersData?.pagination && usersData.pagination.totalPages > 1 && (
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Page {usersData.pagination.page} of {usersData.pagination.totalPages}</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={userPage <= 1}
                    onClick={() => { setUserPage(p => p - 1); fetchUsers(); }}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={userPage >= usersData.pagination.totalPages}
                    onClick={() => { setUserPage(p => p + 1); fetchUsers(); }}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 4: LEARNER DEMAND REQUESTS & MATCHES */}
      {activeTab === 'REQUESTS' && (
        <div className="space-y-6">
          {/* Summary Metric Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Total Requests</span>
              <div className="text-xl font-bold text-white">{dailyReport?.learningRequests?.length || 0}</div>
            </div>
            <div className="glass-panel p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-1">
              <span className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">Waiting for Mentor</span>
              <div className="text-xl font-bold text-amber-300">
                {dailyReport?.learningRequests?.filter((r: any) => r.status === 'OPEN').length || 0}
              </div>
            </div>
            <div className="glass-panel p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
              <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">Mentor Found</span>
              <div className="text-xl font-bold text-emerald-300">
                {dailyReport?.learningRequests?.filter((r: any) => r.status === 'MENTOR_FOUND' || r.status === 'NOTIFIED').length || 0}
              </div>
            </div>
            <div className="glass-panel p-4 rounded-2xl border border-brand-500/30 bg-brand-500/5 space-y-1">
              <span className="text-[11px] text-brand-400 font-semibold uppercase tracking-wider">Fulfilled</span>
              <div className="text-xl font-bold text-brand-300">
                {dailyReport?.learningRequests?.filter((r: any) => r.status === 'FULFILLED').length || 0}
              </div>
            </div>
          </div>

          {/* Requests Table */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Learner Demand Requests &amp; Mentor Matches</h3>
            </div>

            {(!dailyReport?.learningRequests || dailyReport.learningRequests.length === 0) ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No learning requests found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] text-slate-400 uppercase border-b border-slate-800 bg-slate-900/40">
                    <tr>
                      <th className="py-2.5 px-3">Request ID</th>
                      <th className="py-2.5 px-3">Learner &amp; College</th>
                      <th className="py-2.5 px-3">Skill &amp; Proficiency</th>
                      <th className="py-2.5 px-3">Preferred Window</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Matched Mentor</th>
                      <th className="py-2.5 px-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {dailyReport.learningRequests.map((req: any) => (
                      <tr key={req.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-300">{req.id}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-white">{req.learner_name || req.learner_id}</div>
                          <div className="text-[11px] text-slate-400">{req.learner_college || 'Campus Member'}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-brand-400">{req.skill_name}</div>
                          <div className="text-[11px] text-slate-400">{req.requested_proficiency}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {req.preferred_time_start} - {req.preferred_time_end}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                            req.status === 'MENTOR_FOUND' || req.status === 'NOTIFIED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                            req.status === 'FULFILLED' ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' :
                            req.status === 'OPEN' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                            'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {req.mentor_name ? (
                            <div>
                              <div className="font-bold text-white">{req.mentor_name}</div>
                              <div className="text-[11px] text-slate-400">{req.mentor_college}</div>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">None yet</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-[11px]">
                          {new Date(req.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notification Deliveries Log */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white">Multi-Channel Notification Deliveries</h3>
            {(!dailyReport?.notificationDeliveries || dailyReport.notificationDeliveries.length === 0) ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No notification deliveries logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] text-slate-400 uppercase border-b border-slate-800 bg-slate-900/40">
                    <tr>
                      <th className="py-2.5 px-3">Channel</th>
                      <th className="py-2.5 px-3">Recipient</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Subject / Preview</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {dailyReport.notificationDeliveries.map((del: any) => (
                      <tr key={del.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="py-3 px-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            del.channel === 'IN_APP' ? 'bg-indigo-500/20 text-indigo-300' :
                            del.channel === 'EMAIL' ? 'bg-amber-500/20 text-amber-300' :
                            'bg-sky-500/20 text-sky-300'
                          }`}>
                            {del.channel}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-200">{del.recipient}</td>
                        <td className="py-3 px-3 text-slate-300">{del.type}</td>
                        <td className="py-3 px-3 text-slate-400 truncate max-w-xs">{del.subject || del.content}</td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400">
                            {del.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-[11px]">
                          {new Date(del.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
