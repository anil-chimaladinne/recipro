import React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950/80 mt-20 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-8">
          
          <div className="space-y-3 col-span-2 md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-500 to-accent-500 flex items-center justify-center text-dark-bg font-bold shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-display font-bold text-base text-white">SKILLSWAP CAMPUS</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              The university peer-learning network where students exchange skills instead of money.
            </p>
            <div className="text-[11px] text-slate-500">
              Campus Peer Network • Active
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white uppercase tracking-wider text-[11px] mb-3">Product</h4>
            <ul className="space-y-2">
              <li><Link href="/" className="hover:text-brand-400 transition-colors">Home</Link></li>
              <li><Link href="/explore" className="hover:text-brand-400 transition-colors">Find Skills</Link></li>
              <li><Link href="/#how-it-works" className="hover:text-brand-400 transition-colors">How It Works</Link></li>
              <li><Link href="/study-coach" className="hover:text-brand-400 transition-colors">Study Coach</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white uppercase tracking-wider text-[11px] mb-3">Account</h4>
            <ul className="space-y-2">
              <li><Link href="/login" className="hover:text-brand-400 transition-colors">Log In</Link></li>
              <li><Link href="/register" className="hover:text-brand-400 transition-colors">Sign Up</Link></li>
              <li><Link href="/profile" className="hover:text-brand-400 transition-colors">My Profile</Link></li>
              <li><Link href="/sessions" className="hover:text-brand-400 transition-colors">My Sessions</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white uppercase tracking-wider text-[11px] mb-3">Support &amp; Legal</h4>
            <ul className="space-y-2">
              <li><Link href="/explore" className="hover:text-brand-400 transition-colors">Help Center</Link></li>
              <li><Link href="/moderator" className="hover:text-brand-400 transition-colors">Report an Issue</Link></li>
              <li><span className="text-slate-500">Privacy Policy</span></li>
              <li><span className="text-slate-500">Terms of Service</span></li>
            </ul>
          </div>

        </div>

        <div className="border-t border-slate-900 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p>© 2026 SkillSwap Campus. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/moderator" className="hover:text-slate-400">Campus Moderator</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
