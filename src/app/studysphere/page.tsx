'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  Layers, 
  Users, 
  FileText, 
  BookOpen, 
  Plus, 
  ThumbsUp, 
  CheckCircle2, 
  ExternalLink, 
  RotateCw, 
  Sparkles,
  X
} from 'lucide-react';

export default function StudySpherePage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'GROUPS' | 'RESOURCES' | 'FLASHCARDS'>('GROUPS');
  const [studyGroups, setStudyGroups] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [decks, setDecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Flashcard player state
  const [activeDeck, setActiveDeck] = useState<any | null>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Create Group Modal State
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupSubject, setGroupSubject] = useState('Computer Science');
  const [groupSchedule, setGroupSchedule] = useState('Thursdays 6:00 PM');

  const fetchData = async () => {
    try {
      const res = await fetch('/api/studysphere');
      if (res.ok) {
        const data = await res.json();
        setStudyGroups(data.studyGroups || []);
        setResources(data.resources || []);
        setDecks(data.flashcardDecks || []);
      }
    } catch (err) {
      console.error('StudySphere fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleJoinGroup = async (groupId: string) => {
    try {
      const res = await fetch('/api/studysphere', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'JOIN_GROUP', groupId }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Join group error:', err);
    }
  };

  const handleUpvoteResource = async (resourceId: string) => {
    try {
      const res = await fetch('/api/studysphere', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPVOTE_RESOURCE', resourceId }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Upvote error:', err);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/studysphere', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_GROUP',
          name: groupName,
          description: groupDesc,
          subject: groupSubject,
          meetingSchedule: groupSchedule,
          maxMembers: 10,
        }),
      });
      if (res.ok) {
        setCreateGroupModalOpen(false);
        setGroupName('');
        setGroupDesc('');
        await fetchData();
      }
    } catch (err) {
      console.error('Create group error:', err);
    }
  };

  const handleOpenDeck = async (deck: any) => {
    setActiveDeck(deck);
    setCurrentCardIdx(0);
    setIsFlipped(false);
    try {
      const res = await fetch('/api/studysphere', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'GET_DECK_CARDS', deckId: deck.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
      }
    } catch (err) {
      console.error('Load deck cards error:', err);
    }
  };

  const handleMasteryRating = async (masteryLevel: number) => {
    if (!cards[currentCardIdx]) return;
    const cardId = cards[currentCardIdx].id;
    await fetch('/api/studysphere', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'UPDATE_CARD_MASTERY', cardId, masteryLevel }),
    });

    if (currentCardIdx < cards.length - 1) {
      setCurrentCardIdx(prev => prev + 1);
      setIsFlipped(false);
    } else {
      alert('Deck review complete! Spaced repetition mastery updated.');
      setActiveDeck(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">StudySphere Campus Hub</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent-500/20 text-accent-300 font-semibold border border-accent-500/30">
              Integrated Suite
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Campus study groups, verified course resource repositories, and active recall flashcards.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('GROUPS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'GROUPS' ? 'bg-accent-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Study Groups
          </button>
          <button
            onClick={() => setActiveTab('RESOURCES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'RESOURCES' ? 'bg-accent-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Notes &amp; Resources
          </button>
          <button
            onClick={() => setActiveTab('FLASHCARDS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'FLASHCARDS' ? 'bg-accent-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Flashcards
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: CAMPUS STUDY GROUPS */}
      {/* ============================================================ */}
      {activeTab === 'GROUPS' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Active Campus Study Circles</h2>
              <p className="text-xs text-slate-400">Join weekly study groups or host your own peer learning circle.</p>
            </div>
            <button
              onClick={() => setCreateGroupModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-accent-500 hover:bg-accent-400 text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create Study Circle
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {studyGroups.map((group) => (
              <div key={group.id} className="glass-panel p-5 rounded-2xl border border-slate-800 glass-panel-hover flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                      {group.subject}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {group.member_count}/{group.max_members}
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-base leading-snug">{group.name}</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">{group.description}</p>
                  
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400">
                    <div>Schedule: <strong className="text-white">{group.meeting_schedule}</strong></div>
                    <div>Host: <span className="text-accent-300">{group.creator_name}</span></div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 mt-4">
                  {group.is_member ? (
                    <div className="w-full py-2 rounded-xl bg-brand-500/10 text-brand-400 text-xs font-bold text-center border border-brand-500/30 flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Joined Circle
                    </div>
                  ) : (
                    <button
                      onClick={() => handleJoinGroup(group.id)}
                      className="w-full py-2 rounded-xl bg-accent-600 hover:bg-accent-500 text-white text-xs font-bold transition-colors"
                    >
                      Join Study Circle
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: RESOURCE & NOTES REPOSITORY */}
      {/* ============================================================ */}
      {activeTab === 'RESOURCES' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-white">Campus Notes &amp; Resource Repository</h2>
            <p className="text-xs text-slate-400">Peer-curated security checklists, cheat sheets, and exam study guides.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {resources.map((res) => (
              <div key={res.id} className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold">
                      {res.resource_type}
                    </span>
                    <span className="text-xs text-slate-400">{res.subject}</span>
                  </div>

                  <h3 className="font-bold text-white text-sm leading-snug">{res.title}</h3>
                  <p className="text-xs text-slate-300 mt-2 line-clamp-3">{res.description}</p>
                  
                  <div className="text-[11px] text-slate-400 mt-3">
                    By <strong className="text-slate-200">{res.author_name}</strong> ({res.author_college})
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 mt-4 flex items-center justify-between">
                  <button
                    onClick={() => handleUpvoteResource(res.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 transition-colors"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-brand-400" />
                    <span>{res.upvotes} Upvotes</span>
                  </button>

                  <a 
                    href={res.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1"
                  >
                    View Document <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: ACTIVE RECALL FLASHCARDS */}
      {/* ============================================================ */}
      {activeTab === 'FLASHCARDS' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-white">Active Recall Flashcard Decks</h2>
            <p className="text-xs text-slate-400">Spaced repetition decks created by top campus mentors.</p>
          </div>

          {!activeDeck ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {decks.map((deck) => (
                <div key={deck.id} className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-accent-500/20 text-accent-300 font-semibold">
                      {deck.subject}
                    </span>
                    <h3 className="font-bold text-white text-base mt-2">{deck.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">{deck.total_cards} Cards • Created by {deck.creator_name}</p>
                  </div>

                  <button
                    onClick={() => handleOpenDeck(deck)}
                    className="px-4 py-2 rounded-xl bg-accent-500 hover:bg-accent-400 text-white font-bold text-xs shadow-glow-accent transition-all"
                  >
                    Practice Deck
                  </button>
                </div>
              ))}
            </div>
          ) : (
            /* Interactive Flashcard Player */
            <div className="max-w-xl mx-auto space-y-6">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Deck: <strong className="text-white">{activeDeck.title}</strong></span>
                <button onClick={() => setActiveDeck(null)} className="text-slate-400 hover:text-white">
                  Close Deck
                </button>
              </div>

              {/* Progress */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-brand-500 h-full transition-all duration-300"
                  style={{ width: `${((currentCardIdx + 1) / (cards.length || 1)) * 100}%` }}
                />
              </div>
              <div className="text-center text-xs text-slate-400">
                Card {currentCardIdx + 1} of {cards.length}
              </div>

              {/* Interactive Card */}
              {cards[currentCardIdx] && (
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="glass-panel min-h-[220px] rounded-3xl border border-slate-700 p-8 flex flex-col items-center justify-center text-center cursor-pointer select-none hover:border-brand-500/50 transition-all shadow-2xl relative"
                >
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">
                    {isFlipped ? 'Answer (Click to flip)' : 'Question (Click to reveal)'}
                  </span>
                  
                  <p className="text-base sm:text-lg font-medium text-white leading-relaxed">
                    {isFlipped ? cards[currentCardIdx].back : cards[currentCardIdx].front}
                  </p>

                  <div className="absolute bottom-3 right-4 text-[11px] text-slate-500 flex items-center gap-1">
                    <RotateCw className="w-3 h-3" /> Flip
                  </div>
                </div>
              )}

              {/* Mastery Rating Buttons */}
              {isFlipped && (
                <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2 text-center animate-in fade-in">
                  <div className="text-xs text-slate-300 font-semibold">How well did you know this?</div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button onClick={() => handleMasteryRating(1)} className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-bold hover:bg-rose-500/30">
                      Hard (1)
                    </button>
                    <button onClick={() => handleMasteryRating(3)} className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold hover:bg-amber-500/30">
                      Good (3)
                    </button>
                    <button onClick={() => handleMasteryRating(5)} className="px-3 py-1.5 rounded-lg bg-brand-500/20 text-brand-300 text-xs font-bold hover:bg-brand-500/30">
                      Mastered (5)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CREATE STUDY CIRCLE */}
      {/* ============================================================ */}
      {createGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateGroup} className="glass-panel w-full max-w-md rounded-3xl border border-slate-700 shadow-2xl p-6 relative space-y-4">
            <button type="button" onClick={() => setCreateGroupModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-white">Create Campus Study Circle</h3>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Group Name</label>
              <input 
                type="text" required value={groupName} onChange={(e) => setGroupName(e.target.value)}
                placeholder="E.g., PyTorch Builders Lab"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Subject</label>
              <input 
                type="text" required value={groupSubject} onChange={(e) => setGroupSubject(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Meeting Schedule</label>
              <input 
                type="text" required value={groupSchedule} onChange={(e) => setGroupSchedule(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Description</label>
              <textarea 
                required rows={3} value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)}
                placeholder="What topics will the group cover?"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-accent-500"
              />
            </div>

            <button type="submit" className="w-full py-2.5 rounded-xl bg-accent-500 hover:bg-accent-400 text-white font-bold text-xs transition-colors">
              Publish Study Circle
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
