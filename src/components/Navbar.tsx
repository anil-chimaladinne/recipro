'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Sparkles, 
  Search, 
  Calendar, 
  Coins, 
  Brain, 
  ShieldAlert, 
  LogOut, 
  Activity,
  Layers,
  HelpCircle,
  Bell
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/notifications/unread-count');
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {}
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 4000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-accent-500 flex items-center justify-center shadow-glow-brand group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-dark-bg" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-xl tracking-tight text-white">SKILLSWAP</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-semibold border border-brand-500/30">CAMPUS</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">Peer skill exchange for students</p>
          </div>
        </Link>

        {/* Clean Public & App Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
          <Link 
            href="/" 
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              pathname === '/' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Home
          </Link>

          <Link 
            href="/explore" 
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              pathname === '/explore' ? 'bg-brand-500 text-dark-bg shadow-sm' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Find Skills</span>
          </Link>

          <Link 
            href="/#how-it-works" 
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              pathname === '/#how-it-works' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>How It Works</span>
          </Link>

          <Link 
            href="/study-coach" 
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              pathname === '/study-coach' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Study Coach</span>
          </Link>

          {user && (
            <>
              <Link 
                href="/studysphere" 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  pathname === '/studysphere' ? 'bg-accent-500 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Circles</span>
              </Link>

              <Link 
                href="/sessions" 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  pathname === '/sessions' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Sessions</span>
              </Link>
            </>
          )}

          {/* Moderator Access */}
          {user?.role === 'MODERATOR' && (
            <Link 
              href="/moderator" 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                pathname === '/moderator' ? 'bg-amber-500 text-dark-bg' : 'text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Moderation</span>
            </Link>
          )}

          {/* Admin Access (Visible only to authenticated ADMIN role) */}
          {user?.role === 'ADMIN' && (
            <Link 
              href="/admin" 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                pathname === '/admin' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:bg-rose-500/20'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Admin</span>
            </Link>
          )}
        </nav>

        {/* Right Section: Balance & Auth */}
        <div className="flex items-center gap-3">
          {/* Notification Inbox Bell */}
          {user && (
            <Link
              href="/notifications"
              className="relative p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Notification Center"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white font-extrabold text-[10px] flex items-center justify-center ring-2 ring-slate-950 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* Skill Credit Balance Capsule */}
          {user && (
            <Link href="/wallet" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-950/60 border border-brand-500/30 hover:border-brand-500/60 transition-colors">
              <Coins className="w-4 h-4 text-brand-400 animate-pulse-subtle" />
              <div className="text-left">
                <div className="text-xs font-bold text-brand-300 leading-none">
                  {user.balance} <span className="text-[10px] font-normal text-slate-300">Credits</span>
                </div>
                {user.escrow_balance > 0 && (
                  <div className="text-[9px] text-amber-400 leading-none mt-0.5">
                    ({user.escrow_balance} in escrow)
                  </div>
                )}
              </div>
            </Link>
          )}

          {/* User Profile / Logout vs Login / Sign Up */}
          {user ? (
            <div className="flex items-center gap-2">
              <Link 
                href="/profile" 
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-600 flex items-center justify-center text-dark-bg font-extrabold text-xs shadow-md hover:scale-105 transition-transform"
                title={`${user.display_name} • View Profile`}
              >
                {user.display_name?.substring(0, 2).toUpperCase() || 'U'}
              </Link>
              <button
                onClick={() => logout()}
                className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link 
                href="/login" 
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors border border-slate-700"
              >
                Log In
              </Link>
              <Link 
                href="/register" 
                className="px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs transition-colors shadow-glow-brand"
              >
                Sign Up
              </Link>
            </div>
          )}

        </div>
      </div>
    </header>
  );
}
