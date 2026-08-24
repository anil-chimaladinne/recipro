'use client';

import React, { useState } from 'react';
import { 
  Star, 
  Sparkles, 
  CheckCircle2, 
  X, 
  MessageSquare, 
  Award, 
  ShieldCheck, 
  Clock, 
  Zap,
  ThumbsUp
} from 'lucide-react';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  mentorName: string;
  mentorAvatar?: string;
  skillName: string;
  onRatingSubmitted?: (ratingData: any) => void;
}

const PRAISE_TAGS = [
  'Clear Explanations',
  'Practical Code Examples',
  'Patient & Helpful',
  'Well Prepared & On-Time',
  'Strong Domain Expertise',
  'Interactive & Engaging',
  'Great Problem Solving'
];

export default function RatingModal({
  isOpen,
  onClose,
  sessionId,
  mentorName,
  mentorAvatar,
  skillName,
  onRatingSubmitted
}: RatingModalProps) {
  const [score, setScore] = useState<number>(5);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [clarityScore, setClarityScore] = useState<number>(5);
  const [punctualityScore, setPunctualityScore] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Clear Explanations', 'Well Prepared & On-Time']);
  const [review, setReview] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const getScoreLabel = (s: number) => {
    switch (s) {
      case 5: return '🌟 Outstanding Mentor!';
      case 4: return '👍 Very Good Experience';
      case 3: return '👌 Good / Met Expectations';
      case 2: return '⚠️ Fair / Needs Improvement';
      case 1: return '❌ Poor Experience';
      default: return 'Rate your mentor';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (review.trim().length < 5) {
      setError('Please provide at least 5 characters of feedback.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          score,
          review: review.trim(),
          clarityScore,
          punctualityScore,
          skillsDemonstrated: selectedTags.join(', '),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to submit rating. Please try again.');
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      if (onRatingSubmitted) {
        onRatingSubmitted({
          score,
          review: review.trim(),
          clarityScore,
          punctualityScore,
          skillsDemonstrated: selectedTags.join(', '),
          updatedReputation: data.updatedReputation
        });
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError('A network error occurred while submitting your review.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-panel w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-950 p-6 sm:p-8 space-y-6 shadow-2xl relative my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close rating modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Peer Review &amp; Reputation</span>
          </div>
          <h2 className="text-2xl font-display font-extrabold text-white">
            Rate Your Mentor
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            How was your session with <strong className="text-white">{mentorName}</strong> on <strong className="text-brand-400">{skillName}</strong>?
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
            {error}
          </div>
        )}

        {success ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-glow-brand">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Rating Submitted Successfully!</h3>
            <p className="text-xs text-slate-400">
              Thank you! Your feedback helps calculate verified Bayesian peer reputation on campus.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Main 5-Star Interactive Rating */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Overall Experience</span>
              <div className="flex items-center justify-center gap-2 py-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverScore !== null ? hoverScore : score) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverScore(star)}
                      onMouseLeave={() => setHoverScore(null)}
                      onClick={() => setScore(star)}
                      className="p-1 text-2xl transition-transform hover:scale-125 focus:outline-none"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          active 
                            ? 'text-amber-400 fill-amber-400 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' 
                            : 'text-slate-700'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="text-xs font-extrabold text-amber-300">
                {getScoreLabel(hoverScore !== null ? hoverScore : score)}
              </div>
            </div>

            {/* Sub-Criteria: Clarity & Punctuality */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Mentoring Clarity */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-brand-400" /> Clarity
                  </span>
                  <span className="font-bold text-brand-400">{clarityScore} / 5</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={clarityScore}
                  onChange={(e) => setClarityScore(parseInt(e.target.value, 10))}
                  className="w-full accent-brand-500 cursor-pointer"
                />
              </div>

              {/* Punctuality */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-400" /> Punctuality
                  </span>
                  <span className="font-bold text-sky-400">{punctualityScore} / 5</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={punctualityScore}
                  onChange={(e) => setPunctualityScore(parseInt(e.target.value, 10))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Skills & Strengths Praise Tags */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ThumbsUp className="w-3.5 h-3.5 text-brand-400" />
                <span>Mentor Highlights &amp; Strengths</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRAISE_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all ${
                        isSelected
                          ? 'bg-brand-500/20 text-brand-300 border-brand-500/40 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '} {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detailed Written Feedback */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-brand-400" />
                <span>Written Review &amp; Recommendation</span>
              </label>
              <textarea
                required
                rows={3}
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Share helpful feedback about what went well and how this mentor helped you learn..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Skip / Later
              </button>
              <button
                type="submit"
                disabled={submitting || review.trim().length < 5}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-dark-bg font-extrabold text-xs shadow-glow-brand transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting ? (
                  <span>Submitting Review...</span>
                ) : (
                  <>
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>Submit Verified Rating</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
