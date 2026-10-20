export default function Footer({ onNavigate }: { onNavigate: (view: string) => void }) {
  return (
    <footer className="bg-[#050505] border-t border-white/[0.08] py-16 relative z-10 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/[0.06]">
          {/* Brand Column */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1E2235] to-[#0D0F17] border border-white/10 flex items-center justify-center font-display font-bold text-white text-sm shadow-[0_0_15px_rgba(255,106,61,0.2)]">
                <span className="bg-gradient-to-r from-[#FF6A3D] to-[#FF9A4D] bg-clip-text text-transparent">
                  M
                </span>
              </div>
              <span className="font-display font-bold text-lg tracking-[0.25em] text-[#F5F5F5]">
                MORPHOS
              </span>
            </div>
            <p className="text-[#A3A3A3] max-w-sm text-xs leading-relaxed">
              Autonomous AI Experimentation Platform. An AI system that learns by experimenting.
              Turn your questions into structured investigations.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-mono text-[#A3A3A3]">SYSTEM STATUS: ALL SYSTEMS NOMINAL</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-2 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#666666] font-semibold">
              NAVIGATION
            </div>
            <ul className="space-y-2 text-[#A3A3A3]">
              <li><a href="#hero" className="hover:text-white transition-colors">Home</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
              <li>
                <button onClick={() => onNavigate('dashboard')} className="hover:text-[#FF6A3D] transition-colors">
                  Dashboard
                </button>
              </li>
            </ul>
          </div>

          {/* Technology */}
          <div className="md:col-span-2 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#555555] font-semibold">
              PLATFORM
            </div>
            <ul className="space-y-2 text-[#8A8A8A]">
              <li><span className="hover:text-white transition-colors">LangGraph 0.2</span></li>
              <li><span className="hover:text-white transition-colors">Gemini 3.6 Flash</span></li>
              <li><span className="hover:text-white transition-colors">Firebase Auth</span></li>
              <li><span className="hover:text-white transition-colors">Firestore Storage</span></li>
            </ul>
          </div>

          {/* Connect */}
          <div className="md:col-span-3 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#555555] font-semibold">
              RESOURCES
            </div>
            <ul className="space-y-2 text-[#8A8A8A]">
              <li><a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub Repository ↗</a></li>
              <li><a href="/api/health" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Backend Health Check ↗</a></li>
              <li><span className="text-[#555555]">Documentation (v1.0.0)</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[#555555] text-[11px]">
          <div>
            © {new Date().getFullYear()} MORPHOS AI. All rights reserved.
          </div>
          <nav aria-label="Legal links" className="flex items-center gap-6">
            <button
              onClick={() => onNavigate('privacy')}
              className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF7A00]"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => onNavigate('terms')}
              className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF7A00]"
            >
              Terms &amp; Conditions
            </button>
            <button
              onClick={() => onNavigate('privacy')}
              className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF7A00]"
            >
              Security
            </button>
          </nav>
        </div>
      </div>
    </footer>
  );
}

