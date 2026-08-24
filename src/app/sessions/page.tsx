'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Calendar,
  Clock,
  Video,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  Award,
  RefreshCw,
  Coins,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  User,
  Users,
  ChevronRight,
  SlidersHorizontal,
  X,
  PlusCircle,
  TrendingUp,
  Star,
} from 'lucide-react';

export default function SessionsListPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'TEACHING' | 'LEARNING'>(
    (searchParams.get('role') as any) || 'ALL'
  );
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'ALL');
  const [skillFilter, setSkillFilter] = useState<string>(searchParams.get('skill') || 'ALL');
  const [modeFilter, setModeFilter] = useState<string>(searchParams.get('mode') || 'ALL');
  const [dateFilter, setDateFilter] = useState<string>(searchParams.get('dateFilter') || 'ALL');
  const [dateFrom, setDateFrom] = useState<string>(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState<string>(searchParams.get('dateTo') || '');
  const [sortBy, setSortBy] = useState<string>(searchParams.get('sort') || 'UPCOMING_FIRST');
  const [page, setPage] = useState<number>(parseInt(searchParams.get('page') || '1', 10));

  // Data states
  const [sessions, setSessions] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>({ total: 0, totalPages: 1, page: 1, limit: 15 });
  const [stats, setStats] = useState<any>({
    totalSessions: 0,
    upcomingSessions: 0,
    pendingRequests: 0,
    acceptedSessions: 0,
    completedSessions: 0,
    cancelledSessions: 0,
    disputedSessions: 0,
    creditsEarned: 0,
    creditsSpent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch filtered sessions from backend
  const fetchSessions = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const query = new URLSearchParams();
      if (searchTerm) query.set('search', searchTerm);
      if (roleFilter !== 'ALL') query.set('role', roleFilter);
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      if (skillFilter !== 'ALL') query.set('skill', skillFilter);
      if (modeFilter !== 'ALL') query.set('mode', modeFilter);
      if (dateFilter !== 'ALL') query.set('dateFilter', dateFilter);
      if (dateFilter === 'CUSTOM') {
        if (dateFrom) query.set('dateFrom', dateFrom);
        if (dateTo) query.set('dateTo', dateTo);
      }
      query.set('sort', sortBy);
      query.set('page', page.toString());
      query.set('limit', '15');

      const res = await fetch(`/api/sessions?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        setPagination(data.pagination || { total: 0, totalPages: 1, page: 1 });
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [roleFilter, statusFilter, skillFilter, modeFilter, dateFilter, dateFrom, dateTo, sortBy, page]);

  // Live polling (every 4 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSessions(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [roleFilter, statusFilter, skillFilter, modeFilter, dateFilter, dateFrom, dateTo, sortBy, page, searchTerm]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchSessions();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setSkillFilter('ALL');
    setModeFilter('ALL');
    setDateFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setSortBy('UPCOMING_FIRST');
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse';
      case 'SCHEDULED':
      case 'ACCEPTED':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'COMPLETED':
      case 'CREDIT_SETTLED':
        return 'bg-brand-500/20 text-brand-300 border-brand-500/40';
      case 'PENDING_CONFIRMATION':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'DISPUTED':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'CANCELLED':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      
      {/* Top Header */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-bold border border-brand-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" /> Live Sessions Ledger
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">My Campus Skill Sessions</h1>
          <p className="text-xs text-slate-400 mt-1">
            Track your 1-on-1 peer teaching and learning sessions, manage exchange agreements, and join live classrooms.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/explore"
            className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand transition-all flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Book New Session</span>
          </Link>
          <button
            onClick={() => fetchSessions()}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            title="Refresh sessions"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Real-time Calculated Summary Counters Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
          <div className="text-xl font-extrabold text-white">{stats.totalSessions}</div>
        </div>
        <div className="glass-panel p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Upcoming</span>
          <div className="text-xl font-extrabold text-emerald-300">{stats.upcomingSessions}</div>
        </div>
        <div className="glass-panel p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-1">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Pending</span>
          <div className="text-xl font-extrabold text-amber-300">{stats.pendingRequests}</div>
        </div>
        <div className="glass-panel p-3.5 rounded-2xl border border-sky-500/30 bg-sky-500/5 space-y-1">
          <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">Accepted</span>
          <div className="text-xl font-extrabold text-sky-300">{stats.acceptedSessions}</div>
        </div>
        <div className="glass-panel p-3.5 rounded-2xl border border-brand-500/30 bg-brand-500/5 space-y-1">
          <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">Completed</span>
          <div className="text-xl font-extrabold text-brand-300">{stats.completedSessions}</div>
        </div>
        <div className="glass-panel p-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/5 space-y-1">
          <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Cancelled</span>
          <div className="text-xl font-extrabold text-rose-300">{stats.cancelledSessions}</div>
        </div>
        <div className="glass-panel p-3.5 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 space-y-1">
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Earned</span>
          <div className="text-xl font-extrabold text-indigo-300">+{stats.creditsEarned} Cr</div>
        </div>
        <div className="glass-panel p-3.5 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 space-y-1">
          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Spent</span>
          <div className="text-xl font-extrabold text-cyan-300">-{stats.creditsSpent} Cr</div>
        </div>
      </div>

      {/* Role Selector Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'ALL', label: 'All My Sessions' },
            { id: 'TEACHING', label: 'Teaching Sessions (As Mentor)' },
            { id: 'LEARNING', label: 'Learning Sessions (As Learner)' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setRoleFilter(tab.id as any); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                roleFilter === tab.id
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
            showFilters ? 'bg-brand-500/20 text-brand-300 border-brand-500/40' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Advanced Filters</span>
        </button>
      </div>

      {/* Quick Status Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'ALL', label: 'All Statuses' },
          { id: 'UPCOMING', label: '🟢 Upcoming / Live' },
          { id: 'REQUESTED', label: '⏳ Requested' },
          { id: 'ACCEPTED', label: '🤝 Accepted' },
          { id: 'SCHEDULED', label: '📅 Scheduled' },
          { id: 'IN_PROGRESS', label: 'Live In-Progress' },
          { id: 'COMPLETED', label: '✓ Completed & Settled' },
          { id: 'DISPUTED', label: '⚠️ Disputed' },
          { id: 'CANCELLED', label: '❌ Cancelled' },
        ].map(pill => (
          <button
            key={pill.id}
            onClick={() => { setStatusFilter(pill.id); setPage(1); }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
              statusFilter === pill.id
                ? 'bg-brand-500 text-dark-bg shadow-glow-brand'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Search & Filter Controls Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search skill (e.g. Python), mentor name, learner name, or session ID..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <select
            value={skillFilter}
            onChange={(e) => { setSkillFilter(e.target.value); setPage(1); }}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2"
          >
            <option value="ALL">All Skills</option>
            <option value="Python">Python</option>
            <option value="React">React</option>
            <option value="Solidity">Solidity</option>
            <option value="Data Structures">Data Structures</option>
            <option value="Machine Learning">Machine Learning</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2"
          >
            <option value="UPCOMING_FIRST">Sort: Upcoming First</option>
            <option value="NEWEST_FIRST">Sort: Newest First</option>
            <option value="OLDEST_FIRST">Sort: Oldest First</option>
            <option value="RECENTLY_UPDATED">Sort: Recently Updated</option>
            <option value="RECENTLY_COMPLETED">Sort: Recently Completed</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand"
          >
            Search
          </button>
        </form>

        {/* Extended Filter Options Drawer */}
        {showFilters && (
          <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Date Range Filter
              </label>
              <select
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
                className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2"
              >
                <option value="ALL">All Dates</option>
                <option value="TODAY">Today</option>
                <option value="TOMORROW">Tomorrow</option>
                <option value="THIS_WEEK">This Week (Next 7 Days)</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="CUSTOM">Custom Date Range</option>
              </select>
            </div>

            {dateFilter === 'CUSTOM' && (
              <div className="sm:col-span-2 flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Session Mode
              </label>
              <select
                value={modeFilter}
                onChange={(e) => { setModeFilter(e.target.value); setPage(1); }}
                className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2"
              >
                <option value="ALL">All Modes</option>
                <option value="ONLINE">Online Video Classroom</option>
                <option value="CAMPUS_IN_PERSON">In-Person Campus Lab</option>
              </select>
            </div>

            <div className="sm:col-span-3 flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-slate-400 hover:text-white underline font-semibold"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sessions Grid */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-400" />
            <p>Loading sessions from database...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center space-y-4">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-white">No Sessions Found</h3>
              <p className="text-xs text-slate-400 mt-1">
                {searchTerm || statusFilter !== 'ALL' || skillFilter !== 'ALL'
                  ? 'No sessions match your search criteria and active filters.'
                  : "You haven't booked or conducted any sessions yet."}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              {(searchTerm || statusFilter !== 'ALL' || skillFilter !== 'ALL' || dateFilter !== 'ALL') ? (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                >
                  Clear Filters
                </button>
              ) : (
                <Link
                  href="/explore"
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand"
                >
                  Find Python Mentors
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((sess: any) => {
              const isTeacher = sess.teacher_id === (user?.id || (user as any)?.userId);
              return (
                <div
                  key={sess.id}
                  className="glass-panel p-5 rounded-3xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    
                    {/* Header Row: Skill & Status */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${getStatusBadge(sess.status)}`}>
                        {sess.status}
                      </span>
                      <span className="text-[11px] text-brand-400 font-semibold font-mono">
                        {sess.credits_amount || 1} Credit(s)
                      </span>
                    </div>

                    {/* Title */}
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-brand-300 transition-colors">
                        {sess.title || `${sess.skill_name} Learning Session`}
                      </h3>
                      <div className="text-xs text-slate-400 mt-0.5 font-medium">{sess.skill_category || 'Peer Mentorship'}</div>
                    </div>

                    {/* Participants */}
                    <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Mentor:</span>
                        <strong className="text-white flex items-center gap-1">
                          {sess.teacher_name} {isTeacher && <span className="text-brand-400 text-[10px]">(You)</span>}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Learner:</span>
                        <strong className="text-white flex items-center gap-1">
                          {sess.learner_name} {!isTeacher && <span className="text-indigo-400 text-[10px]">(You)</span>}
                        </strong>
                      </div>
                    </div>

                    {/* Schedule Time & Mode */}
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {sess.scheduled_start
                            ? `${new Date(sess.scheduled_start).toLocaleDateString([], { month: 'short', day: 'numeric' })} • ${new Date(sess.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : 'Time Pending'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">{sess.mode || 'Online'}</span>
                    </div>

                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <Link
                      href={`/sessions/${sess.id}`}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 flex items-center gap-1 transition-colors"
                    >
                      <span>Inspect Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>

                    {['SCHEDULED', 'ACCEPTED', 'IN_PROGRESS'].includes(sess.status) && (
                      <Link
                        href={`/live/${sess.id}`}
                        className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-extrabold text-xs shadow-glow-brand transition-all flex items-center gap-1"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Live Classroom</span>
                      </Link>
                    )}

                    {['COMPLETED', 'CREDIT_SETTLED'].includes(sess.status) && !isTeacher && (
                      <Link
                        href={`/sessions/${sess.id}`}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-dark-bg font-extrabold text-xs shadow-glow-brand transition-all flex items-center gap-1"
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>Rate Mentor</span>
                      </Link>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} total sessions)
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
