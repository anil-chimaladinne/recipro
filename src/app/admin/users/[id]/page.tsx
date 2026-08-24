'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Coins, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  ShieldAlert, 
  Star, 
  User, 
  BookOpen, 
  ArrowRight,
  ExternalLink,
  Lock,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export default function AdminUserReportPage() {
  const params = useParams();
  const userId = params.id as string;
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();

  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchUserReport = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (fromDate) query.set('from', fromDate);
      if (toDate) query.set('to', toDate);

      const res = await fetch(`/api/admin/reports/users/${userId}?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error('Failed to load user report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authUser?.role === 'ADMIN') {
      fetchUserReport();
    }
  }, [authUser, userId]);

  const handleDateFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUserReport();
  };

  if (authLoading) {
    return <div className="min-h-[70vh] flex items-center justify-center text-xs text-slate-400">Verifying administrative access...</div>;
  }

  if (!authUser || authUser.role !== 'ADMIN') {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">403 — Unauthorized Admin Access</h2>
        <p className="text-xs text-slate-400">You must be logged in as a verified Administrator to access user audit reports.</p>
        <Link href="/" className="inline-block px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white">Return to Campus Home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            title="Back to Admin Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-white">User Activity Audit Report</h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold border border-brand-500/30">
                Authoritative Record
              </span>
            </div>
            <p className="text-xs text-slate-400">
              User ID: <code className="text-slate-300 font-mono">{userId}</code>
            </p>
          </div>
        </div>

        {/* Date Filter & Export */}
        <form onSubmit={handleDateFilter} className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5">
            <span className="text-slate-500 text-[10px]">From:</span>
            <input 
              type="date" 
              value={fromDate} 
              onChange={(e) => setFromDate(e.target.value)} 
              className="bg-transparent text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5">
            <span className="text-slate-500 text-[10px]">To:</span>
            <input 
              type="date" 
              value={toDate} 
              onChange={(e) => setToDate(e.target.value)} 
              className="bg-transparent text-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand"
          >
            Filter
          </button>

          <a
            href={`/api/admin/reports/export?type=user&userId=${userId}&from=${fromDate}&to=${toDate}`}
            download
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </a>
        </form>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">
          Loading comprehensive user audit records and session history...
        </div>
      ) : !report ? (
        <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h3 className="text-base font-bold text-white">User Record Not Found</h3>
          <p className="text-xs text-slate-400">The requested user ID does not exist in the database.</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* User Profile Header Card */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/30 to-indigo-500/30 border border-brand-500/40 flex items-center justify-center font-bold text-xl text-white">
                {report.user.display_name ? report.user.display_name.substring(0, 2).toUpperCase() : 'U'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{report.user.display_name || 'Anonymous User'}</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-400 font-bold border border-brand-500/30">
                    {report.user.role}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                    report.user.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  }`}>
                    {report.user.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {report.user.email} • {report.user.college || 'Campus Member'} {report.user.major ? `(${report.user.major})` : ''}
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                  <span>Trust Score: <strong className="text-white">{report.user.trust_score || 70.0}</strong></span>
                  <span>Bayesian Rating: <strong className="text-amber-400">{report.user.bayesian_rating ? `${report.user.bayesian_rating} ★` : 'N/A'}</strong></span>
                  <span>Member Since: <strong className="text-slate-300">{report.user.created_at?.substring(0, 10)}</strong></span>
                </div>
              </div>
            </div>

            {/* Credit Ledger Capsule */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 min-w-[240px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-brand-400" />
                <span>Authoritative Credit Balance</span>
              </span>
              <div className="text-2xl font-extrabold text-brand-400">{report.creditSummary.balance} Skill Credits</div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-1.5">
                <span>In Escrow Reserve:</span>
                <strong className="text-amber-300">{report.creditSummary.pending} Credits</strong>
              </div>
            </div>
          </div>

          {/* Activity & Credit Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[11px] font-semibold">Total Sessions</span>
              <div className="text-xl font-bold text-white">{report.summary.totalSessions}</div>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-indigo-400 text-[11px] font-semibold">Learner Sessions</span>
              <div className="text-xl font-bold text-indigo-300">{report.summary.learnerSessions}</div>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-brand-400 text-[11px] font-semibold">Trainer Sessions</span>
              <div className="text-xl font-bold text-brand-300">{report.summary.trainerSessions}</div>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-emerald-400 text-[11px] font-semibold">Completed</span>
              <div className="text-xl font-bold text-emerald-300">{report.summary.completedSessions}</div>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-rose-400 text-[11px] font-semibold">Cancelled</span>
              <div className="text-xl font-bold text-rose-300">{report.summary.cancelledSessions}</div>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-amber-400 text-[11px] font-semibold">Disputed</span>
              <div className="text-xl font-bold text-amber-300">{report.summary.disputedSessions}</div>
            </div>
          </div>

          {/* Credit Aggregate Breakdown */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 text-[11px]">Lifetime Earned</span>
              <div className="text-base font-bold text-brand-400">+{report.creditSummary.earned} Credits</div>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400 text-[11px]">Lifetime Spent</span>
              <div className="text-base font-bold text-indigo-400">-{report.creditSummary.spent} Credits</div>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400 text-[11px]">Total Transferred</span>
              <div className="text-base font-bold text-white">{report.creditSummary.transferred} Credits</div>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400 text-[11px]">Refunded</span>
              <div className="text-base font-bold text-cyan-400">{report.creditSummary.refunded} Credits</div>
            </div>
          </div>

          {/* FIRST SESSION CARD */}
          {report.firstSession && (
            <div className="glass-panel p-5 rounded-3xl border border-brand-500/30 bg-brand-500/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-brand-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-brand-400" />
                  <span>User's First Platform Session</span>
                </span>
                <span className="text-xs text-slate-400">{report.firstSession.scheduledStart?.substring(0, 10)}</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-white text-sm">{report.firstSession.title}</h4>
                    <p className="text-slate-400 mt-0.5">
                      Skill: <strong className="text-brand-300">{report.firstSession.skillName}</strong> • Role: <strong className="text-white">{report.firstSession.userRole}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-400 font-bold border border-brand-500/30">
                      {report.firstSession.settlementClassification}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-800/80">
                  <div className="text-slate-300">
                    Partner: <strong className="text-white">{report.firstSession.partnerName}</strong> ({report.firstSession.partnerRole})
                  </div>
                  <div className="text-slate-300">
                    Credit Flow: <strong className="text-brand-400">{report.firstSession.creditDirection}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TIME-SLOT OCCUPANCY SCHEDULE */}
          {report.timeSlotSchedule && (
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-400" />
                  <span>Time-Slot Occupancy Schedule ({report.timeSlotSchedule.date})</span>
                </h3>
                <span className="text-xs text-slate-400">Hourly Schedule Matrix</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                {report.timeSlotSchedule.slots.map((slot: any, idx: number) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-xl border transition-all ${
                      slot.status === 'OCCUPIED'
                        ? slot.userRole === 'TRAINER'
                          ? 'bg-brand-500/10 border-brand-500/40 text-brand-300'
                          : 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300'
                        : slot.status === 'CANCELLED'
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-bold text-[11px]">
                      <span>{slot.timeRange}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        slot.status === 'OCCUPIED' ? 'bg-slate-950 text-white' : 'text-slate-500'
                      }`}>
                        {slot.status === 'OCCUPIED' ? slot.userRole : slot.status}
                      </span>
                    </div>

                    {slot.status === 'OCCUPIED' ? (
                      <div className="mt-2 space-y-0.5 text-[11px]">
                        <div className="font-bold text-white truncate">{slot.skillName}</div>
                        <div className="text-slate-300 truncate">with {slot.partnerName}</div>
                      </div>
                    ) : slot.status === 'CANCELLED' ? (
                      <div className="mt-2 text-[11px] text-rose-400">Cancelled session slot</div>
                    ) : (
                      <div className="mt-2 text-[11px] text-slate-500">Free / Unscheduled</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SESSION-WISE CHRONOLOGICAL TIMELINE */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand-400" />
                <span>Session History Timeline ({report.sessionTimeline.length})</span>
              </h3>
            </div>

            {report.sessionTimeline.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No sessions recorded in this date range.</div>
            ) : (
              <div className="space-y-3">
                {report.sessionTimeline.map((sess: any) => (
                  <div key={sess.sessionId} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">{sess.title}</h4>
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono text-slate-400 bg-slate-950 border border-slate-800">
                            {sess.sessionId}
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5">
                          Skill: <strong className="text-brand-300">{sess.skillName}</strong> • {new Date(sess.scheduledStart).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                          sess.selectedUserRole === 'TRAINER' ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                        }`}>
                          User: {sess.selectedUserRole}
                        </span>

                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                          sess.status === 'CREDIT_SETTLED' ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' :
                          sess.status === 'DISPUTED' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                          'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {sess.status}
                        </span>
                      </div>
                    </div>

                    {/* Participant & Settlement Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      <div>
                        <span className="text-slate-400 text-[11px] block">Partner ({sess.partner.role})</span>
                        <strong className="text-white">{sess.partner.name}</strong>
                        <div className="text-[11px] text-slate-400">{sess.partner.college || 'Campus'}</div>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[11px] block">Settlement Classification</span>
                        <strong className="text-cyan-300">{sess.settlementClassification}</strong>
                        {sess.exchangeTerms && (
                          <div className="text-[11px] text-slate-400 truncate">
                            Return: {sess.exchangeTerms.returnSkill}
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="text-slate-400 text-[11px] block">Credit Flow</span>
                        <strong className="text-brand-400">
                          {sess.creditDirection ? sess.creditDirection.directionFormatted : 'None'}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-400 text-[11px]">Outcome: <strong className="text-slate-200">{sess.outcome}</strong></span>
                      <Link
                        href={`/admin/sessions/${sess.sessionId}`}
                        className="text-brand-400 font-bold hover:underline flex items-center gap-1"
                      >
                        Inspect Full Audit Record <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CREDIT HISTORY TABLE */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-brand-400" />
                <span>Credit Transfer History ({report.creditHistory.length})</span>
              </h3>
            </div>

            {report.creditHistory.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No credit transactions recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] text-slate-400 uppercase border-b border-slate-800 bg-slate-900/40">
                    <tr>
                      <th className="py-2.5 px-3">Date / Time</th>
                      <th className="py-2.5 px-3">Transaction ID</th>
                      <th className="py-2.5 px-3">From</th>
                      <th className="py-2.5 px-3">To</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {report.creditHistory.map((ctx: any) => (
                      <tr key={ctx.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="py-3 px-3 text-slate-300">{ctx.created_at?.substring(0, 16)}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{ctx.id}</td>
                        <td className="py-3 px-3 font-medium text-slate-200">{ctx.sender_name || 'System'}</td>
                        <td className="py-3 px-3 font-medium text-slate-200">{ctx.receiver_name || 'System'}</td>
                        <td className="py-3 px-3 font-bold text-brand-400">{ctx.amount} Credit(s)</td>
                        <td className="py-3 px-3 text-slate-300 font-semibold">{ctx.transaction_type}</td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                            {ctx.status}
                          </span>
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
