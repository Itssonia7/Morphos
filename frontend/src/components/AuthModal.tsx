import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signInEmail, signUpEmail, resetPassword, firebaseStatus } from '../services/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onSuccess: (message?: string) => void;
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = 'login',
  onSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setErrorMessage(null);
  }, [initialMode, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (mode === 'forgot') {
      setLoading(true);
      try {
        await resetPassword(email.trim());
        setErrorMessage(null);
        // Show success in the error box (re-use the styled box with a neutral message)
        setErrorMessage('✓ Password reset email sent. Check your inbox (and spam folder).');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to send reset email';
        if (msg.includes('user-not-found')) {
          setErrorMessage('No account found with that email address.');
        } else if (msg.includes('Firebase authentication is not configured')) {
          setErrorMessage('Firebase is not configured — cannot send reset email.');
        } else {
          setErrorMessage(msg);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        await signUpEmail(email, password);
        onSuccess('Account created successfully');
      } else {
        await signInEmail(email, password);
        onSuccess('Signed in successfully');
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      if (msg.includes('Firebase authentication is not configured')) {
        setErrorMessage(
          'Firebase credentials are not configured in your environment (.env). In local testing mode, you can still test investigations with the Try Demo button in the workspace!'
        );
      } else if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setErrorMessage('Invalid email or password. Please check your credentials.');
      } else if (msg.includes('email-already-in-use')) {
        setErrorMessage('This email is already registered. Please sign in instead.');
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            className="relative w-full max-w-md glass-panel bg-[#0A0A0A]/95 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.95)] z-10 backdrop-blur-xl"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-[#8A8A8A] hover:text-white transition-colors text-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF6A3D] rounded-full w-8 h-8 flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.1]"
              aria-label="Close modal"
            >
              ✕
            </button>

            {/* Brand Header */}
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-7 h-7 rounded-lg bg-[#FF6A3D]/20 border border-[#FF6A3D]/40 flex items-center justify-center font-display font-bold text-white text-xs shadow-[0_0_12px_rgba(255,106,61,0.3)]">
                M
              </div>
              <span className="font-display font-bold text-xs tracking-[0.25em] text-[#F5F5F5] uppercase">
                MORPHOS ACCESS
              </span>
            </div>

            {/* Title */}
            <h3 id="auth-modal-title" className="font-display font-bold text-2xl text-white mb-2 tracking-tight">
              {mode === 'login' && 'Sign in to MORPHOS'}
              {mode === 'register' && 'Create your account'}
              {mode === 'forgot' && 'Reset your password'}
            </h3>


            <p className="text-xs text-[#8A8A8A] mb-6 leading-relaxed">
              {mode === 'login' && 'Enter your credentials to access your autonomous investigations.'}
              {mode === 'register' && 'Start running empirical AI experiments with full audit tracking.'}
              {mode === 'forgot' && 'Enter your verified email to receive a password reset link.'}
            </p>

            {/* Status Message (error = red, success = green) */}
            {errorMessage && (
              <div className={`mb-5 p-3 rounded-xl text-xs leading-relaxed ${
                errorMessage.startsWith('✓')
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
                  : 'bg-red-500/10 border border-red-500/30 text-red-200'
              }`}>
                {errorMessage}
              </div>
            )}

            {/* Firebase Config Notice */}
            {!firebaseStatus.configured && (
              <div className="mb-5 p-3 rounded-xl bg-[#FF6A3D]/10 border border-[#FF6A3D]/25 text-[#FF9A4D] text-[11px] leading-relaxed">
                ℹ️ Firebase credentials are not yet defined in .env. You can still test full investigations using the <strong>Try Demo</strong> mode in the workspace!
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[#8A8A8A] mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@company.com"
                  required
                  className="w-full px-4 py-2.5 rounded-full bg-black/60 border border-white/10 text-white placeholder-[#555555] text-xs focus:outline-none focus:border-[#FF6A3D] focus:ring-1 focus:ring-[#FF6A3D] transition-colors"
                />
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-[#8A8A8A]">
                      Password
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="text-[11px] text-[#8A8A8A] hover:text-[#FF6A3D] transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-2.5 rounded-full bg-black/60 border border-white/10 text-white placeholder-[#555555] text-xs focus:outline-none focus:border-[#FF6A3D] focus:ring-1 focus:ring-[#FF6A3D] transition-colors"
                  />
                </div>
              )}

              {mode === 'register' && (
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-[#8A8A8A] mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-2.5 rounded-full bg-black/60 border border-white/10 text-white placeholder-[#555555] text-xs focus:outline-none focus:border-[#FF6A3D] focus:ring-1 focus:ring-[#FF6A3D] transition-colors"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-pill-primary py-3 text-xs uppercase tracking-wider font-bold mt-2 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <span>
                    {mode === 'login' && 'Sign In'}
                    {mode === 'register' && 'Create Account'}
                    {mode === 'forgot' && 'Send Reset Link'}
                  </span>
                )}
              </button>
            </form>

            {/* Toggle Modes */}
            <div className="mt-6 pt-5 border-t border-white/[0.08] text-center text-xs text-[#8A8A8A]">
              {mode === 'login' ? (
                <div>
                  Don&apos;t have an account?{' '}
                  <button
                    onClick={() => {
                      setMode('register');
                      setErrorMessage(null);
                    }}
                    className="text-white hover:text-[#FF6A3D] font-semibold underline underline-offset-4 ml-1 transition-colors"
                  >
                    Sign up
                  </button>
                </div>
              ) : (
                <div>
                  Already have an account?{' '}
                  <button
                    onClick={() => {
                      setMode('login');
                      setErrorMessage(null);
                    }}
                    className="text-white hover:text-[#FF6A3D] font-semibold underline underline-offset-4 ml-1 transition-colors"
                  >
                    Sign in
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
