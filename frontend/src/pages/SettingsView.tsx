import { useState } from 'react';
import { firebaseStatus, signInEmail, signUpEmail } from '../services/firebase';
import {
  IconShield,
  IconCpu,
  IconTerminal,
  IconCheck,
} from '../components/Icons';

interface SettingsViewProps {
  user: { uid: string; email?: string | null } | null;
  onSignOut: () => void;
  onAuthSuccess: (msg?: string) => void;
}

export default function SettingsView({ user, onSignOut, onAuthSuccess }: SettingsViewProps) {
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setLoading(true);
    try {
      if (authMode === 'register') {
        await signUpEmail(authEmail, authPassword);
        onAuthSuccess('Registered and authenticated successfully');
      } else {
        await signInEmail(authEmail, authPassword);
        onAuthSuccess('Signed in successfully');
      }
      setAuthPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setStatusMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF6A3D]" />
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
              PLATFORM SETTINGS
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            OPERATOR IDENTITY, CRYPTOGRAPHIC AUTHENTICATION, AND AGENT RUNTIMES
          </p>
        </div>
      </div>

      {/* User Identity Card */}
      <div className="p-6 rounded-2xl bg-[#0D0D12] border border-white/[0.07] space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
          <h2 className="font-display font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2">
            <IconShield className="w-4 h-4 text-[#FF6A3D]" />
            Authenticated Operator Identity
          </h2>
          <span className="text-[10px] font-mono text-slate-400">
            FIREBASE AUTH
          </span>
        </div>

        {user ? (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF6A3D] to-[#FF9A4D] p-[1px] shadow-[0_0_20px_rgba(255,106,61,0.3)]">
                <div className="w-full h-full rounded-[15px] bg-[#0A0A10] flex items-center justify-center font-display font-bold text-lg text-white">
                  {(user.email ?? 'O')[0].toUpperCase()}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-white">
                  {user.email ?? 'Authenticated Operator'}
                </div>
                <div className="text-xs font-mono text-slate-400">
                  UID: <span className="text-[#FF9A4D]">{user.uid}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono">
                <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cryptographic ID Token Active &amp; Validated</span>
              </div>
              <button
                onClick={onSignOut}
                className="btn-secondary py-1.5 px-4 text-xs font-mono uppercase text-slate-300 hover:text-white"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <p className="text-xs text-slate-400 leading-relaxed">
              Currently operating in anonymous guest mode. Sign in or register to encrypt and persist investigations to your dedicated Firestore account.
            </p>

            <form onSubmit={handleAuth} className="space-y-3 max-w-md">
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="Operator email address"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#07070A] border border-white/[0.1] text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#FF6A3D] transition-colors"
              />
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Secret key / password"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#07070A] border border-white/[0.1] text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#FF6A3D] transition-colors"
              />

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-agent py-2 px-5 text-xs uppercase font-bold"
                >
                  {loading ? 'Working…' : authMode === 'login' ? 'Sign In' : 'Register Operator'}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode((m) => (m === 'login' ? 'register' : 'login'))}
                  className="text-xs text-slate-400 hover:text-[#FF9A4D] transition-colors"
                >
                  Switch to {authMode === 'login' ? 'Register' : 'Login'}
                </button>
              </div>

              {statusMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs font-mono">
                  {statusMsg}
                </div>
              )}
            </form>
          </div>
        )}
      </div>

      {/* System Telemetry & Provider Status */}
      <div className="p-6 rounded-2xl bg-[#0D0D12] border border-white/[0.07] space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
          <h2 className="font-display font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2">
            <IconCpu className="w-4 h-4 text-[#FF6A3D]" />
            Agent Engine &amp; Runtimes Telemetry
          </h2>
          <span className="text-[10px] font-mono text-[#FF9A4D]">
            SYSTEM HEALTH
          </span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <span className="text-slate-400">Firebase Client Auth SDK</span>
            <span className="font-mono text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {firebaseStatus.configured ? 'Configured & Initialized' : 'Standby / Local Fallback'}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <span className="text-slate-400">Agent Framework</span>
            <span className="font-mono text-[#FF9A4D]">
              LangGraph 0.2 (Bounded Iterations + Deterministic Fallback)
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <span className="text-slate-400">Deterministic Tool Suite</span>
            <span className="font-mono text-[#FF6A3D]">
              benchmarkTool • calculatorTool • mockDataTool
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <span className="text-slate-400">Backend API Gateway</span>
            <span className="font-mono text-slate-200">
              Express / Node.js • Multi-user Token Verification
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
