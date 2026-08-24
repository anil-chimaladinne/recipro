'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth, UserProfile } from '@/context/AuthContext';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Award, 
  ShieldCheck, 
  BookOpen, 
  Target, 
  Calendar,
  X,
  Coins,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Link as LinkIcon,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import MyLearningRequests from '@/components/MyLearningRequests';
import { getSkillStatusDisplay } from '@/lib/skill-display';

export default function ProfilePage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<'SKILLS' | 'GOALS' | 'REQUESTS' | 'AVAILABILITY' | 'PREFERENCES'>('SKILLS');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'requests') {
      setActiveTab('REQUESTS');
    }
  }, [searchParams]);

  // AI Extraction State
  const [extractModalOpen, setExtractModalOpen] = useState(false);
  const [extractText, setExtractText] = useState('I built three React websites, a Node.js backend with Express, and worked with MongoDB and REST APIs. I also have 2 years of Python scripting experience for data analysis.');
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractedSkills, setExtractedSkills] = useState<any[]>([]);

  // Manual Add Skill State with Teaching Availability & Preferences
  const [addSkillModalOpen, setAddSkillModalOpen] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newCategory, setNewCategory] = useState('Computer Science');
  const [newProficiency, setNewProficiency] = useState('Intermediate');
  const [newExp, setNewExp] = useState(1);
  const [newStyle, setNewStyle] = useState('Hands-on project reviews & coding sessions');
  const [newTeachingDays, setNewTeachingDays] = useState<string[]>(['Monday', 'Wednesday', 'Friday']);
  const [newAvailStart, setNewAvailStart] = useState('17:00');
  const [newAvailEnd, setNewAvailEnd] = useState('20:00');
  const [newPrefStart, setNewPrefStart] = useState('18:00');
  const [newPrefEnd, setNewPrefEnd] = useState('20:00');
  const [newDuration, setNewDuration] = useState(60);
  const [newFlexibility, setNewFlexibility] = useState(true);
  const [newSkillPref, setNewSkillPref] = useState('Anyone');
  const [newTimezone, setNewTimezone] = useState('Asia/Kolkata');

  // Manual Add Goal State with Learning Availability & Preferences
  const [addGoalModalOpen, setAddGoalModalOpen] = useState(false);
  const [goalSkillName, setGoalSkillName] = useState('');
  const [goalCategory, setGoalCategory] = useState('Computer Science');
  const [goalTarget, setGoalTarget] = useState('Intermediate');
  const [goalPriority, setGoalPriority] = useState('HIGH');
  const [goalNotes, setGoalNotes] = useState('');
  const [goalLearningDays, setGoalLearningDays] = useState<string[]>(['Tuesday', 'Thursday', 'Saturday']);
  const [goalAvailStart, setGoalAvailStart] = useState('18:00');
  const [goalAvailEnd, setGoalAvailEnd] = useState('21:00');
  const [goalPrefStart, setGoalPrefStart] = useState('19:00');
  const [goalPrefEnd, setGoalPrefEnd] = useState('21:00');
  const [goalDuration, setGoalDuration] = useState(60);
  const [goalFlexibility, setGoalFlexibility] = useState(true);

  // Availability State with Multi-Window & Preference
  const [availSlots, setAvailSlots] = useState<any[]>([]);
  const [newDay, setNewDay] = useState('Monday');
  const [newStart, setNewStart] = useState('18:00');
  const [newEnd, setNewEnd] = useState('20:00');
  const [newIsPreferred, setNewIsPreferred] = useState(false);
  const [newWindowLabel, setNewWindowLabel] = useState('General');

  // Assessment Quiz Modal State
  const [assessmentModalOpen, setAssessmentModalOpen] = useState(false);
  const [assessmentSkill, setAssessmentSkill] = useState<any | null>(null);
  const [assessmentQuestions, setAssessmentQuestions] = useState<any[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<any | null>(null);

  // Evidence Modal State
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [evidenceSkill, setEvidenceSkill] = useState<any | null>(null);
  const [evidenceType, setEvidenceType] = useState<string>('PORTFOLIO_LINK');
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceDesc, setEvidenceDesc] = useState('');
  const [evidenceSubmitting, setEvidenceSubmitting] = useState(false);

  // Teaching Preferences State
  const [teachingPref, setTeachingPref] = useState<string>('Anyone');
  const [userType, setUserType] = useState<string>('TEACHER_LEARNER');
  const [dailyLimit, setDailyLimit] = useState<number>(3);
  const [prefSaving, setPrefSaving] = useState(false);

  // Checklist dropdown state
  const [checklistExpanded, setChecklistExpanded] = useState(false);

  useEffect(() => {
    fetchAvailability();
    if (user) {
      setTeachingPref(user.teaching_preference || 'Anyone');
      setUserType(user.user_type || 'TEACHER_LEARNER');
      setDailyLimit(user.daily_session_limit || 3);
    }
  }, [user]);

  const fetchAvailability = async () => {
    try {
      const res = await fetch('/api/availability');
      if (res.ok) {
        const data = await res.json();
        setAvailSlots(data.slots || []);
      }
    } catch (err) {
      console.error('Failed to fetch availability:', err);
    }
  };

  // Run AI Skill Extractor
  const handleAnalyzeSkills = async () => {
    setExtractLoading(true);
    try {
      const res = await fetch('/api/skills/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freeText: extractText }),
      });
      if (res.ok) {
        const data = await res.json();
        setExtractedSkills(data.skills || []);
      }
    } catch (err) {
      console.error('Skill extraction error:', err);
    } finally {
      setExtractLoading(false);
    }
  };

  // Add individual extracted skill to profile
  const handleAcceptExtractedSkill = async (skill: any) => {
    try {
      await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillName: skill.skillName,
          category: skill.category,
          proficiency: skill.proficiency,
          experienceYears: 1,
          teachingStyle: 'Hands-on practice & examples',
          verificationStatus: 'SELF_DECLARED',
        }),
      });
      await refreshUser();
      setExtractedSkills(prev => prev.filter(s => s.skillName !== skill.skillName));
    } catch (err) {
      console.error('Failed to save skill:', err);
    }
  };

  // Manual Add Skill with Teaching Availability & Preferences
  const handleAddManualSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillName: newSkillName,
          category: newCategory,
          proficiency: newProficiency,
          experienceYears: Number(newExp),
          teachingStyle: newStyle,
          teachingDays: newTeachingDays,
          availableStartTime: newAvailStart,
          availableEndTime: newAvailEnd,
          preferredStartTime: newPrefStart,
          preferredEndTime: newPrefEnd,
          sessionDurationMinutes: Number(newDuration),
          timezone: newTimezone,
          isFlexible: newFlexibility,
          teachingPreference: newSkillPref,
          verificationStatus: 'SELF_DECLARED',
        }),
      });
      setAddSkillModalOpen(false);
      setNewSkillName('');
      await refreshUser();
    } catch (err) {
      console.error('Failed to add skill:', err);
    }
  };

  // Manual Add Goal with Learning Availability & Preferences
  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillName: goalSkillName,
          category: goalCategory,
          targetProficiency: goalTarget,
          priority: goalPriority,
          notes: goalNotes,
          learningDays: goalLearningDays,
          availableStartTime: goalAvailStart,
          availableEndTime: goalAvailEnd,
          preferredStartTime: goalPrefStart,
          preferredEndTime: goalPrefEnd,
          sessionDurationMinutes: Number(goalDuration),
          isFlexible: goalFlexibility,
        }),
      });
      setAddGoalModalOpen(false);
      setGoalSkillName('');
      setGoalNotes('');
      await refreshUser();
    } catch (err) {
      console.error('Failed to add goal:', err);
    }
  };

  // Add Availability Slot with Multi-Window & Preferred Flags
  const handleAddSlot = async () => {
    const newSlot = {
      dayOfWeek: newDay,
      startTime: newStart,
      endTime: newEnd,
      isPreferred: newIsPreferred,
      windowLabel: newWindowLabel,
    };
    const updated = [...availSlots, newSlot];
    setAvailSlots(updated);
    await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: updated }),
    });
  };

  const handleRemoveSlot = async (idx: number) => {
    const updated = availSlots.filter((_, i) => i !== idx);
    setAvailSlots(updated);
    await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: updated }),
    });
  };

  // Start Assessment Quiz
  const handleOpenAssessment = async (skill: any) => {
    setAssessmentSkill(skill);
    setAssessmentResult(null);
    setSelectedAnswers({});
    setAssessmentLoading(true);
    setAssessmentModalOpen(true);

    const skillName = skill.skill_name || skill.name || 'Python';
    const proficiency = skill.proficiency || 'Intermediate';

    try {
      const res = await fetch(`/api/skill-assessments?skillName=${encodeURIComponent(skillName)}&proficiency=${encodeURIComponent(proficiency)}`);
      if (res.ok) {
        const data = await res.json();
        setAssessmentQuestions(data.questions || []);
      }
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setAssessmentLoading(false);
    }
  };

  // Submit Assessment Answers
  const handleSubmitAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentSkill) return;

    setAssessmentLoading(true);
    try {
      const answersArray = Object.entries(selectedAnswers).map(([qId, ansIdx]) => ({
        questionId: qId,
        selectedOption: ansIdx,
      }));

      const res = await fetch('/api/skill-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId: assessmentSkill.skill_id || assessmentSkill.id,
          targetLevel: assessmentSkill.proficiency || 'Intermediate',
          answers: answersArray,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAssessmentResult(data.result || data);
        await refreshUser();
      } else {
        const errMsg = typeof data.error === 'object' ? data.error.message : data.error;
        alert(errMsg || 'Assessment evaluation failed');
      }
    } catch (err) {
      console.error('Assessment submit error:', err);
    } finally {
      setAssessmentLoading(false);
    }
  };

  // Save Teaching Preferences
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrefSaving(true);
    try {
      await fetch('/api/profiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teachingPreference: teachingPref,
          userType: userType,
          dailySessionLimit: Number(dailyLimit),
        }),
      });
      await refreshUser();
      alert('Teaching preferences updated successfully!');
    } catch (err) {
      console.error('Preferences save error:', err);
    } finally {
      setPrefSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center mx-auto text-2xl font-bold border border-brand-500/30">
          🎓
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Student Profile Access</h2>
          <p className="text-xs text-slate-400">
            Please log in with your campus account to view your verified skills, manage availability, and access your learning dashboard.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <Link 
            href="/login" 
            className="px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand transition-colors flex items-center gap-2"
          >
            <span>Log In to Your Profile</span>
          </Link>
        </div>
      </div>
    );
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const completionPercentage = user.profileCompletion?.percentage || 75;

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      
      {/* Student Profile Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 relative overflow-hidden shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-500 to-accent-600 flex items-center justify-center text-dark-bg font-extrabold text-2xl shadow-glow-brand">
              {user.display_name?.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold font-display text-white">{user.display_name}</h1>
                {user.is_verified_student && (
                  <span className="flex items-center gap-1 text-xs text-brand-400 bg-brand-500/10 px-2.5 py-0.5 rounded-full border border-brand-500/30 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified Student
                  </span>
                )}
                <span className="text-xs px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  {user.user_type === 'TEACHER' ? 'Teacher' : user.user_type === 'LEARNER' ? 'Learner' : 'Teacher & Learner'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {user.campusId || 'STU-102948'}
                </span>
                
                {user.user_type !== 'TEACHER_LEARNER' && user.role !== 'ADMIN' && user.role !== 'MODERATOR' && (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/auth/upgrade', { method: 'POST' });
                        if (res.ok) {
                          await refreshUser();
                          alert('Account successfully upgraded to Mentor + Student! You can now both teach and learn.');
                        }
                      } catch (err) {
                        console.error('Upgrade error:', err);
                      }
                    }}
                    className="text-xs px-3 py-1 rounded-full bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold shadow-sm transition-all flex items-center gap-1"
                  >
                    <span>Upgrade to Mentor + Student</span>
                    <Sparkles className="w-3 h-3" />
                  </button>
                )}
              </div>

              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {user.college} • {user.major} ({user.year})
              </p>
              <p className="text-xs text-slate-300 mt-2 max-w-2xl">{user.bio || 'Campus peer learner & mentor.'}</p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 self-stretch sm:self-auto justify-around sm:justify-end bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
            <div className="text-center px-2">
              <div className="text-xs text-slate-400">Trust Score</div>
              <div className="text-base font-bold text-brand-400">{user.trust_score}%</div>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div className="text-center px-2">
              <div className="text-xs text-slate-400">Completion</div>
              <div className="text-base font-bold text-white">{user.completion_rate}%</div>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div className="text-center px-2">
              <div className="text-xs text-slate-400">Balance</div>
              <div className="text-base font-bold text-accent-400">{user.balance} Credits</div>
            </div>
          </div>

        </div>

        {/* Profile Completion Indicator */}
        <div className="pt-4 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">Profile {completionPercentage}% Complete</span>
              <button 
                onClick={() => setChecklistExpanded(!checklistExpanded)}
                className="text-slate-400 hover:text-brand-400 flex items-center gap-0.5 text-[11px]"
              >
                {checklistExpanded ? 'Hide Checklist' : 'View Checklist'} 
                {checklistExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
            <span className="text-slate-400 text-[11px]">Keep your teaching skills verified for top discovery rank</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-brand-500 to-accent-500 rounded-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>

          {/* Dropdown Checklist */}
          {checklistExpanded && user.profileCompletion?.checklist && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2 bg-slate-900/60 p-3 rounded-2xl border border-slate-800 text-xs animate-in fade-in duration-200">
              {user.profileCompletion.checklist.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 text-slate-300">
                  <span className={item.completed ? 'text-brand-400 font-bold' : 'text-slate-600'}>
                    {item.completed ? '✓' : '○'}
                  </span>
                  <span className={item.completed ? 'text-slate-200' : 'text-slate-500'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('SKILLS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'SKILLS' ? 'bg-brand-500 text-dark-bg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Skills I Can Teach ({user.skills?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('GOALS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'GOALS' ? 'bg-accent-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Target className="w-4 h-4" /> Skills I Want to Learn ({user.goals?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('REQUESTS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'REQUESTS' ? 'bg-amber-500 text-dark-bg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" /> My Learning Requests
          </button>
          <button
            onClick={() => setActiveTab('AVAILABILITY')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'AVAILABILITY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" /> Availability ({availSlots.length} slots)
          </button>
          <button
            onClick={() => setActiveTab('PREFERENCES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'PREFERENCES' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Teaching Preferences
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: TEACHING SKILLS & PER-SKILL VERIFICATION CARDS */}
        {/* ============================================================ */}
        {activeTab === 'SKILLS' && (
          <div className="space-y-6">
            
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">Skills You Teach</h2>
                <p className="text-xs text-slate-400">Individual skill-specific verification ensures high quality peer learning.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExtractModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-accent-600 to-indigo-600 hover:from-accent-500 hover:to-indigo-500 text-white font-bold text-xs shadow-glow-accent transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" /> Analyze My Skills (AI)
                </button>
                <button
                  onClick={() => setAddSkillModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Skill
                </button>
              </div>
            </div>

            {/* Teaching Skills Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {user.skills?.map((skill: any) => {
                const statusInfo = getSkillStatusDisplay(skill.verification_status);
                const isVerified = skill.verification_status === 'PLATFORM_VERIFIED' || skill.verification_status === 'ASSESSMENT_VERIFIED';

                return (
                  <div key={skill.id} className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-white text-sm">{skill.skill_name}</h3>
                          <p className="text-[11px] text-slate-400">{skill.skill_category}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold border border-brand-500/30">
                          {skill.proficiency}
                        </span>
                      </div>

                      {/* Verification Status Badge */}
                      <div className="mt-2.5 flex items-center justify-between">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold flex items-center gap-1 ${statusInfo.badgeColor}`}>
                          <span>{statusInfo.icon}</span> {statusInfo.label}
                        </span>
                        {skill.assessment_score && (
                          <span className="text-[10px] text-slate-400 font-medium">Score: {skill.assessment_score}%</span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 italic pt-2">&ldquo;{skill.teaching_style}&rdquo;</p>
                      
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{skill.experience_years} yrs exp</span>
                        <span className="text-brand-400 font-medium">1 Credit / hr</span>
                      </div>
                    </div>

                    {/* Skill Actions */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      {!isVerified ? (
                        <button
                          onClick={() => handleOpenAssessment(skill)}
                          className="w-full py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-dark-bg font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-sm"
                        >
                          <FileCheck className="w-3.5 h-3.5" /> Take Skill Assessment
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenAssessment(skill)}
                          className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors"
                        >
                          Retake Assessment
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: LEARNING GOALS */}
        {/* ============================================================ */}
        {activeTab === 'GOALS' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Learning Goals</h2>
                <p className="text-xs text-slate-400">Used by the ML engine to recommend matching mentors &amp; barter cycles.</p>
              </div>
              <button
                onClick={() => setAddGoalModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-accent-500 hover:bg-accent-400 text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Learning Goal
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {user.goals?.map((goal: any) => (
                <div key={goal.id} className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-white text-sm">{goal.skill_name}</h3>
                      <p className="text-[11px] text-slate-400">{goal.skill_category}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-accent-500/20 text-accent-300 font-bold">
                      Target: {goal.target_proficiency}
                    </span>
                  </div>
                  {goal.notes && <p className="text-xs text-slate-300 pt-1">{goal.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2B: MY LEARNING REQUESTS & DEMAND ACTIVITY */}
        {/* ============================================================ */}
        {activeTab === 'REQUESTS' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">My Learning Requests</h2>
                <p className="text-xs text-slate-400">Track unfulfilled skill demand, mentor matches, and automated availability notifications.</p>
              </div>
              <button
                onClick={() => router.push('/explore')}
                className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand transition-colors"
              >
                + New Request
              </button>
            </div>
            <MyLearningRequests />
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: AVAILABILITY MATRIX & MULTIPLE WINDOWS */}
        {/* ============================================================ */}
        {activeTab === 'AVAILABILITY' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-white">Weekly Availability Schedule &amp; Windows</h2>
              <p className="text-xs text-slate-400">Configure your available times and preferred study jam windows for automated slot finding.</p>
            </div>

            {/* Add Slot Control */}
            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={newDay}
                  onChange={(e) => setNewDay(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2"
                >
                  {days.map(d => <option key={d} value={d}>{d}</option>)}
                </select>

                <input
                  type="time"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2"
                />
                <span className="text-slate-500 text-xs">to</span>
                <input
                  type="time"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2"
                />

                <select
                  value={newWindowLabel}
                  onChange={(e) => setNewWindowLabel(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2"
                >
                  <option value="General">General Window</option>
                  <option value="Morning">Morning Window (10 AM - 1 PM)</option>
                  <option value="Afternoon">Afternoon Window (2 PM - 5 PM)</option>
                  <option value="Evening">Evening Window (6 PM - 9 PM)</option>
                  <option value="Night Study">Night Study Jam (9 PM - 11 PM)</option>
                </select>

                <label className="flex items-center gap-1.5 text-xs text-brand-300 cursor-pointer select-none bg-brand-500/10 border border-brand-500/20 px-3 py-2 rounded-xl">
                  <input
                    type="checkbox"
                    checked={newIsPreferred}
                    onChange={(e) => setNewIsPreferred(e.target.checked)}
                    className="rounded text-brand-500 focus:ring-0"
                  />
                  <span>⭐ Preferred Time</span>
                </label>

                <button
                  onClick={handleAddSlot}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs transition-colors flex items-center gap-1 shadow-glow-brand"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Time Window
                </button>
              </div>
            </div>

            {/* List Slots */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {availSlots.map((slot, idx) => (
                <div key={idx} className={`glass-panel p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                  slot.isPreferred || slot.is_preferred ? 'border-brand-500/40 bg-brand-950/20' : 'border-slate-800'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <Clock className={`w-4 h-4 ${slot.isPreferred || slot.is_preferred ? 'text-brand-400' : 'text-slate-400'}`} />
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-white">
                        <span>{slot.dayOfWeek || slot.day_of_week}</span>
                        {(slot.isPreferred || slot.is_preferred) && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">Preferred</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {slot.startTime || slot.start_time} - {slot.endTime || slot.end_time}
                        {(slot.windowLabel || slot.window_label) && ` • ${slot.windowLabel || slot.window_label}`}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleRemoveSlot(idx)} className="text-slate-500 hover:text-rose-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: TEACHING PREFERENCES & USER TYPE */}
        {/* ============================================================ */}
        {activeTab === 'PREFERENCES' && (
          <form onSubmit={handleSavePreferences} className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6 max-w-2xl">
            <div>
              <h2 className="text-base font-bold text-white">Teaching Preferences &amp; Participation Role</h2>
              <p className="text-xs text-slate-400">Configure how you participate on SkillSwap Campus.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Participation Role
                </label>
                <select
                  value={userType}
                  onChange={(e) => setUserType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5"
                >
                  <option value="TEACHER_LEARNER">Teacher &amp; Learner (Teach skills and learn from others)</option>
                  <option value="TEACHER">Teacher Only (Offer sessions and earn credits)</option>
                  <option value="LEARNER">Learner Only (Request sessions and spend credits)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Who do you prefer to teach?
                </label>
                <select
                  value={teachingPref}
                  onChange={(e) => setTeachingPref(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5"
                >
                  <option value="Anyone">Anyone (Default)</option>
                  <option value="Women">Women</option>
                  <option value="Men">Men</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">This preference is saved in your teaching settings and does not override anti-discrimination rules.</p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Maximum Teaching Sessions Per Day
                </label>
                <input 
                  type="number"
                  min={1}
                  max={8}
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2"
                />
                <p className="text-[11px] text-slate-400 mt-1">Protects your schedule so you are not overbooked on study days.</p>
              </div>

              <button
                type="submit"
                disabled={prefSaving}
                className="py-2.5 px-5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand transition-colors"
              >
                {prefSaving ? 'Saving Preferences...' : 'Save Teaching Preferences'}
              </button>
            </div>
          </form>
        )}

      </div>

      {/* ============================================================ */}
      {/* MODAL: SKILL ASSESSMENT QUIZ */}
      {/* ============================================================ */}
      {assessmentModalOpen && assessmentSkill && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl rounded-3xl border border-slate-700 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            
            <button 
              onClick={() => setAssessmentModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Skill Assessment: {assessmentSkill.skill_name}
                </h3>
                <p className="text-xs text-slate-400">
                  Target Proficiency: {assessmentSkill.proficiency} • Real automated verification
                </p>
              </div>
            </div>

            {assessmentLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <div className="w-8 h-8 border-3 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading questions from skill verification engine...
              </div>
            ) : assessmentResult ? (
              <div className="space-y-4 py-4 text-center">
                <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-xl font-extrabold ${
                  assessmentResult.passed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}>
                  {assessmentResult.percentage}%
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white">
                    {assessmentResult.passed ? 'Assessment Passed!' : 'Reassessment Required'}
                  </h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    {assessmentResult.feedback}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs inline-flex items-center gap-3">
                  <span>Verified Level: <strong className="text-white">{assessmentResult.verifiedLevel}</strong></span>
                  <span className="text-slate-500">|</span>
                  <span>Status: <strong className="text-sky-400">{assessmentResult.verificationStatus}</strong></span>
                </div>

                <div className="pt-3">
                  <button
                    onClick={() => setAssessmentModalOpen(false)}
                    className="px-5 py-2 rounded-xl bg-brand-500 text-dark-bg font-bold text-xs"
                  >
                    Done &amp; Update Profile
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitAssessment} className="space-y-5">
                <div className="space-y-4">
                  {assessmentQuestions.map((q, qIdx) => (
                    <div key={q.id} className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-white leading-snug">
                          {qIdx + 1}. {q.question}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {q.level}
                        </span>
                      </div>

                      {q.codeSnippet && (
                        <pre className="p-2.5 rounded-xl bg-black/60 border border-slate-800 text-[11px] text-slate-200 font-mono overflow-x-auto">
                          {q.codeSnippet}
                        </pre>
                      )}

                      <div className="space-y-1.5 pt-1">
                        {q.options.map((opt: any, optIdx: number) => {
                          const optText = typeof opt === 'string' ? opt : opt.text;
                          const optVal = typeof opt === 'string' ? optIdx : (opt.id || optIdx);
                          const isSelected = selectedAnswers[q.id] === optVal;
                          return (
                            <label
                              key={optIdx}
                              className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-sky-500/20 border-sky-500 text-white'
                                  : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <input 
                                type="radio"
                                name={q.id}
                                checked={isSelected}
                                onChange={() => setSelectedAnswers(prev => ({ ...prev, [q.id]: optVal }))}
                                className="text-sky-500 focus:ring-0"
                              />
                              <span className="font-semibold text-sky-400 min-w-[16px]">
                                {typeof opt === 'object' && opt.id ? `${opt.id}.` : ''}
                              </span>
                              <span>{optText}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setAssessmentModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={Object.keys(selectedAnswers).length < assessmentQuestions.length}
                    className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-dark-bg font-bold text-xs shadow-glow-brand transition-all disabled:opacity-50"
                  >
                    Submit Assessment for Verification
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: MANUAL ADD SKILL WITH TEACHING AVAILABILITY */}
      {/* ============================================================ */}
      {addSkillModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddManualSkill} className="glass-panel w-full max-w-lg rounded-3xl border border-slate-700 shadow-2xl p-6 relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setAddSkillModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-white">Add Teaching Skill &amp; Schedule</h3>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Skill Name</label>
              <input 
                type="text"
                required
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                placeholder="E.g., Python, PyTorch, Rust, Solidity..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2">
                  <option value="Computer Science">Computer Science</option>
                  <option value="Design">Design</option>
                  <option value="Languages">Languages</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Business">Business</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Proficiency</label>
                <select value={newProficiency} onChange={(e) => setNewProficiency(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2">
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>
            </div>

            {/* Teaching Days Selection */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Teaching Days
              </label>
              <div className="flex flex-wrap gap-1.5">
                {days.map((d) => {
                  const isSelected = newTeachingDays.includes(d);
                  return (
                    <button
                      type="button"
                      key={d}
                      onClick={() => {
                        if (isSelected) {
                          setNewTeachingDays(newTeachingDays.filter(day => day !== d));
                        } else {
                          setNewTeachingDays([...newTeachingDays, d]);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        isSelected 
                          ? 'bg-brand-500 text-dark-bg' 
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {d.substring(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Available Time Range */}
            <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 text-xs">
              <div>
                <span className="text-[11px] font-bold text-white block mb-1">1. Available Time Range (I CAN teach)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={newAvailStart}
                    onChange={(e) => setNewAvailStart(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-3 py-1.5"
                  />
                  <span className="text-slate-500">→</span>
                  <input
                    type="time"
                    value={newAvailEnd}
                    onChange={(e) => setNewAvailEnd(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-3 py-1.5"
                  />
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-brand-300 block mb-1">2. Preferred Time (I PREFER this period)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={newPrefStart}
                    onChange={(e) => setNewPrefStart(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-3 py-1.5"
                  />
                  <span className="text-slate-500">→</span>
                  <input
                    type="time"
                    value={newPrefEnd}
                    onChange={(e) => setNewPrefEnd(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-3 py-1.5"
                  />
                </div>
              </div>
            </div>

            {/* Session Duration & Flexibility & Teaching Preference */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Duration</label>
                <select
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5"
                >
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                  <option value={120}>120 min</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Flexibility</label>
                <select
                  value={newFlexibility ? 'FLEXIBLE' : 'EXACT'}
                  onChange={(e) => setNewFlexibility(e.target.value === 'FLEXIBLE')}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5"
                >
                  <option value="FLEXIBLE">Flexible</option>
                  <option value="EXACT">Exact</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Who to Teach</label>
                <select
                  value={newSkillPref}
                  onChange={(e) => setNewSkillPref(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5"
                >
                  <option value="Anyone">Anyone</option>
                  <option value="Women">Women</option>
                  <option value="Men">Men</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Teaching Style</label>
              <input 
                type="text"
                value={newStyle}
                onChange={(e) => setNewStyle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <p className="text-[11px] text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
              Note: The skill will appear immediately on your profile marked as 🟠 Verification Pending until you take the quick skill assessment.
            </p>

            <button type="submit" className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs transition-colors shadow-glow-brand">
              Save Skill &amp; Teaching Schedule
            </button>
          </form>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: MANUAL ADD GOAL WITH LEARNING AVAILABILITY */}
      {/* ============================================================ */}
      {addGoalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddGoal} className="glass-panel w-full max-w-lg rounded-3xl border border-slate-700 shadow-2xl p-6 relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setAddGoalModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-white">Add Learning Goal &amp; Availability</h3>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Skill You Want to Learn</label>
              <input 
                type="text"
                required
                value={goalSkillName}
                onChange={(e) => setGoalSkillName(e.target.value)}
                placeholder="E.g., Solidity, Data Structures, Spanish, PyTorch..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Target Level</label>
                <select value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2">
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
                <select value={goalPriority} onChange={(e) => setGoalPriority(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2">
                  <option value="HIGH">High Priority</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>

            {/* Preferred Learning Days */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Preferred Learning Days
              </label>
              <div className="flex flex-wrap gap-1.5">
                {days.map((d) => {
                  const isSelected = goalLearningDays.includes(d);
                  return (
                    <button
                      type="button"
                      key={d}
                      onClick={() => {
                        if (isSelected) {
                          setGoalLearningDays(goalLearningDays.filter(day => day !== d));
                        } else {
                          setGoalLearningDays([...goalLearningDays, d]);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        isSelected 
                          ? 'bg-accent-500 text-white' 
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {d.substring(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Learning Available & Preferred Time Range */}
            <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 text-xs">
              <div>
                <span className="text-[11px] font-bold text-white block mb-1">1. Available Time Range (I CAN learn)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={goalAvailStart}
                    onChange={(e) => setGoalAvailStart(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-3 py-1.5"
                  />
                  <span className="text-slate-500">→</span>
                  <input
                    type="time"
                    value={goalAvailEnd}
                    onChange={(e) => setGoalAvailEnd(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-3 py-1.5"
                  />
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-accent-300 block mb-1">2. Preferred Time (I PREFER this period)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={goalPrefStart}
                    onChange={(e) => setGoalPrefStart(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-3 py-1.5"
                  />
                  <span className="text-slate-500">→</span>
                  <input
                    type="time"
                    value={goalPrefEnd}
                    onChange={(e) => setGoalPrefEnd(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-3 py-1.5"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Learning Goal Notes</label>
              <textarea 
                value={goalNotes}
                onChange={(e) => setGoalNotes(e.target.value)}
                rows={2}
                placeholder="E.g., Build smart contracts, prep for technical interview..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-accent-500"
              />
            </div>

            <button type="submit" className="w-full py-2.5 rounded-xl bg-accent-500 hover:bg-accent-400 text-white font-bold text-xs transition-colors shadow-glow-accent">
              Save Learning Goal &amp; Schedule
            </button>
          </form>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: AI SKILL EXTRACTOR */}
      {/* ============================================================ */}
      {extractModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl rounded-3xl border border-slate-700 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            
            <button 
              onClick={() => setExtractModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-accent-500 to-indigo-600 flex items-center justify-center text-white shadow-glow-accent">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">AI Skill Analyzer</h3>
                <p className="text-xs text-slate-400">Extract skills from your project descriptions, bio, or resume text</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Experience / Projects Text
                </label>
                <textarea 
                  value={extractText}
                  onChange={(e) => setExtractText(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-brand-500"
                  placeholder="Describe projects you built, languages used, frameworks, courses completed..."
                />
              </div>

              <button
                onClick={handleAnalyzeSkills}
                disabled={extractLoading || !extractText.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-accent-600 to-indigo-600 hover:from-accent-500 hover:to-indigo-500 text-white font-bold text-xs shadow-glow-accent transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {extractLoading ? 'Analyzing Text with NLP & Gemini...' : 'Analyze & Extract Skills'}
              </button>

              {/* Extracted Skills Preview & Confirmation */}
              {extractedSkills.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-brand-300 uppercase tracking-wider">
                      Extracted Candidate Skills ({extractedSkills.length})
                    </h4>
                    <span className="text-[10px] text-slate-400">Review &amp; click accept to add to your profile</span>
                  </div>

                  <div className="space-y-2.5">
                    {extractedSkills.map((sk, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{sk.skillName}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-semibold">
                              {sk.proficiency} ({sk.confidence}%)
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{sk.evidence}</p>
                        </div>

                        <button
                          onClick={() => handleAcceptExtractedSkill(sk)}
                          className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs transition-colors flex items-center gap-1 shadow-sm whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" /> Accept Skill
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
