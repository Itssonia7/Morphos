import { subscribeToGraphUpdates } from './services/socket';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  deleteInvestigation,
  getAnalytics,
  getInvestigationById,
  getInvestigations,
  investigate,
} from './services/api';
import {
  getCurrentUserToken,
  signOutUser,
  subscribeToAuth,
} from './services/firebase';
import {
  InvestigationRecord,
  InvestigationResponse,
  AnalyticsState,
  ViewId,
} from './types';

// Components & Pages
import LandingPage from './pages/LandingPage';
import DashboardView from './pages/DashboardView';
import InvestigationWorkspace from './pages/InvestigationWorkspace';
import HistoryView from './pages/HistoryView';
import ExperimentsView from './pages/ExperimentsView';
import AnalyticsView from './pages/AnalyticsView';
import SettingsView from './pages/SettingsView';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import NotFoundPage from './pages/NotFoundPage';

import { generateDomainInvestigation } from './services/domain';

import Sidebar from './components/Sidebar';
import AuthModal from './components/AuthModal';
import DemoInvestigationModal from './components/DemoInvestigationModal';
import CookieConsentBanner from './components/CookieConsentBanner';
import MorphosAgentCopilot from './components/MorphosAgentCopilot';
import AgentExecutionModal from './components/AgentExecutionModal';
import { trackEvent } from './services/analytics';
import { IconMenu, IconClose, IconBot } from './components/Icons';

