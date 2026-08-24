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
  User, 
  BookOpen, 
  ExternalLink,
  Lock,
  Layers,
  FileText,
  ShieldCheck,
  Globe
} from 'lucide-react';

export default function AdminSessionReportPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();

  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authUser?.role === 'ADMIN') {
      fetch(`/api/admin/reports/sessions/${sessionId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => setReport(data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [authUser, sessionId]);

  if (authLoading) {
    return <div className="min-h-[70vh] flex items-center justify-center text-xs text-slate-400">Verifying admin access...</div>;
  }

  if (!authUser || authUser.role !== 'ADMIN') {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">403 — Unauthorized Admin Access</h2>
        <p className="text-xs text-slate-400">Administrative clearance is required to inspect session audit records.</p>
        <Link href="/" className="inline-block px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white">Return to Campus Home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-white">Session Audit Deep-Dive</h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold border border-brand-500/30">
                Immutable Ledger
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Session ID: <code className="text-slate-300 font-mono">{sessionId}</code>
            </p>
          </div>
        </div>

        <a
          href={`/api/admin/reports/export?type=session&sessionId=${sessionId}`}
          download
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" /> Export Session CSV
        </a>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">
          Loading comprehensive session audit record, dispute details, and blockchain anchors...
        </div>
      ) : !report ? (
        <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Session Not Found</h3>
          <p className="text-xs text-slate-400">No session record exists with ID: {sessionId}</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Metadata & Status Header Card */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-brand-400 uppercase tracking-wider">{report.session.skill_category}</span>
                <h2 className="text-xl font-extrabold text-white mt-0.5">{report.session.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-3 py-1 rounded-xl font-bold border ${
                  report.session.status === 'CREDIT_SETTLED' ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' :
                  report.session.status === 'DISPUTED' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                  'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  Status: {report.session.status}
                </span>

                <span className="text-xs px-3 py-1 rounded-xl font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {report.settlementClassification}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3 border-t border-slate-800">
              <div>
                <span className="text-slate-500 text-[11px] block">Scheduled Start</span>
                <strong className="text-slate-200">{new Date(report.session.scheduled_start).toLocaleString()}</strong>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Duration</span>
                <strong className="text-slate-200">{report.session.duration_hours} Hour(s)</strong>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Credits Rate</span>
                <strong className="text-brand-400">{report.session.credits_amount || 1} Skill Credit</strong>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Location / Mode</span>
                <strong className="text-slate-200">{report.session.mode}</strong>
              </div>
            </div>
          </div>

          {/* Participants Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Participant 1: Mentor / Trainer */}
            <div className="glass-panel p-5 rounded-3xl border border-brand-500/30 bg-brand-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">Teaching Mentor (Trainer)</span>
                {report.session.teacher_confirmed ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold border border-brand-500/30">Confirmed</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">Pending Confirm</span>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Name:</span>
                  <div className="flex items-center gap-1.5">
                    <strong className="text-white text-sm">{report.session.teacher_name}</strong>
                    {report.session.mentor_verification_status === 'PLATFORM_VERIFIED' && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                        ✓ Verified Mentor
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">User ID:</span>
                  <Link href={`/admin/users/${report.session.teacher_id}`} className="text-brand-400 font-mono hover:underline">
                    {report.session.teacher_id}
                  </Link>
                </div>
                {report.session.teacher_email && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Email:</span>
                    <span className="text-slate-300 font-mono">{report.session.teacher_email}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">College &amp; Major:</span>
                  <span className="text-slate-300">
                    {report.session.teacher_college || 'Campus'} {report.session.teacher_major ? `• ${report.session.teacher_major}` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800 pt-1.5">
                  <span className="text-slate-400">Verification Status:</span>
                  <span className="text-emerald-400 font-bold">
                    {report.session.mentor_verification_status || 'VERIFIED STUDENT'} ✓
                  </span>
                </div>
              </div>
            </div>

            {/* Participant 2: Learner */}
            <div className="glass-panel p-5 rounded-3xl border border-indigo-500/30 bg-indigo-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Receiving Learner</span>
                {report.session.learner_confirmed ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold border border-brand-500/30">Confirmed</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">Pending Confirm</span>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Name:</span>
                  <strong className="text-white text-sm">{report.session.learner_name}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">User ID:</span>
                  <Link href={`/admin/users/${report.session.learner_id}`} className="text-indigo-400 font-mono hover:underline">
                    {report.session.learner_id}
                  </Link>
                </div>
                {report.session.learner_email && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Email:</span>
                    <span className="text-slate-300 font-mono">{report.session.learner_email}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">College &amp; Major:</span>
                  <span className="text-slate-300">
                    {report.session.learner_college || 'Campus'} {report.session.learner_major ? `• ${report.session.learner_major}` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800 pt-1.5">
                  <span className="text-slate-400">Verified Student:</span>
                  <span className="text-emerald-400 font-bold">YES ✓</span>
                </div>
              </div>
            </div>

          </div>

          {/* Settlement & Exchange Terms */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-400" />
              <span>Settlement Classification &amp; Return Exchange Terms</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <span className="text-slate-400 text-[11px] uppercase tracking-wider font-bold">Exchange Terms</span>
                <div className="text-base font-extrabold text-cyan-300">{report.settlementClassification}</div>
                {report.agreement?.return_type === 'SKILL' ? (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-1">
                    <strong className="block font-bold">🔄 Direct Skill Return Agreement:</strong>
                    <div>Skill: <span className="font-bold">{report.agreement.requested_return_skill_name}</span></div>
                    <div>Agreement Status: <span className="font-bold">{report.agreement.status}</span></div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs space-y-1">
                    <strong className="block font-bold">🪙 Credit-Based Exchange:</strong>
                    <div>Rate: <span className="font-bold">{report.session.credits_amount || 1} Skill Credit</span></div>
                    <div>Status: <span className="font-bold">{report.session.status === 'CREDIT_SETTLED' ? 'Settled to Mentor' : 'Held in Escrow'}</span></div>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <span className="text-slate-400 text-[11px] uppercase tracking-wider font-bold">Credit Ledger Record</span>
                {report.creditTransactions.length > 0 ? (
                  report.creditTransactions.map((ctx: any) => (
                    <div key={ctx.id} className="space-y-1 p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="font-bold text-brand-400">
                        {ctx.sender_name || 'Escrow'} → {ctx.receiver_name || 'Escrow'} ({ctx.amount} Credit)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Tx ID: <code className="text-slate-300 font-mono">{ctx.id}</code> ({ctx.transaction_type} • {ctx.status})
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 text-xs">No direct credit transfer recorded for this session.</div>
                )}
              </div>
            </div>
          </div>

          {/* Chronological Step-by-Step Session Event Sequence ("What happened first, then what happened next") */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-400" />
                <h3 className="text-sm font-extrabold text-white">
                  Chronological Session Lifecycle: What Happened First &rarr; Next
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {report.sessionEvents?.length || 0} Chronological Events Logged
              </span>
            </div>

            {(!report.sessionEvents || report.sessionEvents.length === 0) ? (
              <div className="py-8 text-center text-xs text-slate-400">No session events logged.</div>
            ) : (
              <div className="space-y-3 relative before:absolute before:left-[17px] before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
                {report.sessionEvents.map((evt: any, idx: number) => {
                  const timeStr = new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  return (
                    <div key={evt.id || idx} className="relative flex items-start gap-4 pl-1 group">
                      <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-brand-500/60 text-brand-300 font-extrabold text-xs flex items-center justify-center shrink-0 z-10">
                        {idx + 1}
                      </div>

                      <div className="flex-1 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5">
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
                            {timeStr} • {new Date(evt.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          {evt.description}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
                          <div>
                            Actor: <strong className="text-slate-300">{evt.actor_name || evt.actor_id || 'System'}</strong>
                          </div>

                          {evt.previous_state && evt.new_state && (
                            <div className="font-mono text-[10px] bg-slate-950 px-2 py-0.5 rounded text-slate-400 border border-slate-800">
                              State: <span className="text-slate-300">{evt.previous_state}</span> &rarr; <span className="text-emerald-400 font-bold">{evt.new_state}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dispute Record (if any) */}
          {report.dispute && (
            <div className="glass-panel p-5 rounded-3xl border border-rose-500/40 bg-rose-500/10 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Campus Dispute Case Record</span>
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                  {report.dispute.status}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Initiator:</span>
                  <strong className="text-white">{report.dispute.initiator_name || report.dispute.initiator_id}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Reason:</span>
                  <span className="text-rose-300 font-bold">{report.dispute.reason}</span>
                </div>
                <div className="pt-2 border-t border-slate-800/80 text-slate-300">
                  <span className="text-slate-400 block mb-0.5">Resolution Notes:</span>
                  {report.dispute.resolution_notes || 'Pending campus moderator review and escrow decision.'}
                </div>
              </div>
            </div>
          )}

          {/* Blockchain Anchor (if any) */}
          {report.blockchainTx && (
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-brand-400" />
                  <span>Web3 Blockchain Anchor Proof</span>
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  {report.blockchainTx.status}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Transaction Hash:</span>
                  <code className="text-brand-300 font-mono text-[11px] truncate max-w-md">{report.blockchainTx.tx_hash}</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Chain ID:</span>
                  <span className="text-slate-200">{report.blockchainTx.chain_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Contract Address:</span>
                  <code className="text-slate-300 font-mono text-[11px]">{report.blockchainTx.contract_address}</code>
                </div>
              </div>
            </div>
          )}

          {/* Video Attendance & Classroom Telemetry */}
          {report.attendanceEvents && (
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  <span>Video Classroom Attendance &amp; Telemetry Events</span>
                </h3>
                <span className="text-xs text-slate-400">{report.attendanceEvents.length} events logged</span>
              </div>

              {report.attendanceEvents.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">No classroom telemetry logged.</div>
              ) : (
                <div className="space-y-2 text-xs">
                  {report.attendanceEvents.map((ev: any) => (
                    <div key={ev.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          ev.event_type === 'JOINED' ? 'bg-emerald-500/20 text-emerald-300' :
                          ev.event_type === 'LEFT' ? 'bg-rose-500/20 text-rose-300' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {ev.event_type}
                        </span>
                        <span className="font-semibold text-white">{ev.display_name || ev.user_id}</span>
                      </div>
                      <span className="text-slate-400 text-[11px] font-mono">
                        {new Date(ev.joined_at || ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Chat Activity Metadata (Privacy-Preserving) */}
          {report.chatMetadata && (
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent-400" />
                <span>In-Room Text Chat Activity Metadata</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Total Chat Messages</span>
                  <strong className="text-white text-base">{report.chatMetadata.totalMessages}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Active Chat Participants</span>
                  <strong className="text-white text-base">{report.chatMetadata.activeChatters}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Last Activity Timestamp</span>
                  <strong className="text-white text-xs">{report.chatMetadata.lastMessageAt ? new Date(report.chatMetadata.lastMessageAt).toLocaleString() : 'None'}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Complete Audit Log Trail */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-400" />
              <span>Immutable State Transition Audit Trail</span>
            </h3>

            {report.auditHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No external state transitions logged.</div>
            ) : (
              <div className="space-y-2 text-xs">
                {report.auditHistory.map((log: any) => (
                  <div key={log.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{log.action}</span>
                        {log.previous_state && log.new_state && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({log.previous_state} &rarr; {log.new_state})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Actor ID: <code className="text-slate-300 font-mono">{log.actor_id || 'System'}</code> • Target: <code className="text-slate-300 font-mono">{log.target_type}</code>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-slate-400 font-mono">
                      {log.created_at?.substring(0, 19)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
