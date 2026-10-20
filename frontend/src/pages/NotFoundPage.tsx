import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

interface NotFoundPageProps {
  onNavigateHome: () => void;
  onOpenWorkspace: () => void;
  user: { uid: string; email?: string | null } | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onSignOut: () => void;
}

export default function NotFoundPage({
  onNavigateHome,
  onOpenWorkspace,
  user,
  onOpenAuth,
  onSignOut,
}: NotFoundPageProps) {
  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F5F5] selection:bg-[#FF7A00]/30 selection:text-white flex flex-col justify-between">
      <Navbar
        currentView="404"
        onNavigate={(view) => {
          if (view === 'landing') onNavigateHome();
          else if (view === 'dashboard') onOpenWorkspace();
        }}
        user={user}
        onOpenAuth={onOpenAuth}
        onSignOut={onSignOut}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-20 w-full flex-1 flex flex-col items-center justify-center text-center">
        {/* HUD Warning Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-xs font-mono text-red-400 mb-6">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span className="tracking-widest uppercase font-semibold">ERROR CODE: 404 • TELEMETRY DISCONNECTED</span>
        </div>

        {/* Large 404 Display */}
        <h1 className="text-7xl sm:text-9xl font-display font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white/80 to-white/10 mb-4 select-none">
          404
        </h1>

        <div className="text-xl sm:text-2xl font-mono uppercase tracking-[0.25em] text-[#FF6A3D] font-bold mb-4">
          SIGNAL LOST
        </div>

        <p className="text-sm sm:text-base text-[#A3A3A3] max-w-md mx-auto leading-relaxed mb-10">
          The investigation you&rsquo;re looking for doesn&rsquo;t exist, was deleted from Firestore, or has expired beyond the platform telemetry horizon.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={onNavigateHome}
            className="btn-pill-secondary py-3 px-8 text-xs font-mono uppercase tracking-wider font-semibold w-full sm:w-auto"
          >
            ← Return Home
          </button>
          <button
            onClick={onOpenWorkspace}
            className="btn-pill-primary py-3 px-8 text-xs font-mono uppercase tracking-wider font-bold w-full sm:w-auto"
          >
            Open Workspace →
          </button>
        </div>

        {/* Decorative Grid Diagnostic Block */}
        <div className="mt-16 w-full max-w-md p-4 rounded-xl bg-[#0A0A0A] border border-white/[0.06] text-left font-mono text-[11px] text-[#666666] space-y-1">
          <div className="text-[#888888] flex items-center justify-between pb-1 border-b border-white/[0.06]">
            <span>ROUTER DIAGNOSTICS</span>
            <span className="text-red-400">UNRESOLVED_PATH</span>
          </div>
          <div>STATUS: 404 NOT_FOUND</div>
          <div>PATH: {typeof window !== 'undefined' ? window.location.pathname : '/unknown'}</div>
          <div>SUGGESTION: Return to workspace or initialize a new hypothesis run.</div>
        </div>
      </main>

      <Footer onNavigate={(view) => {
        if (view === 'dashboard') onOpenWorkspace();
        else onNavigateHome();
      }} />
    </div>
  );
}
