'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Sparkles, 
  Search, 
  ShieldCheck, 
  Coins, 
  Award, 
  Brain, 
  ArrowRight, 
  CheckCircle2, 
  BookOpen, 
  GraduationCap, 
  Users, 
  Star,
  Clock,
  Check
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function LandingPage() {
  const { user } = useAuth();
  const [quickSearch, setQuickSearch] = useState('');

  const popularSkills = [
    { name: 'Python', category: 'Programming', mentorsCount: 6, tag: 'Most Popular' },
    { name: 'React', category: 'Web Development', mentorsCount: 4, tag: 'High Demand' },
    { name: 'UI/UX Design', category: 'Design', mentorsCount: 3, tag: 'Active' },
    { name: 'Calculus', category: 'Mathematics', mentorsCount: 3, tag: 'Academic' },
    { name: 'Solidity', category: 'Web3', mentorsCount: 2, tag: 'Specialized' },
    { name: 'Data Structures', category: 'Computer Science', mentorsCount: 5, tag: 'Core CS' },
  ];

  return (
    <div className="relative overflow-hidden">
      
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-accent-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* 1. HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pt-16 pb-20 text-center">
        
        {/* Campus Live Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-xs font-semibold text-brand-300 shadow-glass mb-8 animate-float">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping" />
          <span>Campus Peer-Learning Network Active</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-300">100% Free Skill Credits</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
          Learn from your peers. <br />
          <span className="bg-gradient-to-r from-brand-400 via-emerald-300 to-accent-400 bg-clip-text text-transparent">
            Share what you know.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          SkillSwap Campus connects students to exchange skills without money. 
          Teach topics you have mastered to earn Skill Credits, then spend them learning from classmates.
        </p>

        {/* Quick Search Bar */}
        <div className="mt-10 max-w-xl mx-auto">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              window.location.href = `/explore?q=${encodeURIComponent(quickSearch)}`;
            }}
            className="flex items-center gap-2 p-2 rounded-2xl glass-panel border border-slate-700 shadow-2xl focus-within:border-brand-500 transition-colors"
          >
            <div className="pl-3 text-slate-400">
              <Search className="w-5 h-5" />
            </div>
            <input 
              type="text" 
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Search skill (e.g. 'Python', 'React', 'Calculus')..."
              className="flex-1 bg-transparent border-none text-sm text-white placeholder-slate-400 focus:outline-none px-2"
            />
            <button 
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-dark-bg font-bold text-xs tracking-wide shadow-glow-brand transition-all flex items-center gap-1.5"
            >
              Search <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-xs text-slate-400">
            <span>Popular:</span>
            {['Python', 'React', 'UI/UX Design', 'Calculus', 'Solidity'].map(tag => (
              <Link 
                key={tag} 
                href={`/explore?q=${encodeURIComponent(tag)}`}
                className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
          <Link 
            href="/explore" 
            className="px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-sm shadow-glow-brand transition-all flex items-center gap-2"
          >
            <Search className="w-4 h-4" /> Find a Mentor
          </Link>
          <Link 
            href={user ? "/profile" : "/register/mentor"} 
            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 transition-colors flex items-center gap-2"
          >
            <GraduationCap className="w-4 h-4 text-sky-400" /> Start Teaching
          </Link>
        </div>

        {/* Value Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mt-16 text-left">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">Starter Credits</div>
            <div className="text-2xl font-bold font-display text-brand-400 mt-1">4 Credits</div>
            <div className="text-[11px] text-slate-500 mt-1">Free upon account signup</div>
          </div>
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">Fair Exchange</div>
            <div className="text-2xl font-bold font-display text-white mt-1">1h = 1 Credit</div>
            <div className="text-[11px] text-slate-500 mt-1">Held safely in escrow during sessions</div>
          </div>
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">Peer Scheduling</div>
            <div className="text-2xl font-bold font-display text-accent-400 mt-1">Smart Slots</div>
            <div className="text-[11px] text-slate-500 mt-1">15-minute buffer conflict protection</div>
          </div>
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">Verified Skills</div>
            <div className="text-2xl font-bold font-display text-sky-400 mt-1">Assessments</div>
            <div className="text-[11px] text-slate-500 mt-1">Objective testing for mentors</div>
          </div>
        </div>

      </section>

      {/* 2. HOW SKILLSWAP WORKS */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 lg:px-8 py-16 border-t border-slate-800/60">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/30 text-xs font-semibold">
            Simple 4-Step Loop
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white">
            How SkillSwap Works
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Teach what you know to earn credits. Spend credits to learn from fellow students.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Step 1: TEACH */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3 relative hover:border-brand-500/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h3 className="font-bold text-white text-base">Teach What You Know</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Add skills you have mastered, complete objective skill assessments, and set your weekly availability windows.
            </p>
          </div>

          {/* Step 2: EARN */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3 relative hover:border-sky-500/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h3 className="font-bold text-white text-base">Earn Skill Credits</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Conduct 1-on-1 teaching sessions. For every verified hour taught, you receive 1 Skill Credit held safely in escrow.
            </p>
          </div>

          {/* Step 3: LEARN */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3 relative hover:border-accent-500/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-accent-500/20 text-accent-400 flex items-center justify-center font-bold text-sm">
              3
            </div>
            <h3 className="font-bold text-white text-base">Learn New Skills</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Spend your earned credits booking sessions with peer mentors across programming, mathematics, design, and science.
            </p>
          </div>

          {/* Step 4: REPUTATION */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3 relative hover:border-amber-500/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
              4
            </div>
            <h3 className="font-bold text-white text-base">Build Campus Reputation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Receive verified ratings from classmates and unlock verifiable badges that showcase your academic credibility.
            </p>
          </div>

        </div>
      </section>

      {/* 3. POPULAR SKILLS SHOWCASE */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-16 border-t border-slate-800/60">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white">
              Explore Popular Campus Skills
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Connect with classmates ready to teach these top subjects today.
            </p>
          </div>
          <Link 
            href="/explore" 
            className="text-xs text-brand-400 hover:underline font-semibold flex items-center gap-1"
          >
            <span>View All Mentors</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {popularSkills.map((sk) => (
            <Link 
              key={sk.name}
              href={`/explore?q=${encodeURIComponent(sk.name)}`}
              className="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-brand-500/50 bg-slate-900/60 hover:bg-slate-900 transition-all flex items-center justify-between group"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white group-hover:text-brand-300 transition-colors">
                    {sk.name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    {sk.tag}
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  {sk.category} • <span className="text-brand-400 font-semibold">{sk.mentorsCount} Mentors</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      </section>

      {/* 4. TRUST & VERIFICATION */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-16 border-t border-slate-800/60">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Campus Verified Peer Network</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-white tracking-tight leading-tight">
              Learn with confidence from verified student mentors.
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Every mentor on SkillSwap is authenticated through campus email verification and objective skill assessments before teaching.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3" />
                </div>
                <div className="text-xs text-slate-300">
                  <strong className="text-white">Objective Skill Assessments:</strong> Mentors take timed technical assessments to prove proficiency.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3" />
                </div>
                <div className="text-xs text-slate-300">
                  <strong className="text-white">Smart Slot Protection:</strong> 15-minute buffers ensure realistic schedules without overlaps.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3" />
                </div>
                <div className="text-xs text-slate-300">
                  <strong className="text-white">Protected Escrow:</strong> Credits are locked during bookings and only released after both students confirm completion.
                </div>
              </div>
            </div>
          </div>

          {/* Visual Trust Card */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-500 to-accent-500 flex items-center justify-center font-bold text-dark-bg text-sm">
                  RK
                </div>
                <div>
                  <div className="font-bold text-white text-sm">Rahul Kumar</div>
                  <div className="text-xs text-slate-400">Senior CS • Stanford University</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-400 text-xs font-semibold border border-brand-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Verified Student
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">Python — Advanced</span>
                <span className="text-sky-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Assessment Verified
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Score: 92% • 27 sessions taught</span>
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400" /> 4.9 Rating
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 text-xs">
              <div className="text-slate-400">
                Rate: <strong className="text-white">1 Credit / hr</strong>
              </div>
              <Link 
                href="/explore?q=Python"
                className="px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs transition-colors"
              >
                Book Session
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CALL TO ACTION */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-16 mb-8">
        <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-brand-500/30 bg-gradient-to-br from-brand-950/40 via-slate-900 to-slate-950 text-center space-y-6 relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-white tracking-tight">
              Ready to trade skills with classmates?
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Create your account in seconds. Get 4 starter Skill Credits and start learning or teaching today.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link 
              href="/register" 
              className="px-8 py-3.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-extrabold text-xs sm:text-sm tracking-wide shadow-glow-brand transition-all flex items-center gap-2"
            >
              <span>Join SkillSwap Campus</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link 
              href="/explore" 
              className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm border border-slate-700 transition-colors"
            >
              Browse Mentors
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
