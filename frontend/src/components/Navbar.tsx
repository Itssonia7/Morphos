import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  user: { uid: string; email?: string | null } | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onSignOut: () => void;
  isDashboard?: boolean;
}

export default function Navbar({
  currentView,
  onNavigate,
  user,
  onOpenAuth,
  onSignOut,
  isDashboard = false,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'home', label: 'Home', href: '#hero' },
    { id: 'about', label: 'About', href: '#about' },
    { id: 'how-it-works', label: 'How It Works', href: '#how-it-works' },
    { id: 'features', label: 'Features', href: '#features' },
    { id: 'architecture', label: 'Architecture', href: '#architecture' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 glass-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1E110A] to-[#0D0805] border border-[#FF6A3D]/40 flex items-center justify-center font-display font-bold text-white text-base tracking-wider group-hover:border-[#FF6A3D] group-hover:shadow-[0_0_22px_rgba(255,106,61,0.45)] transition-all">
            <span className="bg-gradient-to-r from-[#FF6A3D] via-white to-[#FF9A4D] bg-clip-text text-transparent">
              M
            </span>
          </div>
          <span className="font-display font-bold text-lg tracking-[0.25em] text-[#F5F5F5] group-hover:text-white transition-colors">
            MORPHOS
          </span>
        </div>

        {/* Desktop Navigation */}
        {!isDashboard ? (
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className="relative text-xs tracking-widest uppercase font-medium text-[#A3A3A3] hover:text-white transition-colors py-1 group"
              >
                {item.label}
                {item.id === 'home' && (
                  <span className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#FF6A3D] to-[#FF9A4D] rounded-full shadow-[0_0_8px_rgba(255,106,61,0.6)]" />
                )}
                {item.id !== 'home' && (
                  <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-gradient-to-r from-[#FF6A3D] to-[#FF9A4D] rounded-full transition-all duration-300 group-hover:w-full group-hover:shadow-[0_0_8px_rgba(255,106,61,0.6)]" />
                )}
              </a>
            ))}
          </nav>
        ) : (
          <div className="hidden md:flex items-center gap-3 text-xs tracking-wider text-[#A3A3A3]">
            <span className="inline-block w-2 h-2 rounded-full bg-[#FF6A3D] animate-pulse" />
            <span className="text-white font-semibold">INVESTIGATION WORKSPACE</span>
          </div>
        )}

        {/* Right CTA / Auth */}
        <div className="hidden sm:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => onNavigate('dashboard')}
                className="text-xs uppercase tracking-wider font-semibold text-[#A3A3A3] hover:text-white transition-colors"
              >
                Dashboard
              </button>
              <div className="h-4 w-[1px] bg-white/10" />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold text-white">
                  {(user.email ?? 'U')[0].toUpperCase()}
                </div>
                <button
                  onClick={onSignOut}
                  className="text-xs text-[#A3A3A3] hover:text-rose-400 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => onOpenAuth('login')}
                className="text-xs tracking-wider uppercase font-semibold text-[#A3A3A3] hover:text-white transition-colors px-2 py-1"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  if (user) {
                    onNavigate('dashboard');
                  } else {
                    onOpenAuth('register');
                  }
                }}
                className="btn-pill-primary text-xs py-2 px-5"
              >
                Get Started
              </button>
            </div>
          )}

          {!isDashboard && (
            <button
              onClick={() => onNavigate('dashboard')}
              className="btn-pill-secondary text-xs py-2 px-5 font-mono"
            >
              Launch App →
            </button>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-[#8A8A8A] hover:text-white p-2"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#0A0A0A] border-b border-white/10 px-6 py-6 space-y-4"
          >
            {navLinks.map((item) => (
              <a
                key={item.id}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm tracking-wider uppercase font-medium text-[#8A8A8A] hover:text-[#FF7A00]"
              >
                {item.label}
              </a>
            ))}
            <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
              {user ? (
                <>
                  <button
                    onClick={() => {
                      onNavigate('dashboard');
                      setMobileMenuOpen(false);
                    }}
                    className="btn-primary w-full text-xs uppercase"
                  >
                    Open Workspace
                  </button>
                  <button
                    onClick={() => {
                      onSignOut();
                      setMobileMenuOpen(false);
                    }}
                    className="btn-secondary w-full text-xs uppercase"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      onOpenAuth('login');
                      setMobileMenuOpen(false);
                    }}
                    className="btn-secondary w-full text-xs uppercase"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      onOpenAuth('register');
                      setMobileMenuOpen(false);
                    }}
                    className="btn-primary w-full text-xs uppercase"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
