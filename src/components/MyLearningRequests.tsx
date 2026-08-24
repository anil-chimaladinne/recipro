'use client';

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  X, 
  ChevronRight, 
  Star, 
  MapPin, 
  ShieldCheck, 
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Sparkles,
  ArrowRight,
  BellRing
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export interface LearningRequest {
  id: string;
  learnerId: string;
  skillId: string;
  skillName: string;
  category: string;
  requestedProficiency: string;
  preferredDays: string[];
  preferredTimeStart: string;
  preferredTimeEnd: string;
  durationHours: number;
  learningGoal: string;
  searchScope: string;
  status: 'OPEN' | 'MENTOR_FOUND' | 'NOTIFIED' | 'SESSION_REQUESTED' | 'SESSION_CONFIRMED' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
  matchedMentor?: {
    userId: string;
    displayName: string;
    avatar: string | null;
    college: string;
    major: string;
    isVerifiedStudent: boolean;
    skillName: string;
    proficiency: string;
    verificationStatus: string;
    bayesianRating: number;
    matchScore: number;
    matchReasons: string[];
    isOutsideCollege: boolean;
  } | null;
  events: Array<{
    id: string;
    eventType: string;
    title: string;
    description: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export default function MyLearningRequests() {
  const router = useRouter();
  const [requests, setRequests] = useState<LearningRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<LearningRequest | null>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingSlotModal, setBookingSlotModal] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/learning-requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Failed to fetch learning requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleCancelRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to cancel this learning request?')) return;
    setCancellingId(requestId);
    try {
      const res = await fetch(`/api/learning-requests/${requestId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchRequests();
        if (selectedRequest?.id === requestId) {
          setSelectedRequest(null);
        }
      }
    } catch (err) {
      console.error('Failed to cancel request:', err);
    } finally {
      setCancellingId(null);
    }
  };

  const handleViewSlots = async (req: LearningRequest) => {
    setSelectedRequest(req);
    setBookingSlotModal(true);
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/learning-requests/${req.id}/match`);
      if (res.ok) {
        const data = await res.json();
        setAvailableSlots(data.availableSlots || []);
      }
    } catch (err) {
      console.error('Failed to fetch matched slots:', err);
    } finally {
      setSlotsLoading(false);
    }
  };

  const getStatusBadge = (status: LearningRequest['status']) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> 🟠 Waiting for Mentor
          </span>
        );
      case 'MENTOR_FOUND':
      case 'NOTIFIED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> 🟢 Mentor Found
          </span>
        );
      case 'SESSION_REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-indigo-400" /> 🟣 Session Requested
          </span>
        );
      case 'SESSION_CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/30 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-sky-400" /> 🟡 Session Confirmed
          </span>
        );
      case 'FULFILLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/40 text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" /> 🟢 Fulfilled
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-xs font-semibold">
            ⚪ Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-slate-400">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Loading your learning requests...
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="glass-panel p-8 rounded-3xl border border-slate-800 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
          <BookOpen className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-sm mx-auto">
          <h3 className="text-sm font-bold text-white">No active learning requests</h3>
          <p className="text-xs text-slate-400">
            When you search for a skill with zero available mentors, you can create a Learner Request to be notified the moment one joins.
          </p>
        </div>
        <button
          onClick={() => router.push('/explore')}
          className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand transition-colors"
        >
          Explore Skills
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* List of Request Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {requests.map((req) => {
          const isMentorFound = req.status === 'MENTOR_FOUND' || req.status === 'NOTIFIED';

          return (
            <div 
              key={req.id}
              className={`glass-panel p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-4 ${
                isMentorFound 
                  ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 via-slate-900 to-slate-950 shadow-lg' 
                  : 'border-slate-800 bg-slate-900/60'
              }`}
            >
              
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{req.skillName}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                      {req.requestedProficiency}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {req.preferredDays.join(' / ')} • {req.preferredTimeStart} – {req.preferredTimeEnd}
                  </p>
                </div>

                <div>
                  {getStatusBadge(req.status)}
                </div>
              </div>

              {/* Matched Mentor Preview or Waiting Notice */}
              {isMentorFound && req.matchedMentor ? (
                <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-xs">
                        {req.matchedMentor.displayName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          {req.matchedMentor.displayName}
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                            {req.matchedMentor.proficiency}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {req.matchedMentor.college}
                          {req.matchedMentor.isOutsideCollege && (
                            <span className="ml-1 text-amber-300 font-medium">(Outside College)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-extrabold text-emerald-400">
                        {req.matchedMentor.matchScore}% Match
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-300 space-y-0.5 pt-1 border-t border-emerald-500/20">
                    {req.matchedMentor.matchReasons.slice(0, 2).map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1 text-emerald-300">
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    {req.status === 'OPEN' 
                      ? 'No suitable mentor found yet. We will notify you automatically when a mentor verifies.'
                      : `Request status is ${req.status.toLowerCase().replace('_', ' ')}.`
                    }
                  </span>
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">
                  Created: {new Date(req.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>

                <div className="flex items-center gap-2">
                  {req.status === 'OPEN' && (
                    <button
                      onClick={() => handleCancelRequest(req.id)}
                      disabled={cancellingId === req.id}
                      className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-rose-400 text-xs transition-colors"
                    >
                      {cancellingId === req.id ? 'Cancelling...' : 'Cancel Request'}
                    </button>
                  )}

                  {isMentorFound ? (
                    <>
                      <button
                        onClick={() => {
                          setSelectedRequest(req);
                          handleViewSlots(req);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
                      >
                        View Mentor
                      </button>

                      <button
                        onClick={() => router.push(`/learner-requests/${req.id}/confirm-match?mentorId=${req.matchedMentor?.userId || ''}`)}
                        className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-extrabold text-xs shadow-glow-brand transition-all flex items-center gap-1"
                      >
                        <span>Take Course</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setSelectedRequest(req)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors flex items-center gap-1"
                    >
                      <span>View Request</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* DETAILED REQUEST VIEW & ACTIVITY TIMELINE MODAL */}
      {/* ============================================================ */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-3xl border border-slate-700 shadow-2xl p-6 relative space-y-6 max-h-[90vh] overflow-y-auto my-auto">
            
            <button 
              onClick={() => setSelectedRequest(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{selectedRequest.skillName} Learning Request</h2>
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Target: {selectedRequest.requestedProficiency} • {selectedRequest.preferredDays.join(', ')} ({selectedRequest.preferredTimeStart} – {selectedRequest.preferredTimeEnd})
                  </p>
                </div>
              </div>
            </div>

            {/* Matched Mentor Section */}
            {selectedRequest.matchedMentor && (
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-extrabold text-sm">
                      {selectedRequest.matchedMentor.displayName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {selectedRequest.matchedMentor.displayName}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> {selectedRequest.matchedMentor.verificationStatus.replace('_', ' ')}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {selectedRequest.matchedMentor.college} • {selectedRequest.matchedMentor.major}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-extrabold text-emerald-400">{selectedRequest.matchedMentor.matchScore}% Match</span>
                    {selectedRequest.matchedMentor.isOutsideCollege && (
                      <p className="text-[10px] text-amber-300 font-medium">Mentor from another college</p>
                    )}
                  </div>
                </div>

                {/* Match Reasons */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1.5">
                  <div className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">Why this match?</div>
                  {selectedRequest.matchedMentor.matchReasons.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-slate-200">
                      <span className="text-emerald-400 font-bold">{r}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    onClick={() => router.push(`/explore?q=${encodeURIComponent(selectedRequest.matchedMentor?.displayName || '')}`)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    View Mentor Profile
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRequest(null);
                      router.push(`/explore?q=${encodeURIComponent(selectedRequest.skillName)}&mode=SLOT_FINDER`);
                    }}
                    className="px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand transition-colors flex items-center gap-1"
                  >
                    View Available Sessions <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Request Activity Timeline */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-400" /> Request Activity Timeline
              </h3>

              <div className="space-y-2 border-l-2 border-slate-800 pl-4 ml-2">
                {selectedRequest.events.map((ev) => (
                  <div key={ev.id} className="relative pb-3 text-xs">
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-brand-500 ring-4 ring-slate-950" />
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-bold text-slate-300">{ev.title}</span>
                      <span>{new Date(ev.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">{ev.description}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