const DEMO_INVESTIGATION_DATA: InvestigationRecord = {
  id: 'demo-latency-01',
  question: 'Why is API latency increasing under high request concurrency?',
  interpretedProblem: 'System experiences severe latency degradation and worker socket exhaustion as client concurrency exceeds 50 simultaneous connections.',
  status: 'finalized',
  confidence: 0.87,
  iteration: 3,
  maxIterations: 5,
  selectedHypothesis: {
    id: 'h1',
    title: 'Database connection pool exhaustion',
    rationale: 'Persistent thread locks cause connection starvation under elevated query concurrency.',
    confidence: 0.72,
    evidence: [
      'Active database sockets reached maximum limit (50/50)',
      'Worker wait queue backlog escalated to 312 pending queries',
      'CPU saturation remained normal at 41%, ruling out compute starvation',
    ],
  },
  hypotheses: [
    {
      id: 'h1',
      title: 'Database connection pool exhaustion',
      rationale: 'Persistent thread locks cause connection starvation under elevated query concurrency.',
      confidence: 0.72,
      evidence: ['Socket pool capacity reached 50/50', 'Wait queue length spiked to 312'],
    },
    {
      id: 'h2',
      title: 'External API downstream latency',
      rationale: 'Third-party payment gateway timeout delays cascade into caller worker threads.',
      confidence: 0.54,
      evidence: ['P99 response time spikes on external calls'],
    },
    {
      id: 'h3',
      title: 'CPU saturation on worker nodes',
      rationale: 'Compute thread contention during garbage collection cycles.',
      confidence: 0.31,
      evidence: ['GC pause spikes correlating with latency degradation'],
    },
  ],
  experiment: {
    id: 'exp-01',
    name: 'Benchmark API response time',
    tool: 'benchmarkTool',
    description: 'Execute synthetic concurrent requests to measure latency curve against connection limits.',
    inputs: {
      concurrency: 50,
      duration_sec: 10,
      target_endpoint: '/api/v1/query',
    },
  },
  experimentResult: {
    metric: 'response_latency_ms',
    baseline_p99: 142.4,
    observed_p99: 196.5,
    deviation_pct: '+38.0%',
    connection_pool_active: 50,
    connection_pool_limit: 50,
    wait_queue_length: 312,
    exit_code: 0,
    outcome: 'Latency increased by 38.0% as socket pool capacity was exhausted.',
  },
  analysis: 'Real-time load profiling confirmed that as request concurrency escalated past 50 simultaneous connections, worker threads stalled awaiting available database sockets. The +38% latency spike is directly attributed to thread queue starvation rather than raw CPU or disk I/O limits.',
  finalConclusion: 'The strongest evidence points toward database connection pool exhaustion under elevated request concurrency.',
  events: [
    { node: 'interpretQuestion', message: 'Question parsed and problem boundaries defined', timestamp: '2026-09-28T22:01:05.100Z', type: 'node_completed' },
    { node: 'generateHypotheses', message: 'Formulated 3 candidate hypotheses via structured reasoning', timestamp: '2026-09-28T22:01:06.400Z', type: 'node_completed' },
    { node: 'selectExperiment', message: 'Selected benchmarkTool for concurrency profiling', timestamp: '2026-09-28T22:01:07.200Z', type: 'node_completed' },
    { node: 'executeExperiment', message: 'Benchmark sandbox executed with 50 concurrent threads', timestamp: '2026-09-28T22:01:08.900Z', type: 'node_completed' },
    { node: 'analyzeResults', message: 'Analyzed telemetry: observed +38.0% P99 latency spike', timestamp: '2026-09-28T22:01:09.500Z', type: 'node_completed' },
    { node: 'evaluateConfidence', message: 'Updated Bayesian confidence to 87% (threshold >= 70% reached)', timestamp: '2026-09-28T22:01:10.100Z', type: 'node_completed' },
    { node: 'finalize', message: 'Finalized executive conclusion and audit record stored in Firestore', timestamp: '2026-09-28T22:01:10.800Z', type: 'node_completed' },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function resolveRoute(path: string): {
  mode: 'landing' | 'workspace' | 'privacy' | 'terms' | '404';
  view?: ViewId;
  investigationId?: string;
} {
  const cleanPath = path.split('?')[0].split('#')[0];
  if (cleanPath === '/' || cleanPath === '') {
    return { mode: 'landing' };
  }
  if (cleanPath === '/privacy') {
    return { mode: 'privacy' };
  }
  if (cleanPath === '/terms') {
    return { mode: 'terms' };
  }
  if (cleanPath === '/workspace') {
    return { mode: 'workspace', view: 'overview' };
  }
  if (cleanPath === '/history' || cleanPath === '/investigations') {
    return { mode: 'workspace', view: 'investigations' };
  }
  if (cleanPath === '/experiments') {
    return { mode: 'workspace', view: 'experiments' };
  }
  if (cleanPath === '/analytics') {
    return { mode: 'workspace', view: 'analytics' };
  }
  if (cleanPath === '/settings') {
    return { mode: 'workspace', view: 'profile' };
  }
  const match = cleanPath.match(/^\/investigations\/([^/]+)$/);
  if (match) {
    return { mode: 'workspace', view: 'investigations', investigationId: match[1] };
  }
  return { mode: '404' };
}

export default function App() {
  // Navigation & View State
  const [appMode, setAppMode] = useState<'landing' | 'workspace' | 'privacy' | 'terms' | '404'>(() => {
    return resolveRoute(window.location.pathname).mode;
  });
  const [activeWorkspaceView, setActiveWorkspaceView] = useState<ViewId>(() => {
    return resolveRoute(window.location.pathname).view ?? 'overview';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // User & Auth State
  const [user, setUser] = useState<{ uid: string; email?: string | null } | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'login' | 'register'>('login');
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  // Investigation Workspace State
  const [question, setQuestion] = useState('Why is API latency increasing?');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentInvestigation, setCurrentInvestigation] = useState<InvestigationRecord | null>(null);

  // Firestore History & Analytics
  const [history, setHistory] = useState<InvestigationRecord[]>(() => {
    try {
      const saved = localStorage.getItem('morphos_guest_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [analytics, setAnalytics] = useState<AnalyticsState>({
    totalInvestigations: 0,
    completedInvestigations: 0,
    averageConfidence: 0,
    averageIterations: 0,
    totalExperiments: 0,
    completionRate: 0,
    confidenceDistribution: { high: 0, medium: 0, low: 0 },
    experimentOutcomes: { completed: 0, failed: 0, running: 0 },
    investigationsOverTime: [],
    iterationsPerInvestigation: [],
  });

  // Toasts
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }>>([]);

  const pushToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Subscribe to Firebase Auth
  useEffect(() => {
    const unsubscribe = subscribeToAuth((nextUser) => {
      setUser(nextUser ? { uid: nextUser.uid, email: nextUser.email } : null);
    });
    return unsubscribe;
  }, []);

  // Fetch History & Analytics when user is signed in
  const loadUserData = useCallback(async () => {
    const token = await getCurrentUserToken();
    if (!token) return;

    try {
      const [items, stats] = await Promise.allSettled([
        getInvestigations(token),
        getAnalytics(token),
      ]);

      if (items.status === 'fulfilled' && Array.isArray(items.value)) {
        // Correctly set history even if empty list is returned
        setHistory(items.value as InvestigationRecord[]);
      }

      if (stats.status === 'fulfilled' && stats.value) {
        setAnalytics(stats.value as AnalyticsState);
      }
    } catch (e) {
      console.warn('Failed to load user history from backend', e);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void loadUserData();
    }
  }, [user, loadUserData]);

  // URL Deep-linking handler
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const tabParam = params.get('tab') as ViewId | null;
    const invParam = params.get('investigation');

    const handleNavigation = (path: string) => {
      const resolved = resolveRoute(path);
      setAppMode(resolved.mode);
      if (resolved.view) {
        setActiveWorkspaceView(resolved.view);
      }
      if (resolved.investigationId) {
        void openInvestigationById(resolved.investigationId);
      }
    };

    if (modeParam === 'workspace') {
      setAppMode('workspace');
      if (tabParam) setActiveWorkspaceView(tabParam);
    } else if (invParam) {
      setAppMode('workspace');
      void openInvestigationById(invParam);
    } else {
      handleNavigation(window.location.pathname);
    }

    // Sync popstate (browser back/forward button)
    const handlePopState = () => {
      handleNavigation(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update dynamic document title and analytics on view change
  useEffect(() => {
    if (appMode === 'privacy') {
      document.title = 'Privacy Policy — MORPHOS';
    } else if (appMode === 'terms') {
      document.title = 'Terms & Conditions — MORPHOS';
    } else if (appMode === '404') {
      document.title = '404 Not Found — MORPHOS';
    } else if (appMode === 'workspace') {
      if (currentInvestigation) {
        document.title = 'Investigation Detail — MORPHOS';
      } else if (activeWorkspaceView === 'investigations') {
        document.title = 'Investigation History — MORPHOS';
      } else if (activeWorkspaceView === 'analytics') {
        document.title = 'Analytics & Telemetry — MORPHOS';
      } else if (activeWorkspaceView === 'experiments') {
        document.title = 'Experiments — MORPHOS';
      } else if (activeWorkspaceView === 'profile') {
        document.title = 'Settings — MORPHOS';
      } else {
        document.title = 'Workspace — MORPHOS';
      }
    } else {
      document.title = 'MORPHOS — Autonomous AI Experimentation Platform';
      trackEvent({ name: 'landing_page_view' });
    }
  }, [appMode, activeWorkspaceView, currentInvestigation]);

  const openInvestigationById = async (id: string) => {
    if (!id) return;

    // Check memory history first
    const existing = history.find((h) => String(h.id) === id);
    if (existing) {
      setCurrentInvestigation(existing);
      setAppMode('workspace');
      setActiveWorkspaceView('investigations');
      window.history.pushState({}, '', `/investigations/${id}`);
      return;
    }

    if (id === 'demo-latency-01') {
      setCurrentInvestigation(DEMO_INVESTIGATION_DATA);
      setAppMode('workspace');
      setActiveWorkspaceView('investigations');
      window.history.pushState({}, '', `/investigations/${id}`);
      return;
    }

    const token = await getCurrentUserToken();
    if (!token) {
      // Look up guest storage
      try {
        const saved = localStorage.getItem('morphos_guest_history');
        if (saved) {
          const parsed: InvestigationRecord[] = JSON.parse(saved);
          const found = parsed.find((item) => String(item.id) === id);
          if (found) {
            setCurrentInvestigation(found);
            setAppMode('workspace');
            setActiveWorkspaceView('investigations');
            window.history.pushState({}, '', `/investigations/${id}`);
            return;
          }
        }
      } catch {}
      pushToast('Investigation record not found locally.', 'info');
      return;
    }

    try {
      setLoading(true);
      const data = await getInvestigationById(id, token);
      const record = data as InvestigationRecord;
      record.id = record.id || id;
      setCurrentInvestigation(record);
      setAppMode('workspace');
      setActiveWorkspaceView('investigations');
      window.history.pushState({}, '', `/investigations/${id}`);
    } catch {
      pushToast('Could not load specified investigation.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Start Investigation
  const handleStartInvestigation = async () => {
    const trimmed = question.trim();
    if (!trimmed || trimmed.length < 8) {
      setError('Please provide a question with at least 8 characters to investigate.');
      pushToast('Investigation question is too short', 'error');
      return;
    }
    if (trimmed.length > 1000) {
      setError('Investigation question cannot exceed 1000 characters.');
      pushToast('Question is too long (max 1000 characters)', 'error');
      return;
    }

    setLoading(true);
    setError(null);
    trackEvent({ name: 'investigation_started', questionLength: trimmed.length });

    const token = await getCurrentUserToken();

    // If user is authenticated, call the real backend POST /api/investigate
    if (token) {
      const unsubscribeTelemetry = subscribeToGraphUpdates(token, () => {});
      try {
        const result = await investigate(trimmed, token);
        const finalRecord: InvestigationRecord = {
          ...result,
          id: result.id,
          question: trimmed,
          domain: result.domain,
          resultStatus: result.resultStatus || 'simulated',
          isLocal: false,
        };
        trackEvent({
          name: 'investigation_completed',
          iterations: Number(finalRecord.iteration ?? 1),
          confidenceTier: Number(finalRecord.confidence ?? 0) >= 0.7 ? 'high' : Number(finalRecord.confidence ?? 0) >= 0.4 ? 'medium' : 'low',
          mode: 'firebase',
        });
        setCurrentInvestigation(finalRecord);
        setHistory((prev) => [finalRecord, ...prev.filter((h) => h.id !== finalRecord.id)]);
        setAppMode('workspace');
        setActiveWorkspaceView('investigations');
        window.history.pushState({}, '', `/investigations/${finalRecord.id}`);
        pushToast('Investigation completed successfully', 'success');
        void loadUserData();
      } catch (err: unknown) {
        console.error('Backend investigation error, running local fallback:', err);
        trackEvent({ name: 'investigation_failed', reason: 'backend_error' });
        // Fallback to local domain engine if backend is offline or quota exceeded
        handleLocalInvestigationRun(trimmed);
      } finally {
        unsubscribeTelemetry();
        setLoading(false);
      }
    } else {
      // Local domain-aware deterministic mode (when running in guest mode without Firebase Auth)
      handleLocalInvestigationRun(trimmed);
    }
  };

  const handleLocalInvestigationRun = (promptText: string) => {
    setTimeout(() => {
      const newRecord = generateDomainInvestigation(promptText, undefined, true);
      setCurrentInvestigation(newRecord);
      setHistory((prev) => {
        const next = [newRecord, ...prev.filter((h) => h.id !== newRecord.id)];
        try {
          localStorage.setItem('morphos_guest_history', JSON.stringify(next));
        } catch {}
        return next;
      });
      setAppMode('workspace');
      setActiveWorkspaceView('investigations');
      window.history.pushState({}, '', `/investigations/${newRecord.id}`);
      setLoading(false);
      pushToast('Autonomous investigation concluded (Local Engine)', 'success');
    }, 1000);
  };

  const handleTryDemo = () => {
    setQuestion('Why is API latency increasing under high request concurrency?');
    setCurrentInvestigation(DEMO_INVESTIGATION_DATA);
    setAppMode('workspace');
    setActiveWorkspaceView('investigations');
    pushToast('Loaded verified benchmark demo investigation', 'info');
  };

  const handleDeleteInvestigation = async (id: string) => {
    const token = await getCurrentUserToken();
    if (token) {
      try {
        await deleteInvestigation(id, token);
        pushToast('Investigation removed from Firestore', 'success');
      } catch {
        pushToast('Failed to delete on server, removing locally', 'info');
      }
    }
    setHistory((prev) => {
      const next = prev.filter((item) => String(item.id) !== id);
      try {
        localStorage.setItem('morphos_guest_history', JSON.stringify(next));
      } catch {}
      return next;
    });
    if (currentInvestigation && String(currentInvestigation.id) === id) {
      setCurrentInvestigation(null);
      setActiveWorkspaceView('overview');
      window.history.pushState({}, '', '/');
    }
  };

  const handleExportMarkdown = () => {
    if (!currentInvestigation) return;
    const inv = currentInvestigation;
    const confidencePct = Math.round(Number(inv.confidence ?? 0) * 100);

    const markdown = `# MORPHOS Investigation Audit Report
ID: ${inv.id ?? 'N/A'}
Date: ${inv.createdAt ?? new Date().toISOString()}

## Question
${inv.question ?? 'N/A'}

## Interpreted Problem
${inv.interpretedProblem ?? 'N/A'}

## Final Conclusion
${inv.finalConclusion ?? inv.analysis ?? 'N/A'}

## Confidence & Iterations
Confidence: ${confidencePct}%
Iterations: ${inv.iteration ?? 1} / ${inv.maxIterations ?? 5}

## Evaluated Hypotheses
${(inv.hypotheses ?? [])
  .map(
    (h, idx) =>
      `### Hypothesis ${idx + 1}: ${h.title}\n- Confidence: ${Math.round(Number(h.confidence ?? 0) * 100)}%\n- Rationale: ${h.rationale}`
  )
  .join('\n\n')}

## Experiment Telemetry
Tool: ${inv.experiment?.tool ?? 'benchmarkTool'}
Output:
\`\`\`json
${JSON.stringify(inv.experimentResult ?? {}, null, 2)}
\`\`\`

---
Generated by MORPHOS — Autonomous AI Experimentation Platform
`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `morphos-investigation-${inv.id ?? 'report'}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    pushToast('Exported Markdown report', 'success');
  };

  const handleSignOut = async () => {
    await signOutUser();
    setUser(null);
    setCurrentInvestigation(null);
    pushToast('Signed out of session', 'info');
  };

  // Metrics computation for Dashboard
  const metrics = useMemo(() => {
    const total = analytics.totalInvestigations || history.length;
    const completed = analytics.completedInvestigations || history.filter((i) => ['finalized', 'completed'].includes(String(i.status ?? '').toLowerCase())).length;
    const avgConf = analytics.averageConfidence || (history.length ? history.reduce((acc, h) => acc + Number(h.confidence ?? 0), 0) / history.length : 0.85);
    const rate = total > 0 ? (completed / total) * 100 : 100;
    return {
      totalInvestigations: total,
      experimentsRun: analytics.totalExperiments || history.length,
      avgConfidence: avgConf,
      completionRate: rate,
    };
  }, [analytics, history]);

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F5F5] selection:bg-[#FF7A00]/30 selection:text-white font-sans">
      {/* View Router */}
      {appMode === 'privacy' ? (
        <PrivacyPage
          onNavigateHome={() => { setAppMode('landing'); window.history.pushState({}, '', '/'); }}
          onOpenWorkspace={() => { setAppMode('workspace'); setActiveWorkspaceView('overview'); window.history.pushState({}, '', '/'); }}
          user={user}
          onOpenAuth={(mode) => { setAuthModalInitialMode(mode ?? 'login'); setAuthModalOpen(true); }}
          onSignOut={handleSignOut}
        />
      ) : appMode === 'terms' ? (
        <TermsPage
          onNavigateHome={() => { setAppMode('landing'); window.history.pushState({}, '', '/'); }}
          onOpenWorkspace={() => { setAppMode('workspace'); setActiveWorkspaceView('overview'); window.history.pushState({}, '', '/'); }}
          user={user}
          onOpenAuth={(mode) => { setAuthModalInitialMode(mode ?? 'login'); setAuthModalOpen(true); }}
          onSignOut={handleSignOut}
        />
      ) : appMode === '404' ? (
        <NotFoundPage
          onNavigateHome={() => { setAppMode('landing'); window.history.pushState({}, '', '/'); }}
          onOpenWorkspace={() => { setAppMode('workspace'); setActiveWorkspaceView('overview'); window.history.pushState({}, '', '/'); }}
          user={user}
          onOpenAuth={(mode) => { setAuthModalInitialMode(mode ?? 'login'); setAuthModalOpen(true); }}
          onSignOut={handleSignOut}
        />
      ) : appMode === 'landing' ? (
        <LandingPage
          onStartInvestigating={() => {
            setAppMode('workspace');
            setActiveWorkspaceView('overview');
          }}
          onWatchDemo={() => setDemoModalOpen(true)}
          onOpenAuth={(mode) => {
            setAuthModalInitialMode(mode ?? 'login');
            setAuthModalOpen(true);
          }}
          user={user}
          onSignOut={handleSignOut}
          onNavigateTo={(route) => {
            if (route === 'privacy') { setAppMode('privacy'); window.history.pushState({}, '', '/privacy'); }
            else if (route === 'terms') { setAppMode('terms'); window.history.pushState({}, '', '/terms'); }
            else if (route === 'workspace') { setAppMode('workspace'); setActiveWorkspaceView('overview'); }
          }}
        />
      ) : (
        /* Authenticated Investigation Dashboard & Workspace */
        <div className="flex min-h-screen bg-[#050505] text-slate-100">
          {/* Mobile Sidebar Overlay */}
          {mobileSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}

          {/* Sidebar (Desktop + Mobile Drawer) */}
          <div
            className={`transition-transform duration-300 z-50 ${
              mobileSidebarOpen
                ? 'translate-x-0'
                : '-translate-x-full md:translate-x-0'
            }`}
          >
            <Sidebar
              activeView={activeWorkspaceView}
              onSelectView={(v) => {
                setActiveWorkspaceView(v);
                setCurrentInvestigation(null);
                setMobileSidebarOpen(false);
              }}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              onBackToHome={() => {
                setAppMode('landing');
                window.history.pushState({}, '', '/');
                setMobileSidebarOpen(false);
              }}
              onNewInvestigation={() => {
                setCurrentInvestigation(null);
                setActiveWorkspaceView('overview');
                setMobileSidebarOpen(false);
              }}
              user={user}
              onSignOut={handleSignOut}
            />
          </div>

          {/* Main Content Area */}
          <div
            className={`flex-1 flex flex-col transition-all duration-300 min-w-0 bg-[#050505] ${
              sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
            }`}
          >
            {/* Top Workspace Header */}
            <header className="h-16 px-4 sm:px-8 border-b border-white/[0.07] bg-[#0A0A0E]/90 backdrop-blur-xl flex items-center justify-between sticky top-0 z-30">
              <div className="flex items-center gap-3">
                {/* Mobile hamburger button */}
                <button
                  onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                  className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                  aria-label="Toggle mobile menu"
                >
                  <IconMenu className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono uppercase text-slate-400 tracking-wider">
                    WORKSPACE
                  </span>
                  <span className="text-slate-400 font-mono text-xs">/</span>
                  <span className="text-xs font-mono uppercase text-white font-bold tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A3D] shadow-[0_0_8px_#FF6A3D]" />
                    {currentInvestigation ? 'INVESTIGATION DETAIL' : activeWorkspaceView}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:gap-4">
                {/* Fallback Engine Badge */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-[11px] font-mono text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-slate-400">ENGINE:</span>
                  <span className="text-white font-semibold">DETERMINISTIC FALLBACK ACTIVE</span>
                </div>

                <button
                  onClick={() => setCopilotOpen(true)}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FF6A3D]/10 border border-[#FF6A3D]/30 text-[#FF9A4D] hover:bg-[#FF6A3D]/20 hover:border-[#FF6A3D] text-xs font-mono transition-all shadow-[0_0_12px_rgba(255,106,61,0.2)]"
                  title="Open MORPHOS AI Agent Copilot (⌘K)"
                >
                  <IconBot className="w-3.5 h-3.5 text-[#FF6A3D]" />
                  <span>AI Copilot</span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-white/[0.08] text-slate-300">⌘K</span>
                </button>

                {!user ? (
                  <button
                    onClick={() => {
                      setAuthModalInitialMode('login');
                      setAuthModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-mono uppercase tracking-wider text-[#FF9A4D] bg-[#FF6A3D]/10 border border-[#FF6A3D]/30 hover:bg-[#FF6A3D]/20 hover:border-[#FF6A3D] transition-all shadow-[0_0_12px_rgba(255,106,61,0.2)]"
                  >
                    Connect Firebase
                  </button>
                ) : (
                  <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs font-mono text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A3D]" />
                    <span className="truncate max-w-[140px] text-white">{user.email}</span>
                  </div>
                )}
              </div>
            </header>

            {/* Workspace View Router */}
            <main className="flex-1 p-6 sm:p-8 lg:p-10 overflow-y-auto">
              {currentInvestigation ? (
                <InvestigationWorkspace
                  investigation={currentInvestigation}
                  onBack={() => {
                    setCurrentInvestigation(null);
                    setActiveWorkspaceView('overview');
                    window.history.pushState({}, '', '/');
                  }}
                  onRunAgain={(q) => {
                    setQuestion(q);
                    setCurrentInvestigation(null);
                    setActiveWorkspaceView('overview');
                  }}
                  onExport={handleExportMarkdown}
                  onDelete={() => {
                    if (currentInvestigation.id) {
                      void handleDeleteInvestigation(String(currentInvestigation.id));
                    }
                  }}
                  isRunning={loading}
                  onOpenCopilot={() => setCopilotOpen(true)}
                />
              ) : activeWorkspaceView === 'overview' ? (
                <DashboardView
                  question={question}
                  setQuestion={setQuestion}
                  onStartInvestigation={handleStartInvestigation}
                  onTryDemo={handleTryDemo}
                  loading={loading}
                  error={error}
                  history={history}
                  onOpenInvestigation={openInvestigationById}
                  metrics={metrics}
                />
              ) : activeWorkspaceView === 'investigations' ? (
                <HistoryView
                  history={history}
                  onOpenInvestigation={openInvestigationById}
                  onDeleteInvestigation={handleDeleteInvestigation}
                />
              ) : activeWorkspaceView === 'experiments' ? (
                <ExperimentsView history={history} />
              ) : activeWorkspaceView === 'analytics' || activeWorkspaceView === 'insights' ? (
                <AnalyticsView analytics={analytics} history={history} />
              ) : (
                <SettingsView
                  user={user}
                  onSignOut={handleSignOut}
                  onAuthSuccess={(msg) => {
                    pushToast(msg ?? 'Authenticated', 'success');
                    void loadUserData();
                  }}
                />
              )}
            </main>
          </div>
        </div>
      )}

      {/* Global Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalInitialMode}
        onSuccess={(msg) => {
          pushToast(msg ?? 'Authenticated', 'success');
          void loadUserData();
        }}
      />

      <DemoInvestigationModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        onOpenWorkspaceWithDemo={() => {
          setDemoModalOpen(false);
          setQuestion('Why is API latency increasing under high request concurrency?');
          setCurrentInvestigation(DEMO_INVESTIGATION_DATA);
          setAppMode('workspace');
          setActiveWorkspaceView('investigations');
          pushToast('Loaded verified benchmark demo investigation', 'info');
        }}
      />

      {/* Autonomous AI Agent Components */}
      <MorphosAgentCopilot
        currentInvestigation={currentInvestigation}
        onRunInvestigation={(newQuery) => {
          setQuestion(newQuery);
          if (currentInvestigation) {
            setCurrentInvestigation(null);
          }
          setActiveWorkspaceView('overview');
          setTimeout(() => {
            void handleStartInvestigation();
          }, 50);
        }}
        isOpen={copilotOpen}
        onToggle={() => setCopilotOpen((prev) => !prev)}
      />

      <AgentExecutionModal
        isOpen={loading}
        question={question}
      />

      {/* Global Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`p-3.5 rounded-xl border shadow-2xl text-xs font-mono pointer-events-auto flex items-center gap-2.5 ${
                toast.type === 'success'
                  ? 'bg-[#0A0A0A] border-emerald-500/40 text-emerald-200'
                  : toast.type === 'error'
                  ? 'bg-[#0A0A0A] border-red-500/40 text-red-200'
                  : 'bg-[#0A0A0A] border-[#FF7A00]/40 text-[#FF9D3D]'
              }`}
            >
              <span className="text-base leading-none">
                {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
              </span>
              <span>{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {/* Cookie / Telemetry Consent Banner */}
      <CookieConsentBanner
        onOpenPrivacy={() => {
          setAppMode('privacy');
          window.history.pushState({}, '', '/privacy');
        }}
      />
    </div>
  );
}
