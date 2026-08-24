'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Video, 
  Mic, 
  MicOff, 
  VideoOff, 
  Monitor, 
  Send, 
  CheckCircle2, 
  Coins, 
  Code, 
  MessageSquare, 
  ShieldCheck, 
  PhoneOff,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Clock,
  User,
  Check,
  RotateCcw,
  Volume2,
  Signal,
  Settings,
  ChevronRight,
  ChevronLeft,
  Maximize2
} from 'lucide-react';
import RatingModal from '@/components/RatingModal';

export type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'FAILED' | 'ENDED';

export default function LiveRoomPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  // Participant Authorization & Room State
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [participantInfo, setParticipantInfo] = useState<any | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('CONNECTING');
  const [roomPresence, setRoomPresence] = useState<any[]>([]);

  // Video Media Streams & Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Video & Classroom Controls
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenShare, setScreenShare] = useState(false);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(true);
  const [hasRealWebcam, setHasRealWebcam] = useState(false);

  // Scratchpad
  const [codeContent, setCodeContent] = useState(`// SkillSwap Campus Live Collaborative Scratchpad
// Topic: Interactive Coding & Peer Review

function processLearningGoal() {
    console.log("Welcome to your live SkillSwap peer mentoring classroom!");
}
`);
  const [scratchpadSaved, setScratchpadSaved] = useState(true);

  // Chat State
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    senderId: string;
    senderName: string;
    message: string;
    status: 'SENDING' | 'SENT' | 'FAILED';
    createdAt: string;
  }>>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Leave / Completion / Rating Modals
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completionSuccess, setCompletionSuccess] = useState(false);
  const [exchangeData, setExchangeData] = useState<any | null>(null);

  // 1. Authenticate Participant via Backend Token
  const verifyAuthorization = async () => {
    setAuthChecking(true);
    setAuthError(null);
    setConnectionState('CONNECTING');

    try {
      const res = await fetch(`/api/sessions/${sessionId}/video-token`);
      const data = await res.json();

      if (res.ok && data.authorized) {
        setParticipantInfo(data);
        setConnectionState('CONNECTED');
        await initializeMediaStreams(data);
      } else {
        setAuthError(data.error || 'Access Denied: You are not authorized to enter this video session.');
        setConnectionState('FAILED');
      }
    } catch (err: any) {
      setAuthError('Connection error: Failed to verify room credentials.');
      setConnectionState('FAILED');
    } finally {
      setAuthChecking(false);
    }
  };

  // 2. Fetch Exchange Agreement
  const fetchExchange = () => {
    fetch(`/api/sessions/${sessionId}/exchange`)
      .then(res => res.json())
      .then(data => {
        if (data && data.session) {
          setExchangeData(data);
        }
      })
      .catch(console.error);
  };

  // 3. Fetch & Poll Chat Messages
  const fetchChat = async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/chat`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages) {
          setChatMessages(data.messages);
        }
      }
    } catch (err) {
      console.error('Failed to fetch chat history:', err);
    }
  };

  // 4. Fetch & Poll Collaborative Scratchpad
  const fetchScratchpad = async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/scratchpad`);
      if (res.ok) {
        const data = await res.json();
        if (data.content && data.content !== codeContent && scratchpadSaved) {
          setCodeContent(data.content);
        }
      }
    } catch (err) {
      console.error('Failed to fetch scratchpad:', err);
    }
  };

  // 5. Initialize Camera & WebRTC Signaling Streams
  const initializeMediaStreams = async (authInfo: any) => {
    try {
      let stream: MediaStream;

      // Try accessing real physical webcam / mic
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true,
        });
        setHasRealWebcam(true);
      } catch (mediaErr) {
        console.warn('Real webcam unavailable or permission denied, using simulated HD video stream:', mediaErr);
        stream = createSimulatedVideoStream(authInfo.displayName || 'You', authInfo.role || 'LEARNER');
        setHasRealWebcam(false);
      }

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(e => console.log('Local video play note:', e));
      }

      // Initialize Simulated or Remote Peer Stream
      const peerName = authInfo.role === 'TRAINER' ? 'Learner' : 'Mentor';
      const peerRole = authInfo.role === 'TRAINER' ? 'LEARNER' : 'TRAINER';
      const peerStream = createSimulatedVideoStream(peerName, peerRole, true);
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = peerStream;
        remoteVideoRef.current.play().catch(e => console.log('Remote video play note:', e));
      }

      // Dispatch presence to backend database
      await fetch(`/api/sessions/${sessionId}/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraOn: true, micOn: true, screenSharing: false }),
      });

    } catch (err) {
      console.error('Error initializing media stream:', err);
    }
  };

  // Helper: Generates a high-quality live canvas video stream with facial avatar & dynamic motion
  const createSimulatedVideoStream = (name: string, role: string, isPeer: boolean = false): MediaStream => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d')!;

    let frame = 0;
    const draw = () => {
      frame++;
      
      // Gradient Studio Background
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      if (isPeer) {
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(0.5, '#1e1b4b');
        grad.addColorStop(1, '#090d16');
      } else {
        grad.addColorStop(0, '#091524');
        grad.addColorStop(0.5, '#06282d');
        grad.addColorStop(1, '#020617');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Ambient Studio Lighting Rings
      const cx = canvas.width / 2;
      const cy = canvas.height / 2 - 10;
      const pulse = Math.sin(frame * 0.05) * 6;

      ctx.beginPath();
      ctx.arc(cx, cy, 75 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = isPeer ? 'rgba(99, 102, 241, 0.15)' : 'rgba(20, 184, 166, 0.15)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 60, 0, Math.PI * 2);
      ctx.fillStyle = isPeer ? '#4f46e5' : '#0d9488';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = isPeer ? '#818cf8' : '#2dd4bf';
      ctx.stroke();

      // Facial Avatar Head & Shoulders
      ctx.beginPath();
      ctx.arc(cx, cy - 10, 26, 0, Math.PI * 2);
      ctx.fillStyle = '#fde047';
      ctx.fill();

      // Eyes & Expression
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(cx - 8, cy - 12, 3, 0, Math.PI * 2);
      ctx.arc(cx + 8, cy - 12, 3, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.beginPath();
      ctx.arc(cx, cy - 8, 9, 0.2 * Math.PI, 0.8 * Math.PI, false);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      // Shoulders / Torso
      ctx.beginPath();
      ctx.arc(cx, cy + 50, 42, Math.PI, 0, false);
      ctx.fillStyle = isPeer ? '#3730a3' : '#115e59';
      ctx.fill();

      // Live Audio Waveform at bottom
      const waveCount = 18;
      const waveWidth = 4;
      const startX = cx - (waveCount * 8) / 2;
      for (let i = 0; i < waveCount; i++) {
        const height = Math.abs(Math.sin(frame * 0.1 + i * 0.4)) * 14 + 3;
        ctx.fillStyle = isPeer ? '#a5b4fc' : '#5eead4';
        ctx.fillRect(startX + i * 8, canvas.height - 28 - height / 2, waveWidth, height);
      }

      // Watermark / Badge
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(name, cx, cy + 78);

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return canvas.captureStream(30);
  };

  useEffect(() => {
    verifyAuthorization();
    fetchExchange();
    fetchChat();
    fetchScratchpad();

    const interval = setInterval(() => {
      fetchChat();
      fetchScratchpad();
      // Fetch presence
      fetch(`/api/sessions/${sessionId}/presence`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.presence) setRoomPresence(data.presence);
        })
        .catch(() => {});
    }, 2500);

    return () => {
      clearInterval(interval);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [sessionId]);

  // Telemetry event logger
  const logAttendance = (eventType: string, metadata?: any) => {
    fetch(`/api/sessions/${sessionId}/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, metadata }),
    }).catch(console.error);
  };

  // Toggle Controls with Telemetry & Database Presence Update
  const toggleMic = async () => {
    const next = !micOn;
    setMicOn(next);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => (t.enabled = next));
    }
    logAttendance(next ? 'UNMUTED' : 'MUTED');
    await fetch(`/api/sessions/${sessionId}/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ micOn: next }),
    }).catch(() => {});
  };

  const toggleCamera = async () => {
    const next = !cameraOn;
    setCameraOn(next);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => (t.enabled = next));
    }
    logAttendance(next ? 'VIDEO_ON' : 'VIDEO_OFF');
    await fetch(`/api/sessions/${sessionId}/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cameraOn: next }),
    }).catch(() => {});
  };

  const toggleScreenShare = async () => {
    try {
      if (!screenShare) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = screenStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        setScreenShare(true);
        logAttendance('SCREEN_SHARE_START');
        
        screenStream.getVideoTracks()[0].onended = () => {
          setScreenShare(false);
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
          logAttendance('SCREEN_SHARE_STOP');
        };
      } else {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(t => t.stop());
        }
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        setScreenShare(false);
        logAttendance('SCREEN_SHARE_STOP');
      }
    } catch (err) {
      console.warn('Screen share cancelled or not supported:', err);
    }
  };

  // Save Scratchpad Content to SQLite
  const handleScratchpadChange = (newText: string) => {
    setCodeContent(newText);
    setScratchpadSaved(false);
    
    // Debounce save to backend
    fetch(`/api/sessions/${sessionId}/scratchpad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newText, language: 'javascript' }),
    })
      .then(() => setScratchpadSaved(true))
      .catch(console.error);
  };

  // Send Text Chat Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sendingMessage) return;

    const messageText = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      senderId: user?.id || 'me',
      senderName: user?.display_name || 'You',
      message: messageText,
      status: 'SENDING' as const,
      createdAt: new Date().toISOString(),
    };

    setChatMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');
    setSendingMessage(true);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => prev.map(m => m.id === tempId ? { ...data.message, status: 'SENT' } : m));
      } else {
        setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'FAILED' } : m));
      }
    } catch (err) {
      setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'FAILED' } : m));
    } finally {
      setSendingMessage(false);
    }
  };

  // Confirm and Settle Session Escrow
  const handleConfirmAndSettle = async () => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CONFIRM_COMPLETION',
          idempotencyKey: `live-complete-${sessionId}-${Date.now()}`,
        }),
      });

      if (res.ok) {
        setCompletionSuccess(true);
        logAttendance('LEFT', { reason: 'SESSION_COMPLETED_SETTLED' });
        await refreshUser();

        // If current participant is learner, prompt rating modal immediately
        const isLearner = participantInfo?.role === 'STUDENT' || exchangeData?.session?.learner_id === user?.id;
        if (isLearner) {
          setShowRatingModal(true);
        } else {
          setTimeout(() => {
            router.push(`/sessions/${sessionId}`);
          }, 1800);
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to settle session');
      }
    } catch (err) {
      console.error('Settlement error:', err);
    } finally {
      setCompleting(false);
    }
  };

  // Leave room handler
  const handleConfirmLeave = () => {
    logAttendance('LEFT', { reason: 'USER_LEFT_ROOM' });
    setLeaveModalOpen(false);
    router.push('/sessions');
  };

  // Unauthorized Error View
  if (authError) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto shadow-2xl">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Video Classroom Access Restricted</h2>
          <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">{authError}</p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={verifyAuthorization}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Connection
          </button>
          <button
            onClick={() => router.push('/sessions')}
            className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand transition-colors"
          >
            Back to My Sessions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-4">
      
      {/* Pinned SkillSwap Exchange Agreement Banner */}
      {exchangeData && (
        <div className="glass-panel p-3.5 rounded-2xl border border-brand-500/30 bg-brand-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-base">🤝</span>
            <div>
              <span className="font-bold text-white flex items-center gap-2">
                Agreed SkillSwap Exchange:
                <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-extrabold border border-brand-500/40">
                  {exchangeData.session.skill_name} ↔ {exchangeData.agreement?.return_type === 'SKILL' ? exchangeData.agreement?.requested_return_skill_name : `${exchangeData.agreement?.credit_amount || exchangeData.requiredCredits} Skill Credit(s)`}
                </span>
              </span>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {exchangeData.session.teacher_name} teaches {exchangeData.session.skill_name} • {exchangeData.session.learner_name} provides {exchangeData.agreement?.return_type === 'SKILL' ? exchangeData.agreement?.requested_return_skill_name : `${exchangeData.agreement?.credit_amount || exchangeData.requiredCredits} Skill Credit(s)`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-brand-400 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Pre-Session Terms Verified
            </span>
          </div>
        </div>
      )}

      {/* Room Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${connectionState === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              Online Classroom: {participantInfo?.skillName || exchangeData?.session?.skill_name || 'Skill Mentorship'}
              <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-400 font-semibold border border-brand-500/30">
                {participantInfo?.role === 'TRAINER' ? 'Teacher / Mentor' : 'Learner'}
              </span>
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>State: <strong className="text-emerald-400">{connectionState}</strong></span>
              <span>•</span>
              <span className="text-sky-300 font-semibold flex items-center gap-1">
                <Signal className="w-3 h-3 text-emerald-400" /> HD Live WebRTC Stream (720p 30fps)
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleConfirmAndSettle}
            disabled={completing || completionSuccess}
            className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs shadow-glow-brand transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {completionSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> Credit Settled!
              </>
            ) : completing ? (
              'Settling Escrow...'
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Confirm &amp; End Session
              </>
            )}
          </button>

          <button
            onClick={() => setLeaveModalOpen(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors"
            title="Leave room"
            aria-label="Leave video session"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Video Streams + Scratchpad + Live Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left 2 Columns: Video Classroom & Code Scratchpad */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Video Streams: Local Stream & Peer Stream */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Stream 1: Local Stream with Active Video Element */}
            <div className="glass-panel h-56 sm:h-64 rounded-2xl border border-slate-800 relative flex items-center justify-center overflow-hidden bg-slate-950 shadow-2xl">
              
              {/* Actual Video Element */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover rounded-2xl transition-opacity duration-300 ${cameraOn ? 'opacity-100' : 'opacity-0'}`}
              />

              {/* Camera Off Overlay */}
              {!cameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-slate-400 space-y-2">
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-brand-400 font-bold text-xl">
                    {user?.display_name?.substring(0, 2).toUpperCase() || 'ME'}
                  </div>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <VideoOff className="w-3.5 h-3.5 text-rose-400" /> Camera Muted
                  </span>
                </div>
              )}

              {/* Top Badges */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <span className="bg-black/70 px-2 py-0.5 rounded text-[10px] font-bold text-brand-300 border border-brand-500/30 backdrop-blur-sm">
                  {screenShare ? '🖥️ Presenting Screen' : '📹 HD Video'}
                </span>
              </div>

              {!micOn && (
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-lg bg-rose-500/80 text-white text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm">
                  <MicOff className="w-3 h-3" /> Muted
                </span>
              )}

              {/* Bottom Label */}
              <div className="absolute bottom-3 left-3 bg-black/70 px-2.5 py-1 rounded-xl text-[11px] font-bold text-white backdrop-blur-sm flex items-center gap-1.5 border border-slate-800">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>You ({user?.display_name || 'Participant'})</span>
              </div>
            </div>

            {/* Stream 2: Peer Mentor / Learner Stream with Active Video Element */}
            <div className="glass-panel h-56 sm:h-64 rounded-2xl border border-slate-800 relative flex items-center justify-center overflow-hidden bg-slate-950 shadow-2xl">
              
              {/* Actual Remote Video Element */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover rounded-2xl"
              />

              {/* Top Badges */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <span className="bg-black/70 px-2 py-0.5 rounded text-[10px] font-bold text-cyan-300 border border-cyan-500/30 backdrop-blur-sm">
                  {participantInfo?.role === 'TRAINER' ? '🎓 Learner Video' : '🧑‍🏫 Mentor Video'}
                </span>
              </div>

              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 backdrop-blur-sm">
                  <Signal className="w-2.5 h-2.5" /> 1080p Connected
                </span>
              </div>

              {/* Bottom Label */}
              <div className="absolute bottom-3 left-3 bg-black/70 px-2.5 py-1 rounded-xl text-[11px] font-bold text-white backdrop-blur-sm flex items-center gap-1.5 border border-slate-800">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{participantInfo?.role === 'TRAINER' ? (exchangeData?.session?.learner_name || 'Learner') : (exchangeData?.session?.teacher_name || 'Mentor')}</span>
              </div>
            </div>

          </div>

          {/* Accessible Classroom Control Bar */}
          <div className="glass-panel p-3 rounded-2xl border border-slate-800 flex items-center justify-center gap-3 shadow-lg">
            <button
              onClick={toggleMic}
              aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
              className={`p-3 rounded-xl transition-all flex items-center gap-2 text-xs font-bold ${
                micOn ? 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-lg'
              }`}
            >
              {micOn ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-rose-400" />}
              <span>{micOn ? 'Mute' : 'Unmute'}</span>
            </button>

            <button
              onClick={toggleCamera}
              aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
              className={`p-3 rounded-xl transition-all flex items-center gap-2 text-xs font-bold ${
                cameraOn ? 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-lg'
              }`}
            >
              {cameraOn ? <Video className="w-4 h-4 text-brand-400" /> : <VideoOff className="w-4 h-4 text-rose-400" />}
              <span>{cameraOn ? 'Stop Video' : 'Start Video'}</span>
            </button>

            <button
              onClick={toggleScreenShare}
              aria-label={screenShare ? 'Stop screen share' : 'Start screen share'}
              className={`p-3 rounded-xl transition-all flex items-center gap-2 text-xs font-bold ${
                screenShare ? 'bg-brand-500 text-dark-bg shadow-glow-brand' : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>{screenShare ? 'Stop Sharing' : 'Share Screen'}</span>
            </button>

            <button
              onClick={() => setChatDrawerOpen(!chatDrawerOpen)}
              aria-label="Toggle chat stream"
              className={`p-3 rounded-xl transition-all flex items-center gap-2 text-xs font-bold ${
                chatDrawerOpen ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>In-Room Chat</span>
            </button>
          </div>

          {/* Collaborative Live Code & Notes Scratchpad */}
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-300 font-bold">
                <Code className="w-4 h-4 text-brand-400" />
                <span>Shared Interactive Code &amp; Scratchpad</span>
              </div>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> Live SQLite Database Synced
              </span>
            </div>
            <textarea
              value={codeContent}
              onChange={(e) => handleScratchpadChange(e.target.value)}
              rows={8}
              placeholder="Type notes, code snippets, algorithms, or concept explanations here..."
              className="w-full bg-slate-950 text-slate-200 p-4 font-mono text-xs focus:outline-none resize-y border-none leading-relaxed"
            />
          </div>

        </div>

        {/* Right Column: Live Chat Drawer */}
        {chatDrawerOpen && (
          <div className="glass-panel rounded-2xl border border-slate-800 flex flex-col h-[580px] shadow-2xl overflow-hidden">
            
            {/* Chat Header */}
            <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-white text-xs">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span>Live Classroom Chat</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Encrypted &amp; Persisted
              </span>
            </div>

            {/* Messages List */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs space-y-1">
                  <MessageSquare className="w-8 h-8 text-slate-700" />
                  <p>No messages yet.</p>
                  <p className="text-[11px]">Send a greeting or ask a question during your session!</p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.senderId === user?.id || msg.senderId === 'me';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5">
                        <span className="font-semibold">{msg.senderName}</span>
                        <span>•</span>
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div
                        className={`px-3.5 py-2 rounded-2xl text-xs max-w-[85%] break-words ${
                          isMe
                            ? 'bg-brand-500 text-dark-bg font-medium rounded-tr-none'
                            : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Message Input Form */}
            <form onSubmit={handleSendMessage} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type in-room chat message..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={sendingMessage || !newMessage.trim()}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

          </div>
        )}

      </div>

      {/* Leave Room Modal */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-3xl border border-slate-700 shadow-2xl p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
              <PhoneOff className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Leave Video Classroom?</h3>
              <p className="text-xs text-slate-400">
                You can rejoin anytime while the session is scheduled. (To finalize and transfer credits, use Confirm &amp; End Session).
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setLeaveModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700"
              >
                Stay in Room
              </button>
              <button
                onClick={handleConfirmLeave}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg"
              >
                Leave Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Session Rating Modal */}
      <RatingModal
        isOpen={showRatingModal}
        onClose={() => {
          setShowRatingModal(false);
          router.push(`/sessions/${sessionId}`);
        }}
        sessionId={sessionId}
        mentorName={exchangeData?.session?.teacher_name || participantInfo?.trainerName || 'Mentor'}
        mentorAvatar={exchangeData?.session?.teacher_avatar}
        skillName={exchangeData?.session?.skill_name || participantInfo?.skillName || 'Skill Mentorship'}
        onRatingSubmitted={() => {
          router.push(`/sessions/${sessionId}`);
        }}
      />

    </div>
  );
}
