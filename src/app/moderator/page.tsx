'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Users, 
  Coins, 
  FileText, 
  Activity, 
  ShieldCheck, 
  X,
  Lock,
  UserX
} from 'lucide-react';

export default function ModeratorPage() {
  const { user } = useAuth();

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchModerationData = async () => {
    try {
      const res = await fetch('/api/moderation');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Moderator fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModerationData();
  }, [user]);

  const handleModeratorAction = async (targetType: string, targetId: string, action: string, reason: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, action, reason }),
      });

      if (res.ok) {
        await fetchModerationData();
      } else {
        const errJson = await res.json();
        alert(errJson.error || 'Action failed');
      }
    } catch (err) {
      console.error('Action error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (user?.role !== 'MODERATOR' && user?.role !== 'ADMIN') {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-3">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Campus Moderator Authentication Required</h2>
        <p className="text-xs text-slate-400">
          Please log in with a campus moderator or administrator account to access the moderation portal.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">Campus Moderation Portal</h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30">
            Safety &amp; Sybil Defense
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Review ML fraud alerts, investigate disputes, and execute auditable moderation decisions.
        </p>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="text-xs text-slate-400 font-semibold">Total Students</div>
          <div className="text-2xl font-bold font-display text-white mt-1">{data?.metrics?.totalUsers || 0}</div>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-rose-500/30 bg-rose-950/20">
          <div className="text-xs text-rose-300 font-semibold">Flagged Sybil Alerts</div>
          <div className="text-2xl font-bold font-display text-rose-400 mt-1">{data?.metrics?.flaggedAlertsCount || 0}</div>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-amber-500/30 bg-amber-950/20">
          <div className="text-xs text-amber-300 font-semibold">Open Disputes</div>
          <div className="text-2xl font-bold font-display text-amber-400 mt-1">{data?.metrics?.openDisputesCount || 0}</div>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="text-xs text-slate-400 font-semibold">Open User Reports</div>
          <div className="text-2xl font-bold font-display text-slate-200 mt-1">{data?.metrics?.openReportsCount || 0}</div>
        </div>
      </div>

      {/* 1. Isolation Forest Fraud & Sybil Anomaly Queue */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-rose-300">
            ML Anomaly Queue — Sybil &amp; Rating Ring Alerts ({data?.fraudAlerts?.length || 0})
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            Human in the loop: ML flags signals, moderators make decisions
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {data?.fraudAlerts?.map((alert: any) => {
            const reasons = alert.anomaly_reasons ? JSON.parse(alert.anomaly_reasons) : [];

            return (
              <div key={alert.id} className="glass-panel p-5 rounded-2xl border border-rose-500/40 bg-gradient-to-br from-rose-950/30 to-slate-900/60 shadow-glass space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-base">{alert.display_name}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                        Risk Score: {alert.risk_score}% ({alert.risk_level})
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{alert.email} • Status: <strong className="text-white">{alert.user_status}</strong></p>
                  </div>
                </div>

                {/* Detected Signals */}
                <div className="space-y-1.5 bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-xs">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Detected Risk Signals:</div>
                  {reasons.map((r: string, idx: number) => (
                    <div key={idx} className="text-slate-300 flex items-start gap-1.5 text-[11px]">
                      <span className="text-rose-400 font-bold">&bull;</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>

                {/* Moderator Actions */}
                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500">Status: {alert.status}</span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleModeratorAction('FRAUD_ALERT', alert.id, 'CLEAR_ALERT', 'Reviewed and verified as legitimate activity')}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                    >
                      Clear Alert
                    </button>
                    <button
                      onClick={() => handleModeratorAction('USER', alert.user_id, 'SUSPEND_USER', 'Confirmed Sybil/Rating Farm Ring')}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm"
                    >
                      Suspend Account
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Open Disputes Queue */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-300">
            Open Session Disputes ({data?.disputes?.length || 0})
          </h2>
        </div>

        {data?.disputes?.length === 0 ? (
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 text-center text-xs text-slate-400">
            No unresolved session disputes at this time.
          </div>
        ) : (
          <div className="space-y-3">
            {data?.disputes?.map((disp: any) => (
              <div key={disp.id} className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">{disp.session_title}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold">
                      Reason: {disp.reason}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Initiator: <strong className="text-white">{disp.initiator_name}</strong> • {disp.credits_amount} Credit in Escrow Lock</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleModeratorAction('DISPUTE', disp.id, 'RESOLVE_REFUND', 'Moderator determined learner refund')}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-brand-300 text-xs font-semibold border border-slate-700"
                  >
                    Refund Learner
                  </button>
                  <button
                    onClick={() => handleModeratorAction('DISPUTE', disp.id, 'RESOLVE_PAYOUT', 'Moderator validated mentor completed session')}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-dark-bg text-xs font-bold"
                  >
                    Settle to Mentor
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Campus Audit Logs Stream */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
            Campus Audit Log Stream
          </h2>
        </div>

        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden divide-y divide-slate-800 text-xs">
          {data?.auditLogs?.map((log: any) => (
            <div key={log.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-brand-400 font-bold">{log.action}</span>
                <span className="text-slate-400">&bull; Target: {log.target_type} ({log.target_id})</span>
              </div>
              <span className="text-slate-500 text-[11px]">{new Date(log.created_at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
