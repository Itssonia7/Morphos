import { getStageIndexFromNode, subscribeToGraphUpdates } from '../services/socket';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import {
  deleteInvestigation,
  getAnalytics,
  getInvestigationById,
  getInvestigations,
  investigate,
  InvestigationResponse,
} from '../services/api';
import { getCurrentUserToken, signInEmail, signOutUser, signUpEmail, subscribeToAuth } from '../services/firebase';

const demoQuestions = [
  'Why is API latency increasing?',
  'Why does memory usage grow over time?',
  'Why is database throughput falling under load?',
  'Why does model accuracy decrease with dataset size?',
];

const timelineStages = [
  'Interpret Question',
  'Generate Hypotheses',
  'Select Experiment',
  'Execute Experiment',
  'Analyze Results',
  'Evaluate Confidence',
  'Finalize',
];

const loadingStages = [
  'Interpreting question...',
  'Generating hypotheses...',
  'Selecting experiment...',
  'Executing experiment...',
  'Analyzing results...',
  'Updating confidence...',
  'Finalizing conclusion...',
];

const statusColors: Record<string, string> = {
  idle: 'bg-slate-200 text-slate-900',
  interpreted: 'bg-[#FF6A3D]/15 text-orange-200 border border-[#FF6A3D]/30',
  hypotheses_ready: 'bg-[#FF9A4D]/15 text-orange-100 border border-[#FF9A4D]/20',
  experiment_selected: 'bg-amber-500/15 text-amber-200 border border-amber-500/20',
  experiment_running: 'bg-amber-500/15 text-amber-100 border border-amber-500/20',
  analyzed: 'bg-emerald-500/15 text-emerald-100 border border-emerald-500/20',
  finalized: 'bg-[#FF6A3D]/15 text-orange-100 border border-[#FF6A3D]/20',
  confidence_high: 'bg-emerald-500/15 text-emerald-100 border border-emerald-500/20',
  confidence_low: 'bg-orange-500/15 text-orange-100 border border-orange-500/20',
  failed: 'bg-rose-500/15 text-rose-200 border border-rose-500/20',
  running: 'bg-amber-500/15 text-amber-100 border border-amber-500/20',
  completed: 'bg-emerald-500/15 text-emerald-100 border border-emerald-500/20',
};

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'investigations', label: 'Investigations' },
  { id: 'experiments', label: 'Experiments' },
  { id: 'insights', label: 'Insights' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'profile', label: 'Profile' },
] as const;

type ThemeMode = 'dark' | 'light' | 'system';
type ViewId = (typeof navItems)[number]['id'];
type SortMode = 'newest' | 'oldest';
type StatusFilter = 'all' | 'running' | 'completed' | 'failed';

type InvestigationRecord = Record<string, unknown> & {
  id?: string;
  question?: string;
  status?: string;
  confidence?: number;
  createdAt?: string;
  updatedAt?: string;
  iteration?: number;
  finalConclusion?: string;
  interpretedProblem?: string;
  analysis?: string;
  selectedHypothesis?: { title?: string; rationale?: string; confidence?: number; evidence?: string[] } | null;
  hypotheses?: Array<{ title?: string; rationale?: string; confidence?: number; evidence?: string[] }>; 
  experiment?: { id?: string; name?: string; description?: string; tool?: string; inputs?: Record<string, unknown> } | null;
  experimentResult?: Record<string, unknown> | null;
  events?: Array<Record<string, unknown>>;
  userId?: string;
};

type AnalyticsState = {
  totalInvestigations: number;
  completedInvestigations: number;
  averageConfidence: number;
  averageIterations: number;
  totalExperiments: number;
  completionRate: number;
  confidenceDistribution: { high: number; medium: number; low: number };
  experimentOutcomes: { completed: number; failed: number; running: number };
  investigationsOverTime: Array<{ date: string; count: number }>;
  iterationsPerInvestigation: Array<{ label: string; iterations: number }>;
};

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatRelativeTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(0, Math.round(diffMs / 3600000));
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function safeNumber(value: unknown, fallback = 0) {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) ? num : fallback;
}

