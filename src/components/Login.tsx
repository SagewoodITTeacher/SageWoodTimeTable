import React, { useState } from 'react';
import { Teacher } from '../types';
import { LayoutDashboard, LogIn, Mail, Lock, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLogin: (email: string, password: string) => void;
  error?: string | null;
}

export default function Login({ onLogin, error }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email.trim().toLowerCase(), password);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-gray-50 to-white">
      <div className="max-w-md w-full bg-white rounded-[2rem] p-10 shadow-2xl shadow-blue-900/10 border border-white flex flex-col items-center">
        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-blue-500/20 rotate-3 border-b-4 border-red-600">
          <LayoutDashboard className="w-10 h-10 text-white" />
        </div>
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight italic uppercase">Curro Hub</h1>
          <p className="text-gray-500 font-medium leading-relaxed">
            Invigilation Management System <br/>
            <span className="text-xs uppercase tracking-widest text-blue-600 font-black">Staff Authentication</span>
          </p>
        </div>

        {error && (
          <div className="w-full mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold animate-shake">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Staff Email</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name.surname@curro.co.za"
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-600 outline-none transition-all font-medium text-gray-900 placeholder:text-gray-300"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Password</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-600 outline-none transition-all font-medium text-gray-900 placeholder:text-gray-300"
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white rounded-2xl py-4 font-bold hover:bg-blue-700 transition-all group active:scale-95 shadow-lg shadow-blue-600/20 mt-4"
          >
            <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            Sign In
          </button>
        </form>

        <p className="mt-8 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
          Curro South Africa • Authorized Access Only
        </p>
      </div>
    </div>
  );
}
