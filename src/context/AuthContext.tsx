'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserProfile {
  id: string;
  email: string;
  role: 'STUDENT' | 'MODERATOR' | 'ADMIN';
  status: string;
  campusId?: string;
  display_name: string;
  avatar?: string;
  bio?: string;
  college?: string;
  major?: string;
  year?: string;
  is_verified_student: boolean;
  email_verified?: boolean;
  is_academic_email?: boolean;
  trust_score: number;
  completion_rate: number;
  cancellation_rate: number;
  balance: number;
  escrow_balance: number;
  lifetime_earned?: number;
  lifetime_spent?: number;
  bayesian_rating?: number;
  total_reviews?: number;
  total_sessions_taught?: number;
  total_sessions_learned?: number;
  reliability_score?: number;
  user_type?: string;
  teaching_preference?: string;
  daily_session_limit?: number;
  portfolio_url?: string;
  skill_visibility?: string;
  availability_visibility?: string;
  portfolio_visibility?: string;
  learning_goal_visibility?: string;
  profileCompletion?: {
    percentage: number;
    checklist: Array<{ label: string; completed: boolean }>;
  };
  skills?: any[];
  goals?: any[];
  unreadNotificationsCount?: number;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchDemoUser: (personaEmail: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string = 'Password123!') => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        await refreshUser();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const switchDemoUser = async (personaEmail: string) => {
    return login(personaEmail, 'Password123!');
  };

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, login, logout, switchDemoUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