export default function Dashboard() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authStatus, setAuthStatus] = useState('');
  const [user, setUser] = useState<{ uid: string; email?: string | null } | null>(null);
  const [history, setHistory] = useState<Array<InvestigationRecord>>([]);
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
  const [detailInvestigation, setDetailInvestigation] = useState<InvestigationRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [demoMode, setDemoMode] = useState(false);
  const [workflowStage, setWorkflowStage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExperiment, setSelectedExperiment] = useState<Record<string, unknown> | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [toastQueue, setToastQueue] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }>>([]);
  const [searchIndex, setSearchIndex] = useState(0);

  const pushToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToastQueue((current) => [...current, { id, message, type }]);
    setTimeout(() => {
      setToastQueue((current) => current.filter((toast) => toast.id !== id));
    }, 3000);
  };

  useEffect(() => {
    const root = document.documentElement;
    const storedTheme = window.localStorage.getItem('morphos-theme') as ThemeMode | null;
    const nextTheme = storedTheme ?? 'dark';
    setTheme(nextTheme);
    root.dataset.theme = nextTheme;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('morphos-theme', theme);
  }, [theme]);

  const loadHistory = async (token: string) => {
    const items = await getInvestigations(token);
    setHistory(items as Array<InvestigationRecord>);
  };

  const loadAnalytics = async (token: string) => {
    try {
      const data = await getAnalytics(token);
      setAnalytics(data as AnalyticsState);
    } catch {
      const computed = history.length ? {
        totalInvestigations: history.length,
        completedInvestigations: history.filter((item) => ['finalized', 'completed'].includes(String(item.status ?? '').toLowerCase())).length,
        averageConfidence: history.reduce((sum, item) => sum + safeNumber(item.confidence, 0), 0) / history.length,
        averageIterations: history.reduce((sum, item) => sum + safeNumber(item.iteration, 0), 0) / history.length,
        totalExperiments: history.filter((item) => item.experiment).length,
        completionRate: (history.filter((item) => ['finalized', 'completed'].includes(String(item.status ?? '').toLowerCase())).length / history.length) * 100,
        confidenceDistribution: { high: 0, medium: 0, low: 0 },
        experimentOutcomes: { completed: 0, failed: 0, running: 0 },
        investigationsOverTime: [],
        iterationsPerInvestigation: [],
      } : {
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
      };
      setAnalytics(computed);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setSelectedExperiment(null);
        setDeleteTargetId(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((nextUser) => {
      setUser(nextUser ? { uid: nextUser.uid, email: nextUser.email ?? undefined } : null);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      setDetailInvestigation(null);
      return;
    }

    void (async () => {
      const token = await getCurrentUserToken();
      if (!token) {
        setHistory([]);
        return;
      }

      try {
        await Promise.all([loadHistory(token), loadAnalytics(token)]);
      } catch {
        setHistory([]);
      }
    })();
  }, [user]);

  useEffect(() => {
    const routeMatch = window.location.pathname.match(/^\/investigations\/([^/]+)$/);
    if (routeMatch && user) {
      const id = routeMatch[1];
      void openInvestigation(id);
    }
  }, [user]);

  async function openInvestigation(id: string) {
    const token = await getCurrentUserToken();
    if (!token) {
      setError('Please sign in before viewing investigations.');
      return;
    }

    setDetailLoading(true);
    setError(null);
    setActiveView('investigations');
    setRedirecting(true);

    try {
      const investigation = await getInvestigationById(id, token);
      setDetailInvestigation(investigation as InvestigationRecord);
      window.history.pushState({}, '', `/investigations/${id}`);
    } catch {
      setError('This investigation could not be loaded.');
      setDetailInvestigation(null);
      window.history.pushState({}, '', '/');
    } finally {
      setDetailLoading(false);
      setRedirecting(false);
    }
  }

  async function handleAuth() {
    try {
      if (authMode === 'register') {
        await signUpEmail(authEmail, authPassword);
      } else {
        await signInEmail(authEmail, authPassword);
      }
      setAuthStatus('Authentication successful.');
      setAuthPassword('');
      pushToast('Authentication successful', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      setAuthStatus(message);
      pushToast(message, 'error');
    }
  }

  async function handleLogout() {
    await signOutUser();
    setUser(null);
    setDetailInvestigation(null);
    setAuthStatus('Logged out.');
    setHistory([]);
    setActiveView('overview');
    window.history.pushState({}, '', '/');
    pushToast('Signed out successfully', 'success');
  }

  async function handleStart() {
    const trimmed = question.trim();
    if (!trimmed) {
      setError('Enter a technical investigation question first.');
      pushToast('Enter a question before starting.', 'error');
      return;
    }

    setLoading(true);
    setError(null);
    setDemoMode(trimmed === 'Why is API latency increasing?');
    setWorkflowStage(0);

    let unsubscribeTelemetry: (() => void) | null = null;
    try {
      const token = await getCurrentUserToken();
      if (!token) {
        setError('Please sign in with Firebase before starting an investigation.');
        setLoading(false);
        return;
      }

      unsubscribeTelemetry = subscribeToGraphUpdates(token, (event) => {
        const stageIdx = getStageIndexFromNode(event.state);
        if (stageIdx >= 0) {
          setWorkflowStage(stageIdx);
        }
      });

      const investigation = await investigate(trimmed, token);
      setDetailInvestigation(investigation as unknown as InvestigationRecord);
      setActiveView('investigations');
      const nextHistory = await getInvestigations(token);
      setHistory(nextHistory as Array<InvestigationRecord>);
      await loadAnalytics(token);
      setQuestion(trimmed);
      pushToast('Investigation started', 'success');
    } catch {
      setError('The investigation failed. Please verify the backend is running and your Firebase session is valid.');
      pushToast('Investigation failed. Please try again.', 'error');
    } finally {
      unsubscribeTelemetry?.();
      setLoading(false);
      setWorkflowStage(0);
    }
  }

  async function handleDeleteInvestigation(id: string) {
    const token = await getCurrentUserToken();
    if (!token) {
      setError('Please sign in to delete an investigation.');
      pushToast('Authentication required to delete.', 'error');
      return;
    }

    try {
      const response = await deleteInvestigation(id, token);
      setHistory((current) => current.filter((item) => String(item.id ?? '') !== String(id)));
      setDetailInvestigation(null);
      setDeleteTargetId(null);
      setActiveView('investigations');
      window.history.pushState({}, '', '/');
      pushToast(`Deleted investigation ${response.deletedId}`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Deletion failed';
      pushToast(message, 'error');
      setError(message);
    }
  }

  function handleExport() {
    const source = detailInvestigation as InvestigationRecord | null;
    if (!source) {
      pushToast('Load an investigation before exporting.', 'info');
      return;
    }

    const questions = source.question ?? 'Not available';
    const confidence = Math.round(safeNumber(source.confidence, 0) * 100);
    const evidence = (source.selectedHypothesis?.evidence ?? source.hypotheses?.flatMap((entry) => entry.evidence ?? []) ?? ['Not available']).join('\n- ');
    const markdown = [
      '# MORPHOS Investigation',
      '',
      '## Question',
      questions,
      '',
      '## Status',
      String(source.status ?? 'Not available'),
      '',
      '## Hypotheses',
      (source.hypotheses ?? []).map((item, index) => `- ${index + 1}. ${item.title ?? 'Untitled hypothesis'}\n  - Confidence: ${Math.round((safeNumber(item.confidence, 0)) * 100)}%\n  - Rationale: ${item.rationale ?? 'Not available'}`).join('\n') || '- Not available',
      '',
      '## Experiments',
      source.experiment ? `- ${source.experiment.name ?? 'Experiment'}\n  - Tool: ${source.experiment.tool ?? 'Not available'}\n  - Inputs: ${JSON.stringify(source.experiment.inputs ?? {}, null, 2)}` : '- Not available',
      '',
      '## Evidence',
      `- ${evidence}`,
      '',
      '## Analysis',
      source.analysis ?? 'Not available',
      '',
      '## Confidence',
      `${confidence}%`,
      '',
      '## Final Conclusion',
      source.finalConclusion ?? 'Not available',
    ].join('\n');

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `morphos-investigation-${source.id ?? 'report'}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    pushToast('Export created successfully', 'success');
  }

  const result = detailInvestigation as InvestigationResponse | null;

  const filteredHistory = useMemo(() => {
    const nextList = [...history].filter((item) => {
      const lowerQuery = searchTerm.trim().toLowerCase();
      const matchesSearch = !lowerQuery || [
        item.question,
        item.status,
        item.finalConclusion,
        item.selectedHypothesis?.title,
        item.experiment?.name,
      ].filter(Boolean).join(' ').toLowerCase().includes(lowerQuery);

      const status = String(item.status ?? '').toLowerCase();
      const matchesStatus = statusFilter === 'all' || (
        statusFilter === 'running' ? ['interpreted', 'hypotheses_ready', 'experiment_selected', 'experiment_running', 'analyzed'].includes(status) :
        statusFilter === 'completed' ? ['finalized', 'completed'].includes(status) :
        status === 'failed'
      );

      return matchesSearch && matchesStatus;
    });

    nextList.sort((a, b) => {
      const aTime = new Date(String(a.updatedAt ?? a.createdAt ?? 0)).getTime();
      const bTime = new Date(String(b.updatedAt ?? b.createdAt ?? 0)).getTime();
      return sortMode === 'newest' ? bTime - aTime : aTime - bTime;
    });

    return nextList;
  }, [history, searchTerm, statusFilter, sortMode]);

  const experiments = useMemo(() => {
    return history
      .filter((item) => item.experiment || item.selectedHypothesis)
      .map((item) => ({
        id: String(item.id ?? `exp-${item.createdAt ?? Date.now()}`),
        experiment: item.experiment?.name ?? 'Experiment',
        investigation: item.question ?? 'Investigation',
        hypothesis: item.selectedHypothesis?.title ?? 'Unassigned',
        status: String(item.status ?? 'idle'),
        result: item.experimentResult ? JSON.stringify(item.experimentResult) : (item.finalConclusion ?? 'Not available'),
        confidence: safeNumber(item.confidence, 0),
        timestamp: item.createdAt ?? new Date().toISOString(),
        detail: item,
      }));
  }, [history]);

  const visibleExperiments = useMemo(() => {
    return experiments.filter((item) => {
      const status = String(item.status ?? '').toLowerCase();
      if (statusFilter === 'all') return true;
      if (statusFilter === 'completed') return ['finalized', 'completed'].includes(status);
      if (statusFilter === 'failed') return status === 'failed';
      return ['interpreted', 'hypotheses_ready', 'experiment_selected', 'experiment_running', 'analyzed'].includes(status);
    });
  }, [experiments, statusFilter]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { investigations: [], experiments: [] };
    const query = searchQuery.toLowerCase();

    const investigationMatches = history.filter((item) => {
      const text = [
        item.question,
        item.status,
        item.finalConclusion,
        item.selectedHypothesis?.title,
        item.experiment?.name,
      ].filter(Boolean).join(' ').toLowerCase();
      return text.includes(query);
    });

    const experimentMatches = experiments.filter((item) => {
      const text = `${item.experiment} ${item.investigation} ${item.hypothesis} ${item.status}`.toLowerCase();
      return text.includes(query);
    });

    return { investigations: investigationMatches.slice(0, 6), experiments: experimentMatches.slice(0, 6) };
  }, [history, experiments, searchQuery]);

  useEffect(() => {
    if (!searchOpen) return;

    const onPaletteKeyDown = (event: KeyboardEvent) => {
      const results = [...searchResults.investigations, ...searchResults.experiments];
      if (!results.length) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSearchIndex((current) => (current + 1) % results.length);
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSearchIndex((current) => (current - 1 + results.length) % results.length);
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const item = results[searchIndex];
        if (item && 'question' in item) {
          void openInvestigation(String(item.id ?? ''));
          setSearchOpen(false);
        }
      }
    };

    window.addEventListener('keydown', onPaletteKeyDown);
    return () => window.removeEventListener('keydown', onPaletteKeyDown);
  }, [searchOpen, searchResults, searchIndex]);

  const totalInvestigations = analytics.totalInvestigations || history.length;
  const experimentsRun = analytics.totalExperiments || experiments.length;
  const avgConfidence = analytics.averageConfidence || (history.length ? history.reduce((sum, item) => sum + safeNumber(item.confidence, 0), 0) / history.length : 0);
  const successfulInvestigations = analytics.completedInvestigations || history.filter((item) => ['finalized', 'completed'].includes(String(item.status ?? '').toLowerCase())).length;

  const completionRate = analytics.completionRate || (history.length ? (successfulInvestigations / history.length) * 100 : 0);

  const recentInvestigations = history.slice(0, 4);

  const derivedInsights = useMemo(() => {
    if (!history.length) return [];

    const mostCommonTopic = history.reduce<Record<string, number>>((acc, item) => {
      const key = String(item.question ?? 'General investigation');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const topic = Object.entries(mostCommonTopic).sort((a, b) => b[1] - a[1])[0];
    const avgConfidenceVal = history.reduce((sum, item) => sum + safeNumber(item.confidence, 0), 0) / history.length;
    const mostCommonExperimentType = history.reduce<Record<string, number>>((acc, item) => {
      const key = item.experiment?.tool ?? item.experiment?.name ?? 'Unspecified';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const experimentType = Object.entries(mostCommonExperimentType).sort((a, b) => b[1] - a[1])[0];

    return [
      { label: 'Most common investigation', value: topic ? topic[0] : 'Not enough data yet.' },
      { label: 'Average confidence', value: `${Math.round(avgConfidenceVal * 100)}%` },
      { label: 'Most common experiment type', value: experimentType ? experimentType[0] : 'Not enough data yet.' },
      { label: 'Completion rate', value: `${Math.round(completionRate)}%` },
    ];
  }, [history, completionRate]);

  const renderOverview = () => (
    <div className="space-y-6">
      <section className="panel hero-panel">
        <div className="hero-layout">
          <div className="hero-copy-block">
            <div className="badge badge-muted">AI EXPERIMENTATION ENGINE</div>
            <h1 className="display-heading">Turn questions into evidence.</h1>
            <p className="hero-copy">MORPHOS investigates technical problems by generating hypotheses, running experiments, analyzing evidence, and evaluating confidence.</p>
            <div className="hero-actions">
              <button className="action-button primary" onClick={() => setActiveView('investigations')}>Start Investigation</button>
              <button className="action-button secondary" onClick={() => setActiveView('experiments')}>View Experiments</button>
            </div>
          </div>
          <div className="status-card">
            <div className="status-label">AI Provider</div>
            <div className="status-row">
              <span className="status-dot status-warning" />
              <span>Gemini</span>
            </div>
            <p className="status-text">Gemini quota is currently unavailable. MORPHOS is using deterministic experiment mode.</p>
          </div>
        </div>
      </section>

      <section className="metric-strip" aria-label="Key metrics">
        <div className="metric-item">
          <span className="metric-kicker">Investigations</span>
          <strong>{totalInvestigations}</strong>
        </div>
        <div className="metric-item">
          <span className="metric-kicker">Experiments</span>
          <strong>{experimentsRun}</strong>
        </div>
        <div className="metric-item">
          <span className="metric-kicker">Avg. confidence</span>
          <strong>{Math.round(avgConfidence * 100)}%</strong>
        </div>
        <div className="metric-item">
          <span className="metric-kicker">Completion</span>
          <strong>{Math.round(completionRate)}%</strong>
        </div>
      </section>

      <section className="content-grid">
        <div className="composer-panel">
          <div className="panel-header compact-header">
            <div><p className="eyebrow">Workspace</p><h2>New Investigation</h2></div>
            <div className="composer-hint">⌘ ↵ Investigate</div>
          </div>

          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={6} className="field-input command-input" placeholder="Ask MORPHOS to investigate something..." aria-label="Investigation question" />

          <div className="chip-row">
            {demoQuestions.map((example) => (
              <button key={example} className="chip" onClick={() => setQuestion(example)}>{example}</button>
            ))}
          </div>

          <div className="composer-actions">
            <button className="action-button primary" onClick={handleStart} disabled={loading} aria-label="Start investigation">Start Investigation</button>
            <button className="action-button secondary" onClick={async () => {
              setQuestion('Why is API latency increasing?');
              setDemoMode(true);
              setLoading(true);
              setWorkflowStage(0);
              const token = await getCurrentUserToken();
              if (!token) {
                setError('Please sign in with Firebase before running the demo.');
                setLoading(false);
                pushToast('Authentication required for demo mode.', 'error');
                return;
              }

              try {
                const investigation = await investigate('Why is API latency increasing?', token);
                setDetailInvestigation(investigation as unknown as InvestigationRecord);
                setActiveView('investigations');
                const nextHistory = await getInvestigations(token);
                setHistory(nextHistory as Array<InvestigationRecord>);
                pushToast('Demo mode completed', 'success');
              } catch {
                pushToast('Demo mode is unavailable right now.', 'error');
              } finally {
                setLoading(false);
                setWorkflowStage(0);
              }
            }} aria-label="Try demo investigation">Try Demo</button>
          </div>

          {error ? <div className="error-box mt-4">{error}</div> : null}
        </div>

        <div className="panel recent-panel">
          <div className="panel-header compact-header">
            <div><p className="eyebrow">Recent</p><h2>Recent Investigations</h2></div>
          </div>

          <div className="stack-list">
            {recentInvestigations.length ? recentInvestigations.map((item) => (
              <button key={String(item.id ?? Math.random())} className="list-card" onClick={() => { void openInvestigation(String(item.id ?? '')); }}>
                <div className="list-card-top">
                  <span className="list-title">{String(item.question ?? 'Investigation')}</span>
                  <span className={`tiny-badge ${statusColors[String(item.status ?? 'idle')] ?? 'bg-slate-700'}`}>{String(item.status ?? 'idle')}</span>
                </div>
                <div className="list-meta-row">
                  <span>{safeNumber(item.confidence, 0).toFixed(2)} confidence</span>
                  <span>{safeNumber(item.iteration, 0)} iter.</span>
                  <span>{formatRelativeTime(String(item.createdAt ?? ''))}</span>
                </div>
              </button>
            )) : <div className="empty-box">No investigations yet.</div>}
          </div>
        </div>
      </section>
    </div>
  );

  const renderInvestigationDetail = () => {
    if (detailLoading) return <LoadingState />;
    if (!detailInvestigation) return <EmptyState message="No investigation selected." />;

    const confidenceValue = Math.round(safeNumber(detailInvestigation.confidence, 0) * 100);
    const evidenceList = detailInvestigation.selectedHypothesis?.evidence?.length ? detailInvestigation.selectedHypothesis.evidence : (detailInvestigation.hypotheses ?? []).flatMap((entry) => entry.evidence ?? []);
    const hypothesisList = detailInvestigation.hypotheses?.length ? detailInvestigation.hypotheses : [{ title: 'Not available', rationale: 'No hypothesis recorded', confidence: 0, evidence: ['Not available'] }];

    return (
      <motion.div className="space-y-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <section className="panel hero-panel investigation-shell">
          <div className="workbench-header">
            <button className="action-button secondary" onClick={() => { setDetailInvestigation(null); setActiveView('investigations'); window.history.pushState({}, '', '/'); }}>← Back to Investigations</button>
            <span className={`status-badge ${String(detailInvestigation.status ?? 'idle').toLowerCase() === 'failed' ? 'failed' : String(detailInvestigation.status ?? 'idle').toLowerCase() === 'finalized' ? 'completed' : 'running'}`}>
              {String(detailInvestigation.status ?? 'idle').toUpperCase()}
            </span>
          </div>

          <div className="workspace-top-row">
            <div className="question-block">
              <div className="eyebrow">Question</div>
              <div className="question-text">{detailInvestigation.question ?? 'Not available'}</div>
            </div>
            <div className="stat-cluster">
              <div className="stat-card"><span>Status</span><strong>{String(detailInvestigation.status ?? 'idle')}</strong></div>
              <div className="stat-card"><span>Confidence</span><strong>{confidenceValue}%</strong></div>
              <div className="stat-card"><span>Iteration</span><strong>{String(detailInvestigation.iteration ?? 0)}</strong></div>
            </div>
          </div>
        </section>

        <section className="workspace-grid">
          <aside className="timeline-panel">
            <div className="panel-subtitle">Investigation Timeline</div>
            <div className="timeline-stack">
              {(detailInvestigation.events?.length ? detailInvestigation.events : [{ message: 'Waiting for workflow events' }]).map((event, index) => (
                <div key={`${String(event.message ?? 'event')}-${index}`} className="timeline-item is-active">
                  <div className="timeline-dot done">✓</div>
                  <div>
                    <div className="timeline-stage">{timelineStages[Math.min(index, timelineStages.length - 1)]}</div>
                    <div className="timeline-note">{String(event.message ?? 'Waiting for workflow event')}</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <main className="main-panel investigation-main-panel">
            <div className="panel-subtitle">Current Investigation</div>
            <div className="current-stage-card">
              <div className="current-stage-label">DETAILS</div>
              <h3>{detailInvestigation.interpretedProblem ?? 'Not available'}</h3>
              <div className="stage-grid">
                <div className="detail-block"><span className="label">Created</span><p>{formatDate(String(detailInvestigation.createdAt ?? ''))}</p></div>
                <div className="detail-block"><span className="label">Updated</span><p>{formatDate(String(detailInvestigation.updatedAt ?? detailInvestigation.createdAt ?? ''))}</p></div>
                <div className="detail-block"><span className="label">Selected Hypothesis</span><p>{detailInvestigation.selectedHypothesis?.title ?? 'Not available'}</p></div>
                <div className="detail-block"><span className="label">Experiment</span><p>{detailInvestigation.experiment?.name ?? 'Not available'}</p></div>
                <div className="detail-block"><span className="label">Experiment Result</span><p>{detailInvestigation.experimentResult ? JSON.stringify(detailInvestigation.experimentResult, null, 2) : 'Not available'}</p></div>
                <div className="detail-block"><span className="label">Analysis</span><p>{detailInvestigation.analysis ?? 'Not available'}</p></div>
              </div>
            </div>

            <div className="event-stream">
              <div className="panel-subtitle">Events</div>
              <div className="event-list">
                {(detailInvestigation.events ?? []).map((event, index) => (
                  <div key={`${String(event.message ?? 'event')}-${index}`} className="event-row">
                    <div className="event-time">{String(event.timestamp ?? '').slice(11, 16)}</div>
                    <div className="event-message">{String(event.message ?? 'Waiting for workflow event')}</div>
                  </div>
                ))}
              </div>
            </div>
          </main>

          <aside className="context-panel evidence-panel">
            <div className="panel-subtitle">Evidence</div>
            <div className="evidence-section">
              <div className="section-title">Hypotheses</div>
              <div className="hypothesis-list">
                {hypothesisList.map((hypothesis, index) => (
                  <div key={`${hypothesis.title ?? 'hypothesis'}-${index}`} className="hypothesis-row">
                    <div className="hypothesis-header">
                      <span>#{index + 1} {hypothesis.title ?? 'Hypothesis'}</span>
                      <strong>{Math.round((safeNumber(hypothesis.confidence, 0)) * 100)}%</strong>
                    </div>
                    <div className="hypothesis-status">{hypothesis.rationale ?? 'Not available'}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="evidence-section">
              <div className="section-title">Confidence</div>
              <div className="confidence-meter-wrap">
                <div className="confidence-ring" style={{ background: `conic-gradient(#60a5fa ${confidenceValue}%, rgba(148,163,184,0.12) 0)` }}>
                  <div className="confidence-ring-inner"><strong>{confidenceValue}%</strong></div>
                </div>
              </div>
            </div>

            <div className="evidence-section">
              <div className="section-title">Evidence</div>
              <ul className="evidence-list">
                {(evidenceList && evidenceList.length ? evidenceList : ['Not available']).map((item, index) => <li key={`${item}-${index}`}>{String(item)}</li>)}
              </ul>
            </div>
          </aside>
        </section>

        <section className="panel completion-panel">
          <div className="completion-header"><span className="badge">INVESTIGATION COMPLETE</span></div>
          <div className="completion-body">
            <div className="final-conclusion-block">
              <div className="eyebrow">Final Conclusion</div>
              <h3>{detailInvestigation.finalConclusion ?? 'Not available'}</h3>
            </div>
            <div className="completion-metrics">
              <div className="mini-metric"><span>Confidence</span><strong>{confidenceValue}%</strong></div>
              <div className="mini-metric"><span>Iterations</span><strong>{String(detailInvestigation.iteration ?? 0)}</strong></div>
              <div className="mini-metric"><span>Experiment</span><strong>{detailInvestigation.experiment ? '1' : '0'}</strong></div>
              <div className="mini-metric"><span>Evidence</span><strong>{String((evidenceList ?? []).length)}</strong></div>
            </div>
            <div className="completion-actions">
              <button className="action-button primary" onClick={() => { setQuestion(detailInvestigation.question ?? 'What do you want to investigate?'); setDetailInvestigation(null); setActiveView('overview'); }}>Run Again</button>
              <button className="action-button secondary" onClick={handleExport}>Export</button>
              <button className="action-button secondary" onClick={() => setDeleteTargetId(String(detailInvestigation.id ?? ''))}>Delete</button>
            </div>
          </div>
        </section>
      </motion.div>
    );
  };

  const renderInvestigationsList = () => (
    <div className="panel">
      <div className="panel-header">
        <div><p className="eyebrow">Investigations</p><h2>History</h2></div>
      </div>

      <div className="space-y-3 mb-4">
        <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="field-input" placeholder="Search investigations..." aria-label="Search investigations" />
        <div className="flex flex-wrap gap-2">
          {(['all', 'running', 'completed', 'failed'] as const).map((option) => (
            <button key={option} className={`segmented ${statusFilter === option ? 'active' : ''}`} onClick={() => setStatusFilter(option)}>{option}</button>
          ))}
          <select className="field-input" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} aria-label="Sort investigations">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </div>

      <div className="stack-list">
        {filteredHistory.length ? filteredHistory.map((item) => (
          <button key={String(item.id ?? Math.random())} className="list-card" onClick={() => { void openInvestigation(String(item.id ?? '')); }}>
            <div className="list-card-top">
              <span className="list-title">{String(item.question ?? 'Investigation')}</span>
              <span className={`tiny-badge ${statusColors[String(item.status ?? 'idle')] ?? 'bg-slate-700'}`}>{String(item.status ?? 'idle')}</span>
            </div>
            <div className="list-meta-row">
              <span>Confidence {safeNumber(item.confidence, 0).toFixed(2)}</span>
              <span>Iterations {safeNumber(item.iteration, 0)}</span>
              <span>{formatDate(String(item.createdAt ?? ''))}</span>
            </div>
          </button>
        )) : <div className="empty-box">No investigations match the current filter.</div>}
      </div>
    </div>
  );

  const renderExperiments = () => (
    <div className="panel">
      <div className="panel-header">
        <div><p className="eyebrow">Experiment Center</p><h2>Executed Experiments</h2></div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Experiment</th>
              <th>Investigation</th>
              <th>Hypothesis</th>
              <th>Status</th>
              <th>Result</th>
              <th>Confidence</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {visibleExperiments.length ? visibleExperiments.map((experiment) => (
              <tr key={String(experiment.id)} onClick={() => setSelectedExperiment(experiment)} style={{ cursor: 'pointer' }}>
                <td>{String(experiment.experiment ?? 'Experiment')}</td>
                <td>{String(experiment.investigation ?? 'Investigation')}</td>
                <td>{String(experiment.hypothesis ?? 'Hypothesis')}</td>
                <td><span className={`tiny-badge ${statusColors[String(experiment.status ?? 'idle')] ?? 'bg-slate-700'}`}>{String(experiment.status ?? 'idle')}</span></td>
                <td>{String(experiment.result ?? 'Not available')}</td>
                <td>{Math.round(safeNumber(experiment.confidence, 0) * 100)}%</td>
                <td>{formatDate(String(experiment.timestamp ?? ''))}</td>
              </tr>
            )) : <tr><td colSpan={7} className="empty-row">No experiments yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {selectedExperiment ? (
        <div className="modal-backdrop" onClick={() => setSelectedExperiment(null)}>
          <div className="command-palette" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="command-header">
              <span>Experiment Detail</span>
              <button className="icon-button" onClick={() => setSelectedExperiment(null)}>✕</button>
            </div>
            <div className="space-y-3">
              <div><strong>Objective</strong><p>{String((selectedExperiment.detail as InvestigationRecord)?.interpretedProblem ?? 'Not available')}</p></div>
              <div><strong>Hypothesis</strong><p>{String(selectedExperiment.hypothesis ?? 'Not available')}</p></div>
              <div><strong>Method</strong><p>{String((selectedExperiment.detail as InvestigationRecord)?.experiment?.description ?? 'Not available')}</p></div>
              <div><strong>Input</strong><p>{JSON.stringify((selectedExperiment.detail as InvestigationRecord)?.experiment?.inputs ?? {}, null, 2) || 'Not available'}</p></div>
              <div><strong>Result</strong><p>{String(selectedExperiment.result ?? 'Not available')}</p></div>
              <div><strong>Analysis</strong><p>{String((selectedExperiment.detail as InvestigationRecord)?.analysis ?? 'Not available')}</p></div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderInsights = () => (
    <div className="space-y-6">
      <div className="panel">
        <div className="panel-header">
          <div><p className="eyebrow">Insights</p><h2>Investigation intelligence</h2></div>
        </div>

        {history.length ? (
          <div className="insight-grid">
            {derivedInsights.map((insight) => (
              <InsightCard key={insight.label} label={insight.label} value={String(insight.value)} />
            ))}
          </div>
        ) : (
          <div className="empty-box">Complete more investigations to unlock insights.</div>
        )}
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="panel">
      <div className="panel-header">
        <div><p className="eyebrow">Analytics</p><h2>Performance overview</h2></div>
      </div>

      {history.length ? (
        <div className="analytics-grid">
          <div className="chart-card">
            <div className="chart-title">Investigations over time</div>
            <div className="bars">
              {analytics.investigationsOverTime.length ? analytics.investigationsOverTime.slice(0, 6).map((item, index) => (
                <div key={`${item.date}-${index}`} className="bar-group">
                  <span className="bar" style={{ height: `${Math.max(18, item.count * 60)}%` }} />
                </div>
              )) : <div className="empty-box full">Not enough investigation data yet.</div>}
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-title">Confidence distribution</div>
            <div className="ring-stack">
              <div className="ring-ring ring-sky" style={{ opacity: 0.4 + analytics.confidenceDistribution.high / Math.max(1, history.length) }} />
              <div className="ring-ring ring-teal" style={{ opacity: 0.4 + analytics.confidenceDistribution.medium / Math.max(1, history.length) }} />
              <div className="ring-ring ring-emerald" style={{ opacity: 0.4 + analytics.confidenceDistribution.low / Math.max(1, history.length) }} />
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-title">Experiment outcomes</div>
            <div className="list-meta-row">
              <span>Completed {analytics.experimentOutcomes.completed}</span>
              <span>Failed {analytics.experimentOutcomes.failed}</span>
              <span>Running {analytics.experimentOutcomes.running}</span>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-title">Iterations</div>
            <div className="bars">
              {analytics.iterationsPerInvestigation.length ? analytics.iterationsPerInvestigation.slice(0, 6).map((item, index) => (
                <div key={`${item.label}-${index}`} className="bar-group">
                  <span className="bar" style={{ height: `${Math.max(18, (item.iterations / Math.max(1, ...analytics.iterationsPerInvestigation.map((entry) => entry.iterations))) * 100)}%` }} />
                </div>
              )) : <div className="empty-box full">Not enough investigation data yet.</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-box">Not enough investigation data yet.</div>
      )}
    </div>
  );

  const renderProfile = () => (
    <div className="panel">
      <div className="panel-header">
        <div><p className="eyebrow">Settings</p><h2>User profile</h2></div>
      </div>

      <div className="profile-card">
        <div className="profile-avatar">{(user?.email ?? 'M').slice(0, 1).toUpperCase()}</div>
        <div className="profile-meta">
          <div className="profile-line"><span>Email</span><strong>{user?.email ?? 'Not signed in'}</strong></div>
          <div className="profile-line"><span>Account status</span><strong>{user ? 'Active' : 'Signed out'}</strong></div>
          <div className="profile-line"><span>User ID</span><strong>{user?.uid ? `${user.uid.slice(0, 8)}…` : 'Unavailable'}</strong></div>
        </div>
      </div>

      <div className="theme-toggle-row">
        {(['dark', 'light', 'system'] as const).map((option) => (
          <button key={option} className={`segmented ${theme === option ? 'active' : ''}`} onClick={() => setTheme(option)}>{option}</button>
        ))}
      </div>

      {!user ? (
        <div className="mt-6 space-y-3">
          <input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email" className="field-input" />
          <input value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Password" type="password" className="field-input" />
          <div className="flex gap-3">
            <button className="action-button primary" onClick={handleAuth}>Login</button>
            <button className="action-button secondary" onClick={() => setAuthMode('register')}>Register</button>
          </div>
          {authStatus ? <div className="success-box">{authStatus}</div> : null}
        </div>
      ) : (
        <button className="action-button secondary mt-6" onClick={handleLogout}>Sign Out</button>
      )}
    </div>
  );

  const searchResultsFlat = [...searchResults.investigations, ...searchResults.experiments];

  const contentMap: Record<ViewId, JSX.Element> = {
    overview: renderOverview(),
    investigations: detailInvestigation ? renderInvestigationDetail() : renderInvestigationsList(),
    experiments: renderExperiments(),
    insights: renderInsights(),
    analytics: renderAnalytics(),
    profile: renderProfile(),
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="brand-wrap">
          <div className="brand-mark">M</div>
          {!sidebarCollapsed ? <div><div className="brand-name">MORPHOS</div><div className="brand-subtitle">AI Experimentation</div></div> : null}
        </div>

        <nav className="nav-stack">
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${activeView === item.id ? 'active' : ''}`} onClick={() => setActiveView(item.id)}>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item small" onClick={() => setSidebarCollapsed((value) => !value)}>{sidebarCollapsed ? 'Expand' : 'Collapse'}</button>
        </div>
      </aside>

      <div className="main-panel-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label="Toggle sidebar">☰</button>
            <div className="crumbs">Workspace / {activeView}</div>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => setSearchOpen(true)} aria-label="Open search">⌕</button>
            <button className="icon-button" onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">☼</button>
            <div className="avatar-badge" aria-label="Current user">{(user?.email ?? 'M').slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <main className="page-shell">{contentMap[activeView]}</main>
      </div>

      {deleteTargetId ? (
        <div className="modal-backdrop" onClick={() => setDeleteTargetId(null)}>
          <div className="command-palette" onClick={(event) => event.stopPropagation()}>
            <div className="command-header">
              <span>Delete this investigation?</span>
              <button className="icon-button" onClick={() => setDeleteTargetId(null)}>✕</button>
            </div>
            <div className="space-y-4 pt-3">
              <p>This action cannot be undone. It will remove the investigation from your Firestore history.</p>
              <div className="completion-actions">
                <button className="action-button secondary" onClick={() => setDeleteTargetId(null)}>Cancel</button>
                <button className="action-button primary" onClick={() => { void handleDeleteInvestigation(deleteTargetId); }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {searchOpen ? (
        <div className="modal-backdrop" onClick={() => setSearchOpen(false)}>
          <div className="command-palette" onClick={(event) => event.stopPropagation()}>
            <div className="command-header">
              <span>Search</span>
              <button className="icon-button" onClick={() => setSearchOpen(false)}>✕</button>
            </div>
            <input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="field-input command-search" placeholder="Search investigations, experiments, conclusions..." aria-label="Search" />
            <div className="search-results">
              {searchResultsFlat.length ? (
                <>
                  <div className="search-group-label">INVESTIGATIONS</div>
                  {searchResults.investigations.map((item, index) => (
                    <button key={`inv-${String(item.id ?? index)}`} className={`search-result ${searchIndex === index ? 'selected' : ''}`} onClick={() => { void openInvestigation(String(item.id ?? '')); setSearchOpen(false); }}>
                      <div className="search-title">{String(item.question ?? 'Investigation')}</div>
                      <div className="search-meta">{String(item.status ?? 'idle')} • {formatDate(String(item.createdAt ?? ''))}</div>
                    </button>
                  ))}
                  <div className="search-group-label">EXPERIMENTS</div>
                  {searchResults.experiments.map((item, index) => (
                    <button key={`exp-${String(item.id ?? index)}`} className={`search-result ${searchIndex === index + searchResults.investigations.length ? 'selected' : ''}`} onClick={() => { setSelectedExperiment(item); setSearchOpen(false); }}>
                      <div className="search-title">{String(item.experiment ?? 'Experiment')}</div>
                      <div className="search-meta">{String(item.investigation ?? 'Investigation')}</div>
                    </button>
                  ))}
                </>
              ) : <div className="empty-box">No matches found.</div>}
            </div>
          </div>
        </div>
      ) : null}

      <div className="toast-container">
        <AnimatePresence>
          {toastQueue.map((toast) => (
            <motion.div key={toast.id} className={`toast ${toast.type}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'sky' | 'teal' | 'emerald' | 'amber'; }) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="insight-card">
      <div className="label">{label}</div>
      <div className="insight-value">{value}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="empty-box">{message}</div>;
}

function LoadingState() {
  return (
    <div className="panel">
      <div className="loading-state">
        <div className="loading-title">Loading investigation...</div>
        <div className="loading-bars">
          {loadingStages.map((stage, index) => (
            <div key={stage} className={`loading-bar ${index === 0 ? 'active' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
