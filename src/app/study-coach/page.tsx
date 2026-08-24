'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Brain, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Star, 
  ShieldCheck, 
  Calendar, 
  Coins, 
  BookOpen, 
  Clock, 
  Target, 
  RotateCcw,
  Check,
  Search,
  Users
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function StudyCoachPage() {
  const { user } = useAuth();

  const [topic, setTopic] = useState('Python for Machine Learning');
  const [currentLevel, setCurrentLevel] = useState('Beginner');
  const [targetLevel, setTargetLevel] = useState('Intermediate');
  const [weeklyHours, setWeeklyHours] = useState(6);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [activeStageIndex, setActiveStageIndex] = useState<number | null>(0);

  // Load existing saved roadmap on mount
  useEffect(() => {
    async function loadSavedRoadmap() {
      if (!user) return;
      try {
        const res = await fetch('/api/ai/study-coach');
        if (res.ok) {
          const data = await res.json();
          if (data.roadmap) {
            setResult(data);
          }
        }
      } catch (err) {
        console.error('Failed to load saved roadmap:', err);
      }
    }
    loadSavedRoadmap();
  }, [user]);

  const handleGenerateRoadmap = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/study-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic: topic.trim(),
          currentLevel,
          targetLevel,
          weeklyHours,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setError(null);
        setActiveStageIndex(0);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error?.message || errData.error || 'AI roadmap generation is temporarily unavailable. GEMINI_API_KEY is required for live generation.');
      }
    } catch (err) {
      console.error('Study coach error:', err);
      setError('Network or server error while generating learning roadmap. Please check your connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  const sampleGoals = [
    'Python for Machine Learning',
    'Solidity & Smart Contract Auditing',
    'React & Next.js Full Stack',
    'Data Structures & Algorithms in Python',
    'UI/UX Design Systems in Figma',
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
          <Brain className="w-3.5 h-3.5" /> AI Study Coach
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-white tracking-tight">
          Personalized Learning Roadmap
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Enter your learning goal. The Study Coach generates a structured curriculum and connects each stage with verified campus mentors.
        </p>
      </div>

      {/* Input Form Panel */}
      <div className="max-w-3xl mx-auto glass-panel p-6 rounded-3xl border border-slate-800 shadow-2xl space-y-5">
        <form onSubmit={handleGenerateRoadmap} className="space-y-4">
          
          {/* Goal Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              What do you want to learn?
            </label>
            <div className="relative">
              <input 
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="E.g., Python for Machine Learning, Solidity, Calculus..."
                className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors shadow-inner"
              />
            </div>
          </div>

          {/* Level & Hours Preferences */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Current Level</label>
              <select
                value={currentLevel}
                onChange={(e) => setCurrentLevel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="Beginner">Beginner (No prior knowledge)</option>
                <option value="Intermediate">Intermediate (Basic syntax)</option>
                <option value="Advanced">Advanced (Project experience)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Level</label>
              <select
                value={targetLevel}
                onChange={(e) => setTargetLevel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="Intermediate">Intermediate Mastery</option>
                <option value="Advanced">Advanced / Production</option>
                <option value="Expert">Expert / Research</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Weekly Time Available</label>
              <select
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value={4}>4 hours / week</option>
                <option value={6}>6 hours / week</option>
                <option value={10}>10 hours / week</option>
                <option value={15}>15+ hours / week</option>
              </select>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-1.5 text-xs text-slate-400">
              <span className="text-slate-500">Suggested:</span>
              {sampleGoals.map(sg => (
                <button
                  type="button"
                  key={sg}
                  onClick={() => setTopic(sg)}
                  className="px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors"
                >
                  {sg.split(' ')[0]}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-accent-600 hover:from-indigo-500 hover:to-accent-500 text-white font-bold text-xs shadow-glow-accent transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating Roadmap...
                </span>
              ) : (
                <>
                  <span>Generate Roadmap</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error Alert Box with Retry */}
      {error && (
        <div className="max-w-3xl mx-auto p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-2.5 text-xs">
            <span className="text-amber-400 font-bold text-sm leading-none mt-0.5">⚠️</span>
            <div>
              <p className="font-semibold text-white">AI Roadmap Generation Notice</p>
              <p className="text-amber-200/90 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleGenerateRoadmap()}
            className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-dark-bg font-bold text-xs shrink-0 shadow-sm transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* Output Content */}
      {result && result.roadmap && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Roadmap Header Summary Card */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs text-brand-400 font-bold">
                <Target className="w-3.5 h-3.5" />
                <span>Curriculum Roadmap</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {result.roadmap.title}
              </h2>
              <p className="text-xs text-slate-300 max-w-xl">
                {result.roadmap.goal}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-right">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Estimated Duration</div>
                <div className="text-sm font-bold text-white">{result.roadmap.estimatedDuration || '8 weeks'}</div>
              </div>

              <button
                onClick={() => handleGenerateRoadmap()}
                disabled={loading}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-1.5"
                title="Regenerate Roadmap with alternative progression"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Regenerate</span>
              </button>
            </div>
          </div>

          {/* Step-by-Step Interactive Stages */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-accent-400" />
                <h3 className="text-base font-bold text-white">Curriculum Stages ({result.roadmap.stages?.length || 0})</h3>
              </div>
              <span className="text-xs text-slate-400">Click a module to view learning tasks &amp; find verified mentors</span>
            </div>

            <div className="space-y-3">
              {result.roadmap.stages?.map((stage: any, idx: number) => {
                const isOpen = activeStageIndex === idx;
                return (
                  <div 
                    key={stage.order || idx}
                    className={`glass-panel rounded-2xl border transition-all overflow-hidden ${
                      isOpen ? 'border-brand-500/50 bg-slate-900/90' : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    }`}
                  >
                    {/* Stage Title Header Bar */}
                    <div 
                      onClick={() => setActiveStageIndex(isOpen ? null : idx)}
                      className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isOpen ? 'bg-brand-500 text-dark-bg' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {stage.order || idx + 1}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm sm:text-base">{stage.title}</h4>
                          <p className="text-xs text-slate-400 line-clamp-1">{stage.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-slate-400 hidden sm:inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>~{stage.estimatedHours || 5} hours</span>
                        </span>

                        <Link
                          href={`/explore?q=${encodeURIComponent(stage.skillQuery || stage.title.split(' ')[0])}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 rounded-lg bg-brand-500/20 hover:bg-brand-500 text-brand-300 hover:text-dark-bg font-bold text-xs border border-brand-500/30 transition-colors flex items-center gap-1"
                        >
                          <Search className="w-3 h-3" />
                          <span>Find Mentor</span>
                        </Link>
                      </div>
                    </div>

                    {/* Stage Expanded Details */}
                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 border-t border-slate-800/80 space-y-4 text-xs animate-in fade-in duration-200">
                        <p className="text-slate-300 leading-relaxed">{stage.description}</p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                          
                          {/* Objectives */}
                          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                            <div className="font-semibold text-brand-400 text-xs flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Learning Objectives</span>
                            </div>
                            <ul className="space-y-1.5 text-slate-300">
                              {(stage.objectives || []).map((obj: string, oIdx: number) => (
                                <li key={oIdx} className="flex items-start gap-1.5 text-[11px]">
                                  <span className="text-brand-400 font-bold">•</span>
                                  <span>{obj}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Practice Tasks */}
                          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                            <div className="font-semibold text-sky-400 text-xs flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Practice Tasks</span>
                            </div>
                            <ul className="space-y-1.5 text-slate-300">
                              {(stage.practiceTasks || []).map((task: string, tIdx: number) => (
                                <li key={tIdx} className="flex items-start gap-1.5 text-[11px]">
                                  <span className="text-sky-400 font-bold">•</span>
                                  <span>{task}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Completion Criteria */}
                          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                            <div className="font-semibold text-amber-400 text-xs flex items-center gap-1.5">
                              <Target className="w-3.5 h-3.5" />
                              <span>Completion Criteria</span>
                            </div>
                            <ul className="space-y-1.5 text-slate-300">
                              {(stage.completionCriteria || []).map((crit: string, cIdx: number) => (
                                <li key={cIdx} className="flex items-start gap-1.5 text-[11px]">
                                  <span className="text-amber-400 font-bold">•</span>
                                  <span>{crit}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommended Campus Mentors for Topic */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-400" />
                <h3 className="text-base font-bold text-white">Recommended Mentors for this Curriculum</h3>
              </div>
              <Link 
                href={`/explore?q=${encodeURIComponent(topic.split(' ')[0])}`}
                className="text-xs text-brand-400 hover:underline font-semibold flex items-center gap-1"
              >
                <span>View all mentors</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {(!result.recommendedMentors || result.recommendedMentors.length === 0) ? (
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 text-center text-xs text-slate-400">
                No active mentors currently listed for this specific search. You can create an open Learner Request to be notified when a mentor joins.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.recommendedMentors.map((mentor: any) => (
                  <div key={mentor.userId} className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4 hover:border-brand-500/40 transition-colors">
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-500 to-accent-600 flex items-center justify-center text-dark-bg font-extrabold text-xs">
                            {mentor.displayName?.substring(0, 2).toUpperCase() || 'M'}
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-xs">{mentor.displayName}</h4>
                            <p className="text-[10px] text-slate-400">{mentor.college || 'Stanford'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                          <Star className="w-3 h-3 fill-amber-400" />
                          <span>{mentor.bayesianRating?.toFixed(1) || '4.8'}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white text-xs">{mentor.skillName}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold">
                            {mentor.proficiency}
                          </span>
                        </div>
                        {mentor.verificationStatus === 'PLATFORM_VERIFIED' ? (
                          <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Platform Verified
                          </div>
                        ) : mentor.verificationStatus === 'ASSESSMENT_VERIFIED' ? (
                          <div className="text-[10px] text-sky-400 font-semibold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Assessment Verified
                          </div>
                        ) : (
                          <div className="text-[10px] text-amber-400 font-semibold">
                            Self-Declared
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400">{mentor.totalSessionsTaught || 0} sessions</span>
                      <Link
                        href={`/explore?q=${encodeURIComponent(mentor.displayName)}`}
                        className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs transition-colors flex items-center gap-1"
                      >
                        <span>Book</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
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
