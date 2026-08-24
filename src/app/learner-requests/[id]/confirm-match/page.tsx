'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Sparkles,
  ShieldCheck,
  Calendar,
  Clock,
  Coins,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  User,
  BookOpen,
  RefreshCw,
} from 'lucide-react';

export default function ConfirmMatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const requestId = params.id as string;
  const mentorIdParam = searchParams.get('mentorId');

  const [matchData, setMatchData] = useState<any | null>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState<boolean>(false);

  useEffect(() => {
    async function loadMatchDetails() {
      setLoading(true);
      try {
        const res = await fetch(`/api/learning-requests/${requestId}/match`);
        if (res.ok) {
          const data = await res.json();
          setMatchData(data);
          if (data.availableSlots && data.availableSlots.length > 0) {
            setAvailableSlots(data.availableSlots);
            setSelectedSlot(data.availableSlots[0]);
          }
        } else {
          setError('Failed to load match details');
        }
      } catch (err) {
        setError('Network error while loading match details');
      } finally {
        setLoading(false);
      }
    }

    if (requestId) loadMatchDetails();
  }, [requestId]);

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      const body: any = {
        mentorId: mentorIdParam || matchData?.matchedMentor?.userId,
      };
      if (selectedSlot) {
        body.scheduledStart = selectedSlot.startISO;
        body.scheduledEnd = selectedSlot.endISO;
      }

      const res = await fetch(`/api/learning-requests/${requestId}/accept-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.push(data.redirectUrl || `/sessions/${data.sessionId}`);
      } else {
        setError(data.error || 'Failed to confirm session request');
      }
    } catch (err: any) {
      setError('Network error while confirming match');
    } finally {
      setConfirming(false);
    }
  };

  const handleDecline = async (cancel = false) => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/learning-requests/${requestId}/decline-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelRequest: cancel }),
      });
      if (res.ok) {
        setDeclined(true);
      }
    } catch (err) {
      console.error('Failed to decline match:', err);
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-400" />
        <p className="text-xs text-slate-400">Loading matched mentor details...</p>
      </div>
    );
  }

  if (declined) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-6">
        <div className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-4">
          <CheckCircle2 className="w-12 h-12 text-brand-400 mx-auto" />
          <h2 className="text-xl font-extrabold text-white">Understood</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            We will keep your learning request active and notify you as soon as another verified mentor becomes available.
          </p>
          <div className="pt-2">
            <Link
              href="/sessions"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
            >
              <ArrowLeft className="w-4 h-4" /> Go to My Sessions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const mentor = matchData?.matchedMentor;
  const request = matchData?.request;

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-10 space-y-6">
      
      {/* Header */}
      <div className="text-center space-y-2">
        <span className="text-[10px] px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 font-bold border border-brand-500/30 inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" /> Match Found
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
          {request?.skillName || 'Skill'} Mentorship Confirmation
        </h1>
        <p className="text-xs text-slate-400 max-w-lg mx-auto">
          Review your matched peer mentor and confirm your 1-on-1 session request. (No session is booked until you confirm below.)
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Mentor Profile Card */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center justify-center font-extrabold text-lg">
              {mentor?.displayName?.charAt(0) || 'M'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">{mentor?.displayName}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold border border-brand-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-brand-400" /> {mentor?.verificationStatus?.replace('_', ' ') || 'Verified'}
                </span>
              </div>
              <div className="text-xs text-slate-400">{mentor?.college} • {mentor?.major || 'Computer Science'}</div>
            </div>
          </div>

          {mentor?.matchScore && (
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Match Score</span>
              <span className="text-lg font-extrabold text-emerald-400">{mentor.matchScore}%</span>
            </div>
          )}
        </div>

        {/* Why this mentor matched */}
        {mentor?.matchReasons && mentor.matchReasons.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Why this mentor matched:</span>
            <div className="space-y-1 text-xs text-slate-300">
              {mentor.matchReasons.map((r: string, i: number) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-emerald-400">{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slot Selection */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Suggested Available Time Window:
          </span>
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-400" />
              <span className="text-white font-medium">
                {request?.preferredDays?.join(', ') || 'Tue/Thu'} ({request?.preferredTimeStart || '18:00'} – {request?.preferredTimeEnd || '20:00'} IST)
              </span>
            </div>
            <span className="text-slate-400">1 Hour Session</span>
          </div>
        </div>

        {/* Escrow Credit Requirement */}
        <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <Coins className="w-5 h-5 text-brand-400 shrink-0" />
            <div>
              <strong className="text-white block">Escrow Requirement: 1 Skill Credit</strong>
              <span className="text-slate-400 text-[11px]">Reserved in escrow upon request; settled to mentor after completed session.</span>
            </div>
          </div>
        </div>

        {/* Confirmation & Decline Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full sm:flex-1 py-3 rounded-2xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-extrabold text-xs shadow-glow-brand transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className={`w-4 h-4 ${confirming ? 'animate-spin' : ''}`} />
            <span>{confirming ? 'Confirming Session...' : 'Confirm Session Request'}</span>
          </button>

          <button
            onClick={() => handleDecline(false)}
            disabled={confirming}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-800 transition-colors"
          >
            No, Not Now (Keep Looking)
          </button>
        </div>

      </div>

    </div>
  );
}
