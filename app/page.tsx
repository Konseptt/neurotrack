'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Brain, ArrowRight } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { currentUser, login } = useAppStore();
  const [email, setEmail] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    if (currentUser && mounted) {
      router.push('/dashboard');
    }
  }, [currentUser, router, mounted]);

  if (!mounted) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      login(email.trim());
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 space-y-8 border border-gray-100">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mb-4">
            <Brain className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">NeuroTrack</h1>
          <p className="text-gray-500">Minimal Migraine Tracking MVP</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gray-900 text-white font-medium py-4 rounded-xl shadow-lg hover:bg-gray-800 transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
          >
            <span>Continue</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <div className="text-center text-xs text-gray-400 mt-8">
          <p>Class Submission Version</p>
          <p>No real data is stored on servers.</p>
        </div>
      </div>
    </div>
  );
}
