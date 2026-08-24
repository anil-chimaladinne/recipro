'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  RefreshCw, 
  Sparkles,
  GraduationCap
} from 'lucide-react';

function VerifyEmailComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUser } = useAuth();

  const tokenParam = searchParams.get('token');

  const [status, setStatus] = useState<'IDLE' | 'VERIFYING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [message, setMessage] = useState<string>('');
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  // Automatically verify when a token param is in the URL
  useEffect(() => {
    if (tokenParam) {
      handleVerifyToken(tokenParam);
    } else if (user?.email_verified) {
      setStatus('SUCCESS');
      setMessage('Your email address is already verified.');
    }
  }, [tokenParam, user]);

  const handleVerifyToken = async (token: string) => {
    setStatus('VERIFYING');
    setMessage('Verifying your email token...');

    try {
      const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setStatus('SUCCESS');
        setMessage(data.message || 'Email verified successfully!');
        await refreshUser();
      } else {
        setStatus('ERROR');
        setMessage(data.error || 'Failed to verify email token. The link may have expired or is invalid.');
      }
    } catch (err) {
      setStatus('ERROR');
      setMessage('A network error occurred while verifying your email.');
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendStatus(null);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (res.ok) {
        setResendStatus('A new verification email has been dispatched to your inbox.');
      } else {
        setResendStatus(data.error || 'Failed to resend verification email.');
      }
    } catch (err) {
      setResendStatus('Network error while resending verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] max-w-lg mx-auto px-4 py-12 flex flex-col justify-center">
      
      {/* Header */}
      <div className="text-center mb-8 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>SkillSwap Verification</span>
        </div>
        <h1 className="text-3xl font-display font-extrabold text-white tracking-tight">
          Verify Your Email
        </h1>
        <p className="text-xs text-slate-400">
          Confirm your campus email address to activate your account and start exchanging skills.
        </p>
      </div>

      {/* Main Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6 text-center">
        
        {/* Verification Status Icon */}
        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto border transition-all">
          {status === 'SUCCESS' || user?.email_verified ? (
            <div className="w-full h-full rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-glow-brand">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          ) : status === 'ERROR' ? (
            <div className="w-full h-full rounded-3xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <AlertCircle className="w-8 h-8" />
            </div>
          ) : status === 'VERIFYING' ? (
            <div className="w-full h-full rounded-3xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <div className="w-full h-full rounded-3xl bg-slate-900 text-brand-400 border border-slate-700 flex items-center justify-center">
              <Mail className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Status Message */}
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">
            {status === 'SUCCESS' || user?.email_verified
              ? 'Email Verified Successfully!'
              : status === 'ERROR'
              ? 'Verification Failed'
              : status === 'VERIFYING'
              ? 'Verifying Token...'
              : 'Check Your Inbox'}
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
            {message || (user?.email ? (
              <>We've dispatched a verification link to <strong className="text-white">{user.email}</strong>. Please check your email inbox and click the link to activate your account.</>
            ) : (
              'Please check your email inbox and click the verification link.'
            ))}
          </p>
        </div>

        {/* Academic Domain Badge & Verification Status */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-left space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-semibold">Verification Status:</span>
            {status === 'SUCCESS' || user?.email_verified ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified
              </span>
            ) : (
              <span className="text-amber-400 font-bold">Awaiting Link Click</span>
            )}
          </div>

          {user?.is_academic_email && (
            <div className="flex items-center justify-between border-t border-slate-800/60 pt-2">
              <span className="text-slate-400 font-semibold">Academic Domain:</span>
              <span className="text-sky-300 font-semibold flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" /> Academic Email Detected
              </span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 text-[11px] text-slate-400">
            <span>Campus Account:</span>
            <span className="text-slate-300 font-mono">{user?.email || 'Logged In'}</span>
          </div>
        </div>

        {resendStatus && (
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200">
            {resendStatus}
          </div>
        )}

        {/* Action Controls */}
        <div className="space-y-3 pt-2">
          {status === 'SUCCESS' || user?.email_verified ? (
            <button
              onClick={() => router.push('/onboarding')}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-dark-bg font-extrabold text-xs shadow-glow-brand transition-all flex items-center justify-center gap-2"
            >
              <span>Continue to Onboarding</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={handleResend}
                disabled={resending}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                <span>{resending ? 'Sending...' : 'Resend Verification Email'}</span>
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center text-xs text-slate-400">
        Loading verification portal...
      </div>
    }>
      <VerifyEmailComponent />
    </Suspense>
  );
}
