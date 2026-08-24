'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Calendar,
  Clock,
  Video,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Coins,
  ShieldCheck,
  Award,
  RefreshCw,
  User,
  ExternalLink,
  MessageSquare,
  FileCode,
  Lock,
  ChevronRight,
  Sparkles,
  XCircle,
  HelpCircle,
  Star,
  ThumbsUp,
} from 'lucide-react';
import RatingModal from '@/components/RatingModal';

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const sessionId = params.id as string;

  const [sessionData, setSessionData] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [callerRole, setCallerRole] = useState<string>('LEARNER');
  const [authorizedActions, setAuthorizedActions] = useState<string[]>([]);
  const [userRating, setUserRating] = useState<any | null>(null);
  const [peerRating, setPeerRating] = useState<any | null>(null);
  const [hasRated, setHasRated] = useState<boolean>(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Dispute / Cancellation modal states
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Fetch real persisted session detail from backend
  const fetchSessionDetail = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSessionData(data.session);
        setEvents(data.events || []);
        setCallerRole(data.callerRole || 'LEARNER');
        setAuthorizedActions(data.authorizedActions || []);
        setUserRating(data.userRating || null);
        setPeerRating(data.peerRating || null);
        setHasRated(Boolean(data.hasRated));
      } else if (res.status === 404) {
        setActionError('Session not found');
      } else if (res.status === 403) {
        setActionError('Unauthorized: You are not a participant in this session');
      }
    } catch (err) {
      console.error('Failed to fetch session detail:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchSessionDetail();
      // Real-time periodic revalidation
      const interval = setInterval(() => {
        fetchSessionDetail(true);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [sessionId]);

  // Execute State Machine Actions
  const handleAction = async (action: string, payload: any = {}) => {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionSuccess(data.message || 'Session updated successfully!');
        setShowDisputeModal(false);
        setShowCancelModal(false);
        fetchSessionDetail();
      } else {
        setActionError(data.error || 'Failed to perform session action');
      }
    } catch (err: any) {
      setActionError('Network error while updating session');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center mx-auto animate-spin">
          <RefreshCw className="w-6 h-6" />
        </div>
        <p className="text-xs text-slate-400 font-semibold">Loading persisted session from campus database...</p>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-6">
        <div className="glass-panel p-8 rounded-3xl border border-rose-500/30 bg-slate-950/80 space-y-4">
          <XCircle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Session Unavailable</h2>
          <p className="text-xs text-slate-400">{actionError || 'This session record could not be loaded.'}</p>
          <Link
            href="/sessions"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Return to My Sessions
          </Link>
        </div>
      </div>
    );
  }

  // Format Status Styles
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

  const steps = [
    { key: 'REQUESTED', label: 'Requested', done: true },
    { key: 'ACCEPTED', label: 'Accepted', done: sessionData.status !== 'REQUESTED' && sessionData.status !== 'CANCELLED' },
    { key: 'SCHEDULED', label: 'Scheduled', done: ['SCHEDULED', 'IN_PROGRESS', 'PENDING_CONFIRMATION', 'COMPLETED', 'CREDIT_SETTLED'].includes(sessionData.status) },
    { key: 'IN_PROGRESS', label: 'In Progress', done: ['IN_PROGRESS', 'PENDING_CONFIRMATION', 'COMPLETED', 'CREDIT_SETTLED'].includes(sessionData.status) },
    { key: 'COMPLETED', label: 'Completed', done: ['COMPLETED', 'CREDIT_SETTLED'].includes(sessionData.status) },
    { key: 'CREDIT_SETTLED', label: 'Settled', done: sessionData.status === 'CREDIT_SETTLED' || (sessionData.status === 'COMPLETED' && sessionData.credit_status === 'SETTLED') },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      
      {/* Top Breadcrumb & Live Refresh Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Sessions
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live DB Synced
          </span>
          <button
            onClick={() => fetchSessionDetail()}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Refresh session details"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {actionError && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Hero Session Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`text-[11px] px-3 py-1 rounded-full font-bold border ${getStatusBadge(sessionData.status)}`}>
                {sessionData.status}
              </span>
              <span className="text-xs text-slate-500 font-mono">ID: {sessionData.id}</span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-brand-400 font-semibold">{sessionData.mode || 'Online'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              {sessionData.title || `${sessionData.skill_name} Learning Session`}
            </h1>
          </div>

          {/* Quick Action Button for Video Session */}
          {(['ACCEPTED', 'SCHEDULED', 'IN_PROGRESS'].includes(sessionData.status)) && (
            <Link
              href={`/live/${sessionData.id}`}
              className="px-5 py-3 rounded-2xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-extrabold text-xs shadow-glow-brand transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <Video className="w-4 h-4" />
              <span>Enter Video Classroom</span>
            </Link>
          )}
        </div>

        {/* Visual Lifecycle Step Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Session Lifecycle</span>
            <span className="text-brand-400">Current: {sessionData.status}</span>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {steps.map((st, i) => (
              <div key={st.key} className="space-y-1.5">
                <div
                  className={`h-2 rounded-full transition-all ${
                    st.done
                      ? 'bg-gradient-to-r from-brand-400 to-emerald-400 shadow-glow-brand'
                      : 'bg-slate-800'
                  }`}
                />
                <div className={`text-[10px] font-semibold text-center truncate ${st.done ? 'text-white' : 'text-slate-500'}`}>
                  {st.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Two-Column Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          
          {/* Col 1 & 2: Primary Session Data & Participants */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Participants Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Mentor Box */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Teaching Mentor</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold border border-brand-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-brand-400" /> Verified
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center font-bold text-brand-300">
                    {sessionData.teacher_name?.charAt(0) || 'M'}
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{sessionData.teacher_name}</div>
                    <div className="text-xs text-slate-400">{sessionData.teacher_college || 'Campus Mentor'}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{sessionData.teacher_email}</div>
                  </div>
                </div>
              </div>

              {/* Learner Box */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Learner</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                    Student
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300">
                    {sessionData.learner_name?.charAt(0) || 'L'}
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{sessionData.learner_name}</div>
                    <div className="text-xs text-slate-400">{sessionData.learner_college || 'Campus Student'}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{sessionData.learner_email}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Time & Logistics Card */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Schedule &amp; Session Logistics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">Date</span>
                  <strong className="text-white font-medium">
                    {sessionData.scheduled_start ? new Date(sessionData.scheduled_start).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not available'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Start Time</span>
                  <strong className="text-white font-medium">
                    {sessionData.scheduled_start ? new Date(sessionData.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not available'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Duration</span>
                  <strong className="text-white font-medium">{sessionData.duration_hours || 1.0} Hour(s)</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Timezone</span>
                  <strong className="text-white font-medium">Asia/Kolkata (IST)</strong>
                </div>
              </div>

              {sessionData.notes && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300">
                  <span className="text-slate-500 font-bold text-[10px] uppercase block mb-0.5">Session Goal / Notes</span>
                  {sessionData.notes}
                </div>
              )}
            </div>

            {/* Pre-Session Exchange Agreement Card */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-brand-400" />
                  <span>Pre-Session Skill Return Agreement</span>
                </h3>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                  sessionData.agreement_status === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                  sessionData.agreement_status === 'PROPOSED' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                  'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {sessionData.agreement_status || 'STANDARD_ESCROW'}
                </span>
              </div>

              <div className="text-xs text-slate-300 leading-relaxed">
                {sessionData.requested_return_skill_name ? (
                  <p>
                    The mentor requested a return skill exchange: <strong>{sessionData.requested_return_skill_name}</strong>.
                    {sessionData.agreement_status === 'ACCEPTED' ? ' (Confirmed by learner)' : ' (Awaiting confirmation)'}
                  </p>
                ) : (
                  <p>
                    Standard 1-to-1 Skill Credit settlement. 1 credit is currently reserved in escrow and will be transferred upon completion.
                  </p>
                )}
              </div>
            </div>

            {/* Contextual Action Control Center */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Session Actions ({callerRole})</h3>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Mentor Actions on REQUESTED */}
                {sessionData.status === 'REQUESTED' && (callerRole === 'TEACHER' || callerRole === 'ADMIN') && (
                  <>
                    <button
                      onClick={() => handleAction('ACCEPT')}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-dark-bg font-extrabold text-xs shadow-glow-emerald transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Accept Request</span>
                    </button>
                    <button
                      onClick={() => handleAction('REJECT', { reason: 'Mentor unavailable' })}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs transition-colors"
                    >
                      Reject Request
                    </button>
                  </>
                )}

                {/* Cancel Button */}
                {['REQUESTED', 'ACCEPTED', 'SCHEDULED'].includes(sessionData.status) && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-colors"
                  >
                    Cancel Session
                  </button>
                )}

                {/* Completion Confirmation Buttons */}
                {(['IN_PROGRESS', 'SCHEDULED', 'PENDING_CONFIRMATION'].includes(sessionData.status)) && (
                  <button
                    onClick={() => handleAction('CONFIRM_COMPLETION')}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-extrabold text-xs shadow-glow-brand transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm Session Completed</span>
                  </button>
                )}

                {/* Dispute Button */}
                {['IN_PROGRESS', 'PENDING_CONFIRMATION', 'COMPLETED', 'CREDIT_SETTLED'].includes(sessionData.status) && (
                  <button
                    onClick={() => setShowDisputeModal(true)}
                    disabled={actionLoading}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold text-xs transition-colors flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Report Issue / Dispute</span>
                  </button>
                )}

                {/* Rating Prompt & Action for Completed Session */}
                {['COMPLETED', 'CREDIT_SETTLED'].includes(sessionData.status) && (
                  <>
                    {!hasRated && callerRole === 'LEARNER' ? (
                      <button
                        onClick={() => setShowRatingModal(true)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-dark-bg font-extrabold text-xs shadow-glow-brand transition-all flex items-center gap-1.5"
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>Rate Mentor ({sessionData.teacher_name})</span>
                      </button>
                    ) : userRating ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>You Rated: {userRating.score} / 5 Stars</span>
                      </div>
                    ) : null}
                  </>
                )}

                {/* Return Skill Link */}
                {sessionData.status === 'ACCEPTED' && (
                  <Link
                    href={`/live/${sessionData.id}`}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 flex items-center gap-1"
                  >
                    <span>Go to Session Room</span>
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>

            {/* Verified Rating & Feedback Display Card (When completed) */}
            {['COMPLETED', 'CREDIT_SETTLED'].includes(sessionData.status) && (
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span>Peer Review &amp; Mentoring Rating</span>
                  </h3>
                  {hasRated ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Feedback Submitted
                    </span>
                  ) : callerRole === 'LEARNER' ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 animate-pulse">
                      Pending Your Rating
                    </span>
                  ) : null}
                </div>

                {userRating ? (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-4 h-4 ${s <= userRating.score ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-bold text-white ml-1">{userRating.score}.0 / 5.0</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {new Date(userRating.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 italic bg-slate-900/50 p-3 rounded-lg border border-slate-800/80">
                      "{userRating.review}"
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/30">
                        Clarity: {userRating.clarity_score}/5
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30">
                        Punctuality: {userRating.punctuality_score}/5
                      </span>
                      {userRating.skills_demonstrated && userRating.skills_demonstrated.split(',').map((tag: string, idx: number) => (
                        <span key={idx} className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          ✓ {tag.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : !hasRated && callerRole === 'LEARNER' ? (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="space-y-1 text-center sm:text-left">
                      <div className="font-bold text-white text-xs">How was your learning session?</div>
                      <div className="text-[11px] text-slate-400">
                        Rate {sessionData.teacher_name}'s teaching to update their peer reputation score.
                      </div>
                    </div>
                    <button
                      onClick={() => setShowRatingModal(true)}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-dark-bg font-extrabold text-xs shadow-glow-brand transition-all flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>Rate Mentor Now</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-500">
                    Awaiting learner review and rating submission.
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Col 3: Escrow & Audit Timeline */}
          <div className="space-y-6">
            
            {/* Escrow Credit Summary Card */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-brand-400" />
                  <span>Escrow &amp; Credits</span>
                </h3>
                <span className="text-xs font-bold text-brand-400 font-mono">
                  {sessionData.credits_amount || 1} Skill Credit
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">Credit Status</span>
                  <strong className={`font-mono text-[11px] ${
                    sessionData.credit_status === 'SETTLED' ? 'text-brand-300' :
                    sessionData.credit_status === 'REFUNDED' ? 'text-cyan-300' :
                    sessionData.credit_status === 'FROZEN_IN_DISPUTE' ? 'text-rose-300' :
                    'text-amber-300'
                  }`}>
                    {sessionData.credit_status || 'RESERVED'}
                  </strong>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">Learner Confirmed</span>
                  <span className={`font-bold ${sessionData.learner_confirmed ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {sessionData.learner_confirmed ? '✓ Yes' : '○ Pending'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">Mentor Confirmed</span>
                  <span className={`font-bold ${sessionData.teacher_confirmed ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {sessionData.teacher_confirmed ? '✓ Yes' : '○ Pending'}
                  </span>
                </div>
              </div>
            </div>

            {/* Audit Timeline Card */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-400" />
                <span>Session Audit Trail</span>
              </h3>

              {events.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">No events logged yet.</div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:left-2 before:w-0.5 before:bg-slate-800">
                  {events.map((ev, i) => (
                    <div key={ev.id || i} className="relative pl-6 space-y-0.5 text-xs">
                      <div className="w-2 h-2 rounded-full bg-brand-400 absolute left-1 top-1 ring-4 ring-slate-950" />
                      <div className="font-bold text-white">{ev.title}</div>
                      <div className="text-slate-400 text-[11px]">{ev.description}</div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(ev.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-3xl border border-slate-700 bg-slate-950 max-w-md w-full space-y-4">
            <h3 className="text-base font-bold text-white">Cancel Session Booking</h3>
            <p className="text-xs text-slate-400">
              Cancelling will release any reserved escrow credits back to the learner and notify the other participant.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (optional)..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-brand-500"
              rows={3}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Go Back
              </button>
              <button
                onClick={() => handleAction('CANCEL', { reason: cancelReason })}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-3xl border border-amber-500/30 bg-slate-950 max-w-md w-full space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>Submit Session Dispute</span>
            </h3>
            <p className="text-xs text-slate-400">
              This freezes the escrow settlement and escalates the session to campus moderators for audit.
            </p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Describe the issue (e.g. no-show, technical failure, wrong topic)..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
              rows={4}
              required
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDisputeModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('DISPUTE', { reason: disputeReason })}
                disabled={actionLoading || !disputeReason.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-dark-bg text-xs font-bold"
              >
                Submit Dispute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating & Review Modal */}
      {sessionData && (
        <RatingModal
          isOpen={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          sessionId={sessionId}
          mentorName={sessionData.teacher_name || 'Mentor'}
          mentorAvatar={sessionData.teacher_avatar}
          skillName={sessionData.skill_name || 'Skill Mentorship'}
          onRatingSubmitted={() => {
            fetchSessionDetail();
          }}
        />
      )}

    </div>
  );
}
