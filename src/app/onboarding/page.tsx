'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Sparkles, 
  GraduationCap, 
  Building2, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  BookOpen,
  HeartHandshake
} from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refreshUser, loading: authLoading } = useAuth();

  const [college, setCollege] = useState('Stanford University');
  const [major, setMajor] = useState('Computer Science');
  const [year, setYear] = useState<'Freshman' | 'Sophomore' | 'Junior' | 'Senior' | 'Graduate' | 'PhD'>('Sophomore');
  const [teachingPreference, setTeachingPreference] = useState<'Anyone' | 'Women' | 'Men'>('Anyone');
  const [bio, setBio] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (user.college) setCollege(user.college);
      if (user.major) setMajor(user.major);
      if (user.year && ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'PhD'].includes(user.year)) {
        setYear(user.year as any);
      }
    }
  }, [user]);

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userType: 'TEACHER_LEARNER',
          college: college.trim() || 'SkillSwap Campus',
          major: major.trim() || 'General Studies',
          year,
          teachingPreference,
          bio: bio.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save onboarding preferences.');
        setSaving(false);
        return;
      }

      await refreshUser();
      router.push('/profile');
    } catch (err: any) {
      setError('A network error occurred. Please try again.');
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center text-xs text-slate-400">
        Loading campus onboarding...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      
      {/* Top Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Step 2: Complete Your Campus Profile</span>
        </div>
        <h1 className="text-3xl font-display font-extrabold text-white tracking-tight">
          Welcome to SkillSwap Campus!
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
          Tell us about your university and studies so peer mentors and learners can connect with you for 1-on-1 skill exchanges.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* Profile Details Container */}
      <form onSubmit={handleCompleteOnboarding} className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <GraduationCap className="w-5 h-5 text-brand-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Academic Details</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* College */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-brand-400" />
              <span>College / University</span>
            </label>
            <input 
              type="text"
              required
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              placeholder="E.g. Stanford University"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Major */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-brand-400" />
              <span>Major / Department</span>
            </label>
            <input 
              type="text"
              required
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              placeholder="E.g. Computer Science & AI"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Year of Study */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Year of Study</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="Freshman">Freshman (1st Year)</option>
              <option value="Sophomore">Sophomore (2nd Year)</option>
              <option value="Junior">Junior (3rd Year)</option>
              <option value="Senior">Senior (4th Year)</option>
              <option value="Graduate">Graduate (Master's)</option>
              <option value="PhD">PhD / Doctorate</option>
            </select>
          </div>

          {/* Teaching Preference */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <HeartHandshake className="w-3.5 h-3.5 text-brand-400" />
              <span>Mentoring Preference</span>
            </label>
            <select
              value={teachingPreference}
              onChange={(e) => setTeachingPreference(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="Anyone">Open to Any Student (Recommended)</option>
              <option value="Women">Women in STEM Preference</option>
              <option value="Men">Men Preference</option>
            </select>
          </div>

        </div>

        {/* Bio */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Campus Bio &amp; Learning Interests <span className="text-slate-500 font-normal">(Optional)</span>
          </label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Share what skills you love teaching, what you are looking to learn, and your campus interests..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
          />
        </div>

        {/* Highlight Banner */}
        <div className="p-3.5 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-xs text-brand-300 flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-brand-400 shrink-0" />
          <span>You start with <strong>3 Skill Credits</strong>. You can teach skills you know to earn credits and book sessions anytime!</span>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-glow-brand disabled:opacity-50"
          >
            {saving ? (
              <span>Saving Campus Profile...</span>
            ) : (
              <>
                <span>Complete Setup &amp; Explore Skills</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  );
}
