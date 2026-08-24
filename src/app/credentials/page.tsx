'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  Award, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles, 
  ExternalLink, 
  X, 
  Clock, 
  BookOpen, 
  Star 
} from 'lucide-react';

export default function CredentialsPage() {
  const { user } = useAuth();
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCred, setSelectedCred] = useState<any | null>(null);

  useEffect(() => {
    fetchCredentials();
  }, [user]);

  const fetchCredentials = async () => {
    try {
      const res = await fetch('/api/credentials');
      if (res.ok) {
        const data = await res.json();
        setCredentials(data.credentials || []);
      }
    } catch (err) {
      console.error('Credentials fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
            Verifiable Campus Credentials
          </h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-semibold border border-brand-500/30">
            Soulbound NFT Proofs
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Cryptographically issued upon deterministic milestone satisfaction (e.g. &ge; 3 teaching sessions &amp; rating &ge; 4.5).
        </p>
      </div>

      {/* Credentials Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading verifiable certificates...</div>
      ) : credentials.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center space-y-4">
          <Award className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Verifiable Credentials Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Complete teaching sessions with a rating of 4.5 or higher to automatically earn verifiable mentor badges!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {credentials.map((cred) => {
            const criteria = cred.criteria_met ? JSON.parse(cred.criteria_met) : {};

            return (
              <div 
                key={cred.id} 
                onClick={() => setSelectedCred(cred)}
                className="glass-panel p-6 rounded-3xl border border-brand-500/30 bg-gradient-to-br from-brand-950/20 to-slate-900/60 shadow-glass glass-panel-hover cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-500 to-accent-500 flex items-center justify-center text-dark-bg font-extrabold text-xl shadow-glow-brand">
                      <Award className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-300 font-bold border border-brand-500/40">
                      {cred.token_id || 'CERT-8841'}
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-base leading-snug">{cred.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{cred.skill_name || 'Campus Mentorship'}</p>

                  {/* Criteria Met Summary */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1.5">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Milestone Criteria:</div>
                    <div className="text-slate-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />
                      <span>{criteria.sessionsTaught || 3} Completed Sessions</span>
                    </div>
                    <div className="text-slate-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />
                      <span>{criteria.bayesianRating || 4.8} Bayesian Rating</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 mt-4 flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-[11px]">
                    Issued {new Date(cred.issued_at).toLocaleDateString()}
                  </span>
                  <span className="text-brand-400 font-semibold hover:underline flex items-center gap-1">
                    Inspect Proof &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Certificate Verification Details */}
      {selectedCred && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl border border-brand-500/40 shadow-2xl p-6 relative space-y-5 animate-in fade-in zoom-in-95">
            <button onClick={() => setSelectedCred(null)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2 pt-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-500 to-accent-500 flex items-center justify-center text-dark-bg mx-auto shadow-glow-brand">
                <Award className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold font-display text-white">{selectedCred.title}</h3>
              <p className="text-xs text-brand-400 font-semibold">Soulbound Verifiable Credential Certificate</p>
            </div>

            <div className="space-y-2 text-xs bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Recipient:</span>
                <strong className="text-white">{user?.display_name}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Certificate Token ID:</span>
                <span className="font-mono text-brand-300">{selectedCred.token_id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Blockchain Network:</span>
                <span className="text-white">Campus EVM DevNet (31337)</span>
              </div>
              <div className="flex flex-col gap-1 pt-1 border-t border-slate-800">
                <span className="text-slate-400">On-Chain Proof Tx Hash:</span>
                <span className="font-mono text-[11px] text-accent-300 break-all">{selectedCred.tx_hash}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-400 shrink-0" />
              <span>Cryptographic authenticity verified by Campus Smart Contract Oracle. Non-transferrable soulbound proof.</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
