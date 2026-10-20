import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

interface PrivacyPageProps {
  onNavigateHome: () => void;
  onOpenWorkspace: () => void;
  user: { uid: string; email?: string | null } | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onSignOut: () => void;
}

export default function PrivacyPage({
  onNavigateHome,
  onOpenWorkspace,
  user,
  onOpenAuth,
  onSignOut,
}: PrivacyPageProps) {
  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F5F5] selection:bg-[#FF7A00]/30 selection:text-white flex flex-col justify-between">
      <Navbar
        currentView="privacy"
        onNavigate={(view) => {
          if (view === 'landing') onNavigateHome();
          else if (view === 'dashboard') onOpenWorkspace();
        }}
        user={user}
        onOpenAuth={onOpenAuth}
        onSignOut={onSignOut}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 w-full flex-1">
        {/* Header HUD */}
        <div className="mb-12 border-b border-white/[0.08] pb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-2 h-2 rounded-full bg-[#FF6A3D] animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#FF6A3D]">
              LEGAL & DATA GOVERNANCE
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-extrabold tracking-tight text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-sm font-mono text-[#8A8A8A]">
            LAST REVISED: SEPTEMBER 2026 • REVISION 1.0.0
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-10 text-sm leading-relaxed text-[#B0B0B0]">
          <section className="p-6 rounded-2xl bg-[#0A0A0A] border border-white/[0.06]">
            <h2 className="text-base font-display font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-[#FF7A00] font-mono text-xs">01 /</span> 
              Overview & Scope
            </h2>
            <p>
              MORPHOS (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;the platform&rdquo;) is an autonomous AI experimentation engine designed to investigate technical inquiries through structured hypothesis formulation and simulated experiments. This Privacy Policy details how we collect, store, process, and protect your information when utilizing MORPHOS.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-[#0A0A0A] border border-white/[0.06]">
            <h2 className="text-base font-display font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-[#FF7A00] font-mono text-xs">02 /</span> 
              Information We Collect
            </h2>
            <ul className="list-disc list-inside space-y-2 text-[#999999]">
              <li>
                <strong className="text-white">Authentication & Account Credentials:</strong> When you register via Firebase Authentication, we store your email address, unique user ID (UID), and authentication timestamps. We never store raw passwords on our servers.
              </li>
              <li>
                <strong className="text-white">Investigation Queries & System Inputs:</strong> Technical inquiries, system parameters, and problem descriptions submitted into the MORPHOS prompt interface.
              </li>
              <li>
                <strong className="text-white">Generated Investigation Telemetry:</strong> Machine-generated hypotheses, synthetic experimental parameters, simulation outputs, analysis matrices, and final Bayesian confidence scores.
              </li>
              <li>
                <strong className="text-white">Session & Storage Data:</strong> Authentication tokens (JWTs) stored in client-side storage (<code className="text-xs font-mono text-[#FF7A00]">localStorage</code>) to maintain active login sessions across platform reloads.
              </li>
            </ul>
          </section>

          <section className="p-6 rounded-2xl bg-[#0A0A0A] border border-white/[0.06]">
            <h2 className="text-base font-display font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-[#FF7A00] font-mono text-xs">03 /</span> 
              Firestore Database Storage & User Isolation
            </h2>
            <p className="mb-3">
              All investigation records are stored in Google Cloud Firestore. Every investigation document is cryptographically bound to the author&rsquo;s authenticated Firebase UID.
            </p>
            <div className="p-4 rounded-xl bg-black border border-white/[0.08] font-mono text-xs text-[#8A8A8A]">
              Security Rule Enforcement: Access to investigation records is strictly isolated at the database rules layer. No user can read, query, update, or delete records belonging to another UID.
            </div>
          </section>

          <section className="p-6 rounded-2xl bg-[#0A0A0A] border border-white/[0.06]">
            <h2 className="text-base font-display font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-[#FF7A00] font-mono text-xs">04 /</span> 
              AI & Upstream Processing (Gemini & LangGraph)
            </h2>
            <p>
              When live AI processing is enabled, investigation prompts are evaluated using Google Gemini models orchestrated through LangChain / LangGraph. Prompts are transmitted securely via server-to-server TLS connections using server-side API keys. In demo mode or when LLM upstream APIs are unconfigured, MORPHOS runs entirely within its local deterministic engine without external API calls.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-[#0A0A0A] border border-white/[0.06]">
            <h2 className="text-base font-display font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-[#FF7A00] font-mono text-xs">05 /</span> 
              Cookies & Local Storage Usage
            </h2>
            <p>
              MORPHOS does <strong className="text-white">not</strong> utilize third-party advertising cookies, tracker pixels, or cross-site tracking scripts. We utilize strictly necessary client storage (<code className="text-xs font-mono text-[#FF7A00]">localStorage</code> / <code className="text-xs font-mono text-[#FF7A00]">indexedDB</code>) solely for:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-[#999999]">
              <li>Firebase authentication session state and ID tokens.</li>
              <li>Local user preferences (sidebar collapse state, theme tokens).</li>
              <li>Optional local audit history cache.</li>
            </ul>
          </section>

          <section className="p-6 rounded-2xl bg-[#0A0A0A] border border-white/[0.06]">
            <h2 className="text-base font-display font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-[#FF7A00] font-mono text-xs">06 /</span> 
              Data Retention & User Rights (Deletion)
            </h2>
            <p>
              You maintain full authority over your investigation data. You can delete individual investigation runs directly from the MORPHOS Workspace History view. Upon clicking delete, records are permanently removed from Firestore. To request complete removal of your Firebase account, contact our support team.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-[#0A0A0A] border border-white/[0.06]">
            <h2 className="text-base font-display font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-[#FF7A00] font-mono text-xs">07 /</span> 
              Security Practices
            </h2>
            <p>
              We implement defense-in-depth principles:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-[#999999]">
              <li>HTTPS/TLS encryption in transit across all client and API communication.</li>
              <li>Helmet HTTP security headers protecting against XSS, clickjacking, and MIME sniffing.</li>
              <li>Strict per-IP and per-UID rate limiting on expensive inference endpoints.</li>
              <li>Server-side token verification using Google Firebase Admin SDK before granting resource access.</li>
              <li>No sensitive AI keys, database credentials, or private keys are ever delivered to client browsers.</li>
            </ul>
          </section>

          <section className="p-6 rounded-2xl bg-[#0A0A0A] border border-white/[0.06]">
            <h2 className="text-base font-display font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-[#FF7A00] font-mono text-xs">08 /</span> 
              Contact & Inquiries
            </h2>
            <p>
              For questions concerning this Privacy Policy, data privacy practices, or data deletion requests, please reach out via our support channel:
            </p>
            <div className="mt-3 p-3 rounded-lg bg-black border border-white/[0.08] font-mono text-xs text-[#FF7A00]">
              support@morphos.ai
            </div>
          </section>
        </div>

        {/* Action button */}
        <div className="mt-12 pt-8 border-t border-white/[0.08] flex items-center justify-between">
          <button
            onClick={onNavigateHome}
            className="text-xs font-mono uppercase tracking-wider text-[#8A8A8A] hover:text-white transition-colors"
          >
            ← Return to Overview
          </button>
          <button
            onClick={onOpenWorkspace}
            className="btn-primary py-2.5 px-6 text-xs uppercase tracking-wider font-bold"
          >
            Open Workspace →
          </button>
        </div>
      </main>

      <Footer onNavigate={(view) => {
        if (view === 'dashboard') onOpenWorkspace();
        else onNavigateHome();
      }} />
    </div>
  );
}
