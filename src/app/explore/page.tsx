'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Search, 
  Sparkles, 
  Star, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Repeat, 
  ChevronRight, 
  X, 
  Coins, 
  UserCheck, 
  ShieldCheck, 
  AlertCircle,
  BellRing,
  BookOpen,
  Users,
  MapPin,
  Check,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { getSkillStatusDisplay } from '@/lib/skill-display';

function ExploreComponent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get('q') || '';
  const initialMode = searchParams.get('mode') || 'ALL';

  const { user, refreshUser } = useAuth();

  const [query, setQuery] = useState(initialQ);
  const [selectedMode, setSelectedMode] = useState<string>(initialMode);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [minProficiency, setMinProficiency] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [campusFilter, setCampusFilter] = useState<string>('ALL'); // 'ALL' | 'OWN_COLLEGE'
  const [minRating, setMinRating] = useState<string>('');

  // Smart Slot Finder Form States
  const [slotDate, setSlotDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().substring(0, 10);
  });
  const [slotStartTime, setSlotStartTime] = useState<string>('10:00');
  const [slotEndTime, setSlotEndTime] = useState<string>('22:00');
  const [slotDuration, setSlotDuration] = useState<number>(60);
  const [slotFlexibility, setSlotFlexibility] = useState<boolean>(true);
  const [slotMode, setSlotMode] = useState<'ONLINE' | 'CAMPUS_IN_PERSON'>('ONLINE');
  const [slotSearchResults, setSlotSearchResults] = useState<any | null>(null);
  const [slotSearchLoading, setSlotSearchLoading] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    modeA: any[];
    modeB: any[];
    insideCollege: any[];
    outsideCollege: any[];
    modeC: any[];
  }>({ modeA: [], modeB: [], insideCollege: [], outsideCollege: [], modeC: [] });

  // Smart Scheduling / Booking Modal State
  const [bookingCandidate, setBookingCandidate] = useState<any | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().substring(0, 10);
  });
  const [bookingTime, setBookingTime] = useState<string>('18:00');
  const [isFlexibleScheduling, setIsFlexibleScheduling] = useState<boolean>(true);
  const [flexibleStart, setFlexibleStart] = useState<string>('16:00');
  const [flexibleEnd, setFlexibleEnd] = useState<string>('20:00');
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [slotsLoading, setSlotsLoading] = useState<boolean>(false);
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [nextSlotAlternative, setNextSlotAlternative] = useState<string | null>(null);

  // Skill Gap Modal States
  const [skillRequestModalOpen, setSkillRequestModalOpen] = useState(false);
  const [requestSkillName, setRequestSkillName] = useState('');
  const [requestCategory, setRequestCategory] = useState('Computer Science');
  const [requestProficiency, setRequestProficiency] = useState('Beginner');
  const [requestCurrentLevel, setRequestCurrentLevel] = useState('Beginner');
  const [requestGoal, setRequestGoal] = useState('');
  const [requestSchedule, setRequestSchedule] = useState('Flexible weekday evenings');
  const [requestUrgency, setRequestUrgency] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSuccessMsg, setRequestSuccessMsg] = useState<string | null>(null);

  // Notification Subscription state
  const [subscribedSkills, setSubscribedSkills] = useState<Record<string, boolean>>({});

  // Execute IRCTC-Style Smart Slot Search
  const executeSlotSearch = async () => {
    setSlotSearchLoading(true);
    try {
      const res = await fetch('/api/scheduling/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillQuery: query.trim(),
          date: slotDate,
          startTimeWindow: slotStartTime,
          endTimeWindow: slotEndTime,
          durationMinutes: Number(slotDuration),
          isFlexible: slotFlexibility,
          campusScope: campusFilter,
          sessionMode: slotMode,
          verifiedOnly,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSlotSearchResults(data.data || null);
      }
    } catch (err) {
      console.error('Smart Slot search failed:', err);
    } finally {
      setSlotSearchLoading(false);
    }
  };

  // Fetch search results from API (Catalog & ML Matching)
  const executeSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (selectedMode !== 'ALL' && selectedMode !== 'SLOT_FINDER') params.set('mode', selectedMode);
      if (selectedCategory) params.set('skillCategory', selectedCategory);
      if (minProficiency) params.set('minProficiency', minProficiency);
      if (selectedDay) params.set('dayOfWeek', selectedDay);
      if (verifiedOnly) params.set('verifiedOnly', 'true');
      if (minRating) params.set('minRating', minRating);

      const res = await fetch(`/api/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        let bMatches = data.results?.modeB_skillMatches || [];
        let inMatches = data.results?.insideCollegeMatches || [];
        let outMatches = data.results?.outsideCollegeMatches || [];

        if (campusFilter === 'OWN_COLLEGE') {
          bMatches = bMatches.filter((m: any) => m.campusTier === 'OWN_COLLEGE');
          outMatches = [];
        }

        setResults({
          modeA: data.results?.modeA_knownPerson || [],
          modeB: bMatches,
          insideCollege: inMatches,
          outsideCollege: outMatches,
          modeC: data.results?.modeC_exchangeCycles || [],
        });
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeSearch();
    executeSlotSearch();
  }, [query, selectedMode, selectedCategory, minProficiency, selectedDay, verifiedOnly, minRating, campusFilter, slotDate, slotStartTime, slotEndTime, slotDuration, slotFlexibility]);

  // Fetch ranked available slots when a booking candidate or date changes
  useEffect(() => {
    if (!bookingCandidate || !bookingDate) return;

    const fetchSlots = async () => {
      setSlotsLoading(true);
      try {
        const res = await fetch('/api/scheduling/available-slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacherId: bookingCandidate.userId,
            date: bookingDate,
            startTimeWindow: isFlexibleScheduling ? flexibleStart : '08:00',
            endTimeWindow: isFlexibleScheduling ? flexibleEnd : '22:00',
            durationHours: (slotDuration || 60) / 60.0,
            bufferMinutes: 15,
            isFlexible: isFlexibleScheduling,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setAvailableSlots(data.candidateSlots || []);
          if (data.candidateSlots && data.candidateSlots.length > 0 && !selectedSlot) {
            setSelectedSlot(data.candidateSlots[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch available slots:', err);
      } finally {
        setSlotsLoading(false);
      }
    };

    fetchSlots();
  }, [bookingCandidate, bookingDate, isFlexibleScheduling, flexibleStart, flexibleEnd, slotDuration]);

  // Handle Quick Direct Slot Booking from Slot Finder
  const handleQuickBookSlot = (cand: any, slot: any) => {
    setBookingCandidate(cand);
    setBookingDate(slotDate);
    setSelectedSlot(slot);
    setBookingError(null);
    setBookingSuccess(null);
  };

  // Handle Smart Booking Submission with atomic lock
  const handleConfirmBooking = async () => {
    if (!bookingCandidate) return;
    setBookingLoading(true);
    setBookingError(null);
    setNextSlotAlternative(null);
    setBookingSuccess(null);

    try {
      let scheduledStart = '';
      let scheduledEnd = '';

      if (isFlexibleScheduling && selectedSlot) {
        scheduledStart = selectedSlot.startTime;
        scheduledEnd = selectedSlot.endTime;
      } else {
        const scheduledDateTime = new Date(`${bookingDate}T${bookingTime}:00`);
        const endDateTime = new Date(scheduledDateTime.getTime() + (slotDuration || 60) * 60 * 1000);
        scheduledStart = scheduledDateTime.toISOString();
        scheduledEnd = endDateTime.toISOString();
      }

      const payload = {
        teacherId: bookingCandidate.userId,
        skillId: bookingCandidate.matchedSkill?.skillId || 'skill-python',
        title: `1-on-1 Mentorship: ${bookingCandidate.matchedSkill?.skillName || 'Skill Session'}`,
        scheduledStart,
        scheduledEnd,
        durationHours: (slotDuration || 60) / 60.0,
        creditsAmount: 1,
        mode: slotMode,
        notes: bookingNotes || 'Excited to learn from you!',
      };

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setBookingError(data.error || 'Booking failed');
        if (data.nextAvailableSlot) {
          setNextSlotAlternative(data.nextAvailableSlot);
        }
      } else {
        setBookingSuccess(data.message || 'Session booked successfully! 1 Skill Credit held in escrow.');
        await refreshUser();
        executeSlotSearch();
        setTimeout(() => {
          setBookingCandidate(null);
          setBookingSuccess(null);
        }, 2200);
      }
    } catch (err: any) {
      setBookingError('Network error occurred while booking session');
    } finally {
      setBookingLoading(false);
    }
  };

  // 1-Click Subscribe to Mentor Availability
  const handleSubscribeSkill = async (skillName: string, category: string = 'Computer Science') => {
    try {
      const res = await fetch('/api/skill-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBSCRIBE',
          skillName,
          category,
        }),
      });
      if (res.ok) {
        setSubscribedSkills(prev => ({ ...prev, [skillName.toLowerCase()]: true }));
      }
    } catch (err) {
      console.error('Subscription error:', err);
    }
  };

  // Submit Skill Request from Gap Resolver
  const handleSubmitSkillRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestSubmitting(true);
    try {
      const chosenSkill = requestSkillName || query || 'Python';
      const res = await fetch('/api/learning-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillName: chosenSkill,
          category: requestCategory,
          requestedProficiency: requestProficiency,
          preferredDays: ['Tuesday', 'Thursday'],
          preferredTimeStart: '17:00',
          preferredTimeEnd: '20:00',
          durationHours: 1.0,
          learningGoal: requestGoal || `Master ${chosenSkill} concepts and projects`,
          searchScope: 'ALL',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setRequestSuccessMsg("We'll notify you when a suitable mentor becomes available.");
        setTimeout(() => {
          setSkillRequestModalOpen(false);
          setRequestSuccessMsg(null);
          setRequestGoal('');
        }, 2500);
      } else {
        alert(data.error || 'Failed to submit skill request');
      }
    } catch (err) {
      console.error('Skill request submit failed:', err);
    } finally {
      setRequestSubmitting(false);
    }
  };

  const clearAllFilters = () => {
    setQuery('');
    setSelectedMode('ALL');
    setSelectedCategory('');
    setMinProficiency('');
    setSelectedDay('');
    setVerifiedOnly(false);
    setCampusFilter('ALL');
    setMinRating('');
  };

  const hasActiveFilters = Boolean(query || selectedCategory || minProficiency || selectedDay || verifiedOnly || minRating || campusFilter !== 'ALL' || selectedMode !== 'ALL');
  const categories = ['Computer Science', 'Design', 'Languages', 'Mathematics', 'Business'];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const isSkillGapZeroSupply = (selectedMode === 'ALL' || selectedMode === 'MODE_B') && results.modeB.length === 0 && !loading;

  // Reusable Mentor Card Component (with 1-Click Slot Pills)
  const renderMentorCard = (cand: any, isOutside: boolean, showSlotPills: boolean = true) => {
    const statusInfo = getSkillStatusDisplay(cand?.matchedSkill?.verificationStatus || 'SELF_DECLARED');
    const badgeBorder = isOutside ? 'border-sky-500/30' : 'border-brand-500/30';
    const bgGradient = isOutside ? 'from-sky-950/20 to-slate-900/60' : 'from-brand-950/20 to-slate-900/60';
    const btnBg = isOutside ? 'bg-sky-500 hover:bg-sky-400' : 'bg-brand-500 hover:bg-brand-400';
    const initials = (cand?.displayName || 'SM').substring(0, 2).toUpperCase();

    return (
      <div key={`${isOutside ? 'out' : 'in'}-${cand?.userId || Math.random()}-${cand?.matchedSkill?.skillId || 's'}`} className={`glass-panel p-5 rounded-2xl border ${badgeBorder} glass-panel-hover flex flex-col justify-between bg-gradient-to-br ${bgGradient} shadow-glass`}>
        <div>
          {/* Header with Avatar, Name, Campus Pill, & Match Score */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${isOutside ? 'from-sky-500 to-indigo-600' : 'from-brand-500 to-accent-600'} flex items-center justify-center text-dark-bg font-extrabold text-sm shadow-md`}>
                {initials}
              </div>
              <div>
                <h3 className="font-bold text-white text-sm leading-snug">{cand?.displayName || 'Student Mentor'}</h3>
                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold border mt-0.5 ${
                  isOutside ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-brand-500/20 text-brand-300 border-brand-500/30'
                }`}>
                  {isOutside ? '🌐 ' : '🏫 '} {cand?.college || (isOutside ? 'Outside College' : 'Your College')}
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className={`px-2.5 py-1 rounded-xl font-extrabold text-xs border ${
                isOutside ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-brand-500/20 text-brand-300 border-brand-500/30'
              }`}>
                {cand?.matchScore || 85}% Match
              </div>
            </div>
          </div>

          {/* Matched Skill & Verification Badge */}
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1 mb-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">{cand?.matchedSkill?.skillName || 'Skill'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold">
                {cand?.matchedSkill?.proficiency || 'Intermediate'}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 text-[11px]">
              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusInfo.badgeColor}`}>
                {statusInfo.icon} {statusInfo.label}
              </span>
              <span className="text-slate-400 text-[10px]">
                {cand?.matchedSkill?.experienceYears || 1} yrs exp
              </span>
            </div>
          </div>

          {/* Available Slots Pills (IRCTC Style Quick Booking) */}
          {showSlotPills && cand?.availableSlots && cand.availableSlots.length > 0 && (
            <div className="mb-3 space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                <span>Bookable Slots ({cand.availableSlots.length})</span>
                {cand.preferredWindowDisplay && (
                  <span className="text-[10px] text-brand-400 font-normal">
                    Pref: {cand.preferredWindowDisplay}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {cand.availableSlots.slice(0, 4).map((slot: any, sIdx: number) => (
                  <button
                    key={sIdx}
                    onClick={() => handleQuickBookSlot(cand, slot)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-transform hover:scale-105 ${
                      slot.isPreferred 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30' 
                        : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>{slot.displayStart}–{slot.displayEnd}</span>
                    {slot.isPreferred && <span className="text-[9px] text-emerald-400 font-normal">★</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Teaching Preference */}
          <div className="space-y-1 text-[11px] text-slate-400 mb-2">
            <div className="flex items-center gap-1.5 text-slate-500">
              <span>Teaches: <strong className="text-slate-400">{cand?.teachingPreference || 'Anyone'}</strong></span>
            </div>
          </div>
        </div>

        {/* Card Footer: Rating & Book Button */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-2">
          {cand?.mentorQuality?.qualitySource === 'PROFICIENCY_FIRST_LECTURE' ? (
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{cand.mentorQuality.qualityScore.toFixed(1)}</span>
                <span className="text-[9px] text-brand-400 font-semibold px-1.5 py-0.5 bg-brand-500/10 rounded border border-brand-500/20">
                  1st Lecture
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-normal">Based on {cand.mentorQuality.proficiency}</span>
            </div>
          ) : (
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{cand?.mentorQuality?.qualityScore?.toFixed(1) || cand?.reputation?.bayesianRating?.toFixed(1) || '4.5'}</span>
                {cand?.mentorQuality?.totalReviews ? (
                  <span className="text-[9px] text-emerald-400 font-semibold px-1.5 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">
                    Learner Rated
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] text-slate-500 font-normal">
                {cand?.mentorQuality?.totalReviews || cand?.reputation?.totalReviews || 0} student review(s)
              </span>
            </div>
          )}

          <button
            onClick={() => setBookingCandidate(cand)}
            className={`px-3.5 py-1.5 rounded-lg ${btnBg} text-dark-bg font-bold text-xs transition-colors flex items-center gap-1 shadow-sm`}
          >
            Custom Book (1 Credit)
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
      
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
              Campus Peer Discovery
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Deterministic slot finder, hybrid ML matching, and circular barter cycle discovery.
            </p>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setSelectedMode('SLOT_FINDER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                selectedMode === 'SLOT_FINDER' ? 'bg-brand-500 text-dark-bg shadow-glow-brand' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> Smart Slot Finder
            </button>
            <button
              onClick={() => setSelectedMode('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedMode === 'ALL' ? 'bg-brand-500 text-dark-bg' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Discoveries
            </button>
            <button
              onClick={() => setSelectedMode('MODE_A')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                selectedMode === 'MODE_A' ? 'bg-brand-500 text-dark-bg' : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" /> Mode A (Person)
            </button>
            <button
              onClick={() => setSelectedMode('MODE_B')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                selectedMode === 'MODE_B' ? 'bg-brand-500 text-dark-bg' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Mode B (ML Skill)
            </button>
            <button
              onClick={() => setSelectedMode('MODE_C')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                selectedMode === 'MODE_C' ? 'bg-brand-500 text-dark-bg' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" /> Mode C (Cycles)
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* IRCTC-STYLE SMART SLOT FINDER SEARCH PANEL */}
      {/* ============================================================ */}
      {selectedMode === 'SLOT_FINDER' ? (
        <div className="glass-panel p-6 rounded-3xl border border-brand-500/30 bg-gradient-to-br from-brand-950/20 via-slate-900 to-slate-950 mb-8 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Smart Slot Finder — Train-Style Availability Search</h2>
                <p className="text-[11px] text-slate-400">Zero manual scheduling math. Calculates valid overlapping slots instantly.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            
            {/* 1. Skill Input */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                What do you want to learn?
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="E.g., Python, Solidity, PyTorch..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* 2. Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Session Date
              </label>
              <input 
                type="date"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* 3. Preferred Time Range */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Preferred Time
              </label>
              <div className="flex items-center gap-1">
                <input 
                  type="time"
                  value={slotStartTime}
                  onChange={(e) => setSlotStartTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-[11px] text-white focus:outline-none focus:border-brand-500"
                />
                <span className="text-slate-500 text-xs">→</span>
                <input 
                  type="time"
                  value={slotEndTime}
                  onChange={(e) => setSlotEndTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-[11px] text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* 4. Session Duration */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Duration
              </label>
              <select
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-2 focus:outline-none"
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes (1 hr)</option>
                <option value={90}>90 minutes</option>
                <option value={120}>120 minutes (2 hrs)</option>
              </select>
            </div>

            {/* 5. Flexibility */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Flexibility
              </label>
              <select
                value={slotFlexibility ? 'FLEXIBLE' : 'EXACT'}
                onChange={(e) => setSlotFlexibility(e.target.value === 'FLEXIBLE')}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-2 focus:outline-none"
              >
                <option value="FLEXIBLE">Flexible (Scan Window)</option>
                <option value="EXACT">Exact (Must match start)</option>
              </select>
            </div>

          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="slotMode"
                  checked={slotMode === 'ONLINE'}
                  onChange={() => setSlotMode('ONLINE')}
                  className="text-brand-500 focus:ring-0"
                />
                <span>Online Video</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="slotMode"
                  checked={slotMode === 'CAMPUS_IN_PERSON'}
                  onChange={() => setSlotMode('CAMPUS_IN_PERSON')}
                  className="text-brand-500 focus:ring-0"
                />
                <span>In-Person Library</span>
              </label>
              <span className="text-slate-600">|</span>
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none"
              >
                <option value="ALL">🌐 All Campuses</option>
                <option value="OWN_COLLEGE">🏫 My College Only</option>
              </select>
            </div>

            <button
              onClick={executeSlotSearch}
              disabled={slotSearchLoading}
              className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {slotSearchLoading ? 'Calculating Overlaps & Buffers...' : 'Find Available Mentors & Slots'}
            </button>
          </div>

          {/* Slot Search Results View */}
          {slotSearchResults && (
            <div className="pt-6 border-t border-slate-800 space-y-6">
              
              {/* Summary Pill */}
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-400" />
                  <span className="text-white font-medium">{slotSearchResults.message}</span>
                </div>
                <span className="text-slate-400 text-[11px]">Date: {slotSearchResults.date} ({slotSearchResults.dayOfWeek})</span>
              </div>

              {/* Case B: Mentors exist but 0 slots in requested window */}
              {slotSearchResults.status === 'NO_SLOTS_AVAILABLE_AT_TIME' && (
                <div className="glass-panel p-6 rounded-2xl border border-amber-500/30 bg-amber-950/20 text-center space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">No Suitable Slot During Your Selected Time</h3>
                    <p className="text-xs text-slate-300 max-w-md mx-auto mt-1">
                      We found {slotSearchResults.totalMentorsFound} mentor(s) for this skill, but none are free between {slotStartTime} and {slotEndTime}.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => { setSlotStartTime('10:00'); setSlotEndTime('22:00'); }}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
                    >
                      Expand to Full Day (10 AM–10 PM)
                    </button>
                    <button
                      onClick={() => { setRequestSkillName(query); setSkillRequestModalOpen(true); }}
                      className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs transition-colors shadow-glow-brand"
                    >
                      Post Learner Request
                    </button>
                  </div>
                </div>
              )}

              {/* Case A: 0 Mentors anywhere */}
              {slotSearchResults.status === 'NO_MENTOR_FOUND' && (
                <div className="glass-panel p-6 rounded-2xl border border-rose-500/30 bg-rose-950/20 text-center space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">No Verified Mentor Found for &ldquo;{query || 'this skill'}&rdquo;</h3>
                    <p className="text-xs text-slate-300 max-w-md mx-auto mt-1">
                      We searched inside your college and across all partner institutions. Create a learner request to trigger notifications when a mentor joins.
                    </p>
                  </div>
                  <button
                    onClick={() => { setRequestSkillName(query); setSkillRequestModalOpen(true); }}
                    className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs transition-colors shadow-glow-brand"
                  >
                    Create Learner Request
                  </button>
                </div>
              )}

              {/* Stage 1: Inside College Mentors with Slots */}
              {slotSearchResults.insideCollegeMentors && slotSearchResults.insideCollegeMentors.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-brand-300">
                      Stage 1: Inside Your College Mentors ({slotSearchResults.insideCollegeMentors.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {slotSearchResults.insideCollegeMentors.map((cand: any) => renderMentorCard(cand, false, true))}
                  </div>
                </div>
              )}

              {/* Stage 2: Outside College Fallback Mentors with Slots */}
              {slotSearchResults.outsideCollegeMentors && slotSearchResults.outsideCollegeMentors.length > 0 && (
                <div className="space-y-4 pt-2">
                  {slotSearchResults.isStage2Fallback && (
                    <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-start gap-3 text-xs text-sky-200">
                      <MapPin className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold text-white block">
                          Stage 2 Fallback: Expanded search to verified mentors outside your college
                        </span>
                        <span className="text-slate-300">
                          Mentors from partner campuses are available during your requested time window. Book directly with Skill Credits:
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-sky-300">
                      {slotSearchResults.isStage2Fallback ? 'Stage 2: Outside College Mentors' : 'Partner Campuses & Network Mentors'} ({slotSearchResults.outsideCollegeMentors.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {slotSearchResults.outsideCollegeMentors.map((cand: any) => renderMentorCard(cand, true, true))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      ) : (
        /* Standard Catalog Central Search Bar */
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 mb-8 space-y-3 shadow-xl">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by student name ('Rahul', 'Elena') or skill ('Solidity', 'Python', 'Quantum Computing', 'Figma')..."
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-11 pr-10 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 transition-colors"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Pills & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === '' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    selectedCategory === cat ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none"
              >
                <option value="ALL">🌐 All Campuses</option>
                <option value="OWN_COLLEGE">🏫 My College Only</option>
              </select>

              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none"
              >
                <option value="">Any Day</option>
                {days.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <select
                value={minProficiency}
                onChange={(e) => setMinProficiency(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none"
              >
                <option value="">Any Level</option>
                <option value="Beginner">Beginner+</option>
                <option value="Intermediate">Intermediate+</option>
                <option value="Advanced">Advanced+</option>
                <option value="Expert">Expert Only</option>
              </select>

              <label className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="rounded text-brand-500 focus:ring-0"
                />
                <span>Verified Only</span>
              </label>

              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-colors"
                  title="Clear all filters"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results Feed for standard modes */}
      {selectedMode !== 'SLOT_FINDER' && (
        loading ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Querying deterministic catalog and calculating hybrid ML compatibility features...</p>
          </div>
        ) : (
          <div className="space-y-10">
            
            {/* 1. MODE A: KNOWN PERSON */}
            {(selectedMode === 'ALL' || selectedMode === 'MODE_A') && results.modeA.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-brand-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-brand-300">
                    Mode A — Exact Known Person Matches ({results.modeA.length})
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30 font-medium">
                    Deterministic Exact Identity Match
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.modeA.map((cand) => {
                    const statusInfo = getSkillStatusDisplay(cand?.matchedSkill?.verificationStatus || 'SELF_DECLARED');
                    const initials = (cand?.displayName || 'SM').substring(0, 2).toUpperCase();
                    return (
                      <div key={cand.userId} className="glass-panel p-5 rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-950/30 to-slate-900/60 shadow-glass">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-500 to-accent-600 flex items-center justify-center text-dark-bg font-extrabold text-base shadow-md">
                              {initials}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-white text-base">{cand.displayName}</h3>
                                {cand.isVerifiedStudent && (
                                  <span className="flex items-center gap-1 text-[11px] text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20 font-medium">
                                    <CheckCircle2 className="w-3 h-3" /> Verified Student
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-500" />
                                {cand.college} • {cand.major} ({cand.year})
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            {cand.mentorQuality?.qualitySource === 'PROFICIENCY_FIRST_LECTURE' ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-amber-400 text-xs font-bold justify-end">
                                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                                  <span>{cand.mentorQuality.qualityScore.toFixed(1)}</span>
                                  <span className="text-[9px] text-brand-400 font-semibold px-1.5 py-0.2 bg-brand-500/10 rounded border border-brand-500/20">
                                    1st Lecture
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400">Based on {cand.mentorQuality.proficiency}</div>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-amber-400 text-xs font-bold justify-end">
                                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                                  <span>{cand.mentorQuality?.qualityScore?.toFixed(1) || cand.reputation?.bayesianRating?.toFixed(1) || '4.5'}</span>
                                  {cand.mentorQuality?.totalReviews ? (
                                    <span className="text-[9px] text-emerald-400 font-semibold px-1.5 py-0.2 bg-emerald-500/10 rounded border border-emerald-500/20">
                                      Learner Rated
                                    </span>
                                  ) : null}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {cand.mentorQuality?.totalReviews || cand.reputation?.totalSessionsTaught || 0} student review(s)
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 mt-3 line-clamp-2">{cand.bio}</p>

                        <div className="mt-3.5 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-white">{cand.matchedSkill?.skillName}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 font-medium">
                              {cand.matchedSkill?.proficiency}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${statusInfo.badgeColor}`}>
                              {statusInfo.icon} {statusInfo.label}
                            </span>
                          </div>
                          <span className="text-[11px] text-brand-400 font-semibold">1 Credit / hr</span>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                          <button
                            onClick={() => setBookingCandidate(cand)}
                            className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand transition-all flex items-center gap-1.5"
                          >
                            Request Session <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. MODE B: KNOWN SKILL */}
            {(selectedMode === 'ALL' || selectedMode === 'MODE_B') && (
              <div className="space-y-6">
                
                {isSkillGapZeroSupply ? (
                  <div className="glass-panel p-8 rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-950 space-y-6 text-center shadow-xl">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                      <AlertCircle className="w-7 h-7" />
                    </div>

                    <div className="space-y-1 max-w-lg mx-auto">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold mb-1">
                        <span>Stage 3: No Mentor Found in Network</span>
                      </div>
                      <h3 className="text-lg font-bold text-white">
                        No verified mentor is currently available for &ldquo;{query || 'this skill'}&rdquo;
                      </h3>
                      <p className="text-xs text-slate-300">
                        Create a **Learner Request** to alert campus moderators and receive instant notification when a mentor joins.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl mx-auto pt-2">
                      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-left flex flex-col justify-between space-y-3">
                        <div>
                          <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center mb-2">
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs font-bold text-white">Create Learner Request</h4>
                          <p className="text-[11px] text-slate-400 mt-1">Post your learning goal to the campus demand board.</p>
                        </div>
                        <button
                          onClick={() => {
                            setRequestSkillName(query || '');
                            setSkillRequestModalOpen(true);
                          }}
                          className="w-full py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs transition-colors"
                        >
                          Create Request
                        </button>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-left flex flex-col justify-between space-y-3">
                        <div>
                          <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center mb-2">
                            <BellRing className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs font-bold text-white">Notify Me When Mentor Joins</h4>
                          <p className="text-[11px] text-slate-400 mt-1">Get an instant notification the second a mentor verifies.</p>
                        </div>
                        <button
                          onClick={() => handleSubscribeSkill(query || 'Requested Skill', selectedCategory || 'Computer Science')}
                          disabled={subscribedSkills[(query || 'Requested Skill').toLowerCase()]}
                          className={`w-full py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1 ${
                            subscribedSkills[(query || 'Requested Skill').toLowerCase()]
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-sky-600 hover:bg-sky-500 text-white'
                          }`}
                        >
                          {subscribedSkills[(query || 'Requested Skill').toLowerCase()] ? (
                            <><Check className="w-3.5 h-3.5" /> Subscribed</>
                          ) : (
                            'Notify Me'
                          )}
                        </button>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-left flex flex-col justify-between space-y-3">
                        <div>
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2">
                            <Users className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs font-bold text-white">Campus Study Circles</h4>
                          <p className="text-[11px] text-slate-400 mt-1">Collaborate with fellow students seeking this topic.</p>
                        </div>
                        <button
                          onClick={() => router.push('/studysphere')}
                          className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors"
                        >
                          Study Groups
                        </button>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-left flex flex-col justify-between space-y-3">
                        <div>
                          <div className="w-8 h-8 rounded-lg bg-accent-500/20 text-accent-400 flex items-center justify-center mb-2">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs font-bold text-white">AI Study Roadmap</h4>
                          <p className="text-[11px] text-slate-400 mt-1">Generate a structured curriculum with AI Coach.</p>
                        </div>
                        <button
                          onClick={() => router.push(`/study-coach?topic=${encodeURIComponent(query || 'Computer Science')}`)}
                          className="w-full py-1.5 rounded-lg bg-accent-600 hover:bg-accent-500 text-white font-bold text-xs transition-colors"
                        >
                          Launch Coach
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Stage 1: Inside College */}
                    {results.insideCollege && results.insideCollege.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-brand-400" />
                          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-300">
                            Stage 1: Inside Your College Mentors ({results.insideCollege.length})
                          </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {results.insideCollege.map((cand) => renderMentorCard(cand, false, true))}
                        </div>
                      </div>
                    )}

                    {/* Stage 2 / Network Mentors */}
                    {results.outsideCollege && results.outsideCollege.length > 0 && (
                      <div className="space-y-4 pt-2">
                        {query && (!results.insideCollege || results.insideCollege.length === 0) && (
                          <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-start gap-3 text-xs text-sky-200">
                            <MapPin className="w-3.5 h-3.5 text-sky-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-bold text-white block">
                                Stage 2 Fallback: No verified mentors currently inside your college for &ldquo;{query}&rdquo;
                              </span>
                              <span className="text-slate-300 mt-0.5 block">
                                Expanded search to verified mentors from partner campuses across the SkillSwap network:
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                          <h2 className="text-sm font-bold uppercase tracking-wider text-sky-300">
                            {query ? ((!results.insideCollege || results.insideCollege.length === 0) ? 'Stage 2: Outside College Mentors' : 'Partner Campuses & Network Mentors') : 'Available Campus Mentors & Peer Teachers'} ({results.outsideCollege.length})
                          </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {results.outsideCollege.map((cand) => renderMentorCard(cand, results.insideCollege && results.insideCollege.length > 0, true))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. MODE C: CYCLIC EXCHANGE LOOPS */}
            {(selectedMode === 'ALL' || selectedMode === 'MODE_C') && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-300">
                    Mode C — Multi-Person Network Exchange Cycles ({results.modeC.length})
                  </h2>
                </div>

                {results.modeC.length === 0 ? (
                  <div className="glass-panel p-6 rounded-2xl border border-slate-800 text-center text-xs text-slate-400">
                    No active circular barter loops currently detected. Add more learning goals to your profile to trigger network cycle discovery!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {results.modeC.map((cycle) => (
                      <div key={cycle.cycleId} className="glass-panel p-5 rounded-2xl border border-indigo-500/40 bg-gradient-to-br from-indigo-950/30 to-slate-900/60 shadow-glass">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                              <Repeat className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="font-bold text-white text-sm">{cycle.cycleLength}-Person Skill Exchange Loop</h3>
                              <p className="text-[11px] text-slate-400">Mutual Barter Feasibility: {cycle.feasibilityScore}%</p>
                            </div>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                            {cycle.status}
                          </span>
                        </div>

                        <div className="space-y-2 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                          {cycle.skillsFlow.map((flow: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-xs text-slate-300">
                              <div className="flex items-center gap-1.5 font-medium">
                                <span className="text-brand-400">{flow.fromName}</span>
                                <span className="text-slate-500">&rarr; teaches {flow.skillName} &rarr;</span>
                                <span className="text-indigo-300">{flow.toName}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                          {cycle.explanation}
                        </p>

                        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">Every student earns &amp; spends 1 credit</span>
                          <button 
                            onClick={() => alert(`Exchange Cycle ${cycle.cycleId} proposal opted-in! Other participants will be notified to confirm schedules.`)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
                          >
                            Opt-In to Exchange Loop
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )
      )}

      {/* ============================================================ */}
      {/* SMART SCHEDULING & 1-CLICK ESCROW BOOKING MODAL */}
      {/* ============================================================ */}
      {bookingCandidate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl border border-slate-700 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            
            <button 
              onClick={() => { setBookingCandidate(null); setBookingError(null); setNextSlotAlternative(null); }}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-500 to-brand-600 flex items-center justify-center text-dark-bg font-extrabold text-lg shadow-glow-brand">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Smart Session Scheduling</h3>
                <p className="text-xs text-slate-400">Mentor: {bookingCandidate.displayName || 'Student Mentor'} • {bookingCandidate.college || 'Campus'}</p>
              </div>
            </div>

            {bookingSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-brand-400 mx-auto animate-bounce" />
                <h4 className="text-base font-bold text-white">Session Reserved &amp; Escrow Locked!</h4>
                <p className="text-xs text-slate-300">{bookingSuccess}</p>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Skill Summary Capsule */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400">Skill: </span>
                    <span className="font-bold text-white">{bookingCandidate.matchedSkill?.skillName || 'Skill'}</span>
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300">
                      {bookingCandidate.matchedSkill?.proficiency || 'Intermediate'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-brand-400">1 Credit</span>
                    <div className="text-[10px] text-slate-400">Held in Escrow</div>
                  </div>
                </div>

                {/* Scheduling Mode Toggle: Flexible vs Exact */}
                <div className="flex items-center justify-between bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFlexibleScheduling(true);
                      setSelectedSlot(null);
                    }}
                    className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors ${
                      isFlexibleScheduling ? 'bg-brand-500 text-dark-bg' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Flexible Window Solver
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFlexibleScheduling(false);
                      setSelectedSlot(null);
                    }}
                    className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors ${
                      !isFlexibleScheduling ? 'bg-brand-500 text-dark-bg' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Exact Custom Time
                  </button>
                </div>

                {/* Date Selection */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Session Date
                  </label>
                  <input 
                    type="date"
                    value={bookingDate}
                    onChange={(e) => {
                      setBookingDate(e.target.value);
                      setSelectedSlot(null);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* Flexible Window Solver: Candidate Ranked Slots */}
                {isFlexibleScheduling ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Ranked Available Slots (15m Buffer)
                      </label>
                      <span className="text-[10px] text-brand-400 font-medium">
                        {slotsLoading ? 'Solving overlaps...' : `${availableSlots.length} valid slots`}
                      </span>
                    </div>

                    {slotsLoading ? (
                      <div className="py-4 text-center text-xs text-slate-400 animate-pulse">
                        Calculating mentor availability &amp; buffer constraints...
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
                        No overlapping slots available on this date. Switch to <span className="font-bold underline cursor-pointer" onClick={() => { setIsFlexibleScheduling(false); setSelectedSlot(null); }}>Exact Custom Time</span> to pick a custom time.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {availableSlots.slice(0, 6).map((slot, idx) => (
                          <button
                            type="button"
                            key={idx}
                            onClick={() => setSelectedSlot(slot)}
                            className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                              selectedSlot?.startTime === slot.startTime
                                ? 'bg-brand-500/20 border-brand-500 text-brand-300 ring-1 ring-brand-500'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="font-bold">{slot.displayStart} - {slot.displayEnd}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
                              <span>Rank {slot.score}%</span>
                              {slot.isPreferred && <span className="text-emerald-400 font-bold">★ Pref</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Choose Any Custom Start Time
                    </label>
                    <input 
                      type="time"
                      value={bookingTime}
                      onChange={(e) => {
                        setBookingTime(e.target.value);
                        setSelectedSlot(null);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                    />

                    {/* Quick Time Presets */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        { label: '10:00 AM', val: '10:00' },
                        { label: '02:00 PM', val: '14:00' },
                        { label: '04:00 PM', val: '16:00' },
                        { label: '05:30 PM', val: '17:30' },
                        { label: '07:00 PM', val: '19:00' },
                        { label: '08:30 PM', val: '20:30' },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => {
                            setBookingTime(preset.val);
                            setSelectedSlot(null);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                            bookingTime === preset.val
                              ? 'bg-brand-500/20 border-brand-500 text-brand-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Time Confirmation Badge */}
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Scheduled Time:</span>
                  <span className="font-bold text-brand-300">
                    {bookingDate} at {isFlexibleScheduling && selectedSlot ? `${selectedSlot.displayStart} - ${selectedSlot.displayEnd}` : `${bookingTime} (${slotDuration || 60}m)`}
                  </span>
                </div>

                {/* Session Notes */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Learning Goal / Questions for Mentor
                  </label>
                  <textarea 
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    placeholder="E.g., I want to review smart contract test suites and reentrancy prevention..."
                    rows={2}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-brand-500 placeholder-slate-500"
                  />
                </div>

                {/* Escrow Notice */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Zero-Risk Atomic Escrow Lock</span>
                  </div>
                  <p className="text-slate-300 leading-snug">
                    Your 1 Skill Credit is held in the escrow state machine until both you and your mentor confirm completion.
                  </p>
                </div>

                {/* Booking Error & Smart Alternative Display */}
                {bookingError && (
                  <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs space-y-2">
                    <p>{bookingError}</p>
                    {nextSlotAlternative && (
                      <div className="pt-1 border-t border-rose-500/30 flex items-center justify-between">
                        <span>Suggested next available slot:</span>
                        <span className="font-bold text-white">
                          {new Date(nextSlotAlternative).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Submit Action */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setBookingCandidate(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmBooking}
                    disabled={bookingLoading || (isFlexibleScheduling && !selectedSlot && availableSlots.length === 0)}
                    className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {bookingLoading ? 'Reserving Escrow...' : 'Confirm & Reserve 1 Credit'}
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SKILL GAP: CREATE LEARNER REQUEST MODAL */}
      {/* ============================================================ */}
      {skillRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSubmitSkillRequest} className="glass-panel w-full max-w-md rounded-3xl border border-slate-700 shadow-2xl p-6 relative space-y-4">
            <button type="button" onClick={() => setSkillRequestModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Create Learner Request</h3>
                <p className="text-xs text-slate-400">Post an unfulfilled skill to the campus demand board</p>
              </div>
            </div>

            {requestSuccessMsg ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-brand-400 mx-auto" />
                <p className="text-xs text-slate-200">{requestSuccessMsg}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Skill Topic</label>
                  <input 
                    type="text"
                    required
                    value={requestSkillName}
                    onChange={(e) => setRequestSkillName(e.target.value)}
                    placeholder="E.g., Quantum Computing, Rust, Solidity..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Target Level</label>
                    <select
                      value={requestProficiency}
                      onChange={(e) => setRequestProficiency(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                      <option value="Expert">Expert</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Urgency</label>
                    <select
                      value={requestUrgency}
                      onChange={(e) => setRequestUrgency(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2"
                    >
                      <option value="LOW">Low (Casual)</option>
                      <option value="MEDIUM">Medium (Next week)</option>
                      <option value="HIGH">High (Exam / Project soon)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Learning Goal / Focus Areas</label>
                  <textarea 
                    required
                    value={requestGoal}
                    onChange={(e) => setRequestGoal(e.target.value)}
                    placeholder="Describe what specific projects, coursework, or topics you want guidance on..."
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={requestSubmitting}
                  className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand transition-colors"
                >
                  {requestSubmitting ? 'Posting Request...' : 'Publish Learner Request to Campus'}
                </button>
              </div>
            )}
          </form>
        </div>
      )}

    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs text-slate-400">Loading discovery feed...</div>}>
      <ExploreComponent />
    </Suspense>
  );
}
