import { useState } from 'react';
import { InvestigationRecord } from '../types';
import {
  IconCpu,
  IconSparkles,
  IconArrowRight,
  IconActivity,
  IconExperiment,
  IconInvestigation,
  IconShield,
  IconTerminal,
} from '../components/Icons';

interface DashboardViewProps {
  question: string;
  setQuestion: (q: string) => void;
  onStartInvestigation: () => void;
  onTryDemo: () => void;
  loading: boolean;
  error: string | null;
  history: InvestigationRecord[];
  onOpenInvestigation: (id: string) => void;
  metrics: {
    totalInvestigations: number;
    experimentsRun: number;
    avgConfidence: number;
    completionRate: number;
  };
}

export default function DashboardView({
  question,
  setQuestion,
  onStartInvestigation,
  onTryDemo,
  loading,
  error,
  history,
  onOpenInvestigation,
  metrics,
}: DashboardViewProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const sampleQuestions = [
    'Why is API latency increasing under high request concurrency?',
    'Why does memory usage grow over time in background workers?',
    'Why is database throughput falling under write-heavy load?',
    'Why does model accuracy decrease as dataset size scales?',
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Top Banner / Autonomous Agent Provider Telemetry */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0D0D12] border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF6A3D] animate-ping absolute opacity-75" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF6A3D] relative" />
          </div>
          <div>
            <div className="text-[10px] font-mono tracking-widest uppercase text-slate-400 font-semibold flex items-center gap-1.5">
              <span>AUTONOMOUS AGENT ORCHESTRATION</span>
              <span className="text-slate-600">•</span>
              <span className="text-[#FF6A3D]">NODE 01</span>
            </div>
            <div className="text-xs text-white font-medium">
              Deterministic Fallback Active • LangGraph State Machine Ready
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full bg-[#FF6A3D]/10 text-[#FF9A4D] border border-[#FF6A3D]/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A3D]" />
            LANGGRAPH 0.2
          </span>
          <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full bg-[#FF6A3D]/10 text-[#FF9A4D] border border-[#FF6A3D]/30">
            MAX 5 ITERATIONS
          </span>
        </div>
      </div>

      {/* Hero Command Console */}
      <div className="p-7 sm:p-9 rounded-3xl bg-gradient-to-b from-[#0F0D14] to-[#0A080D] border border-white/[0.1] shadow-2xl relative overflow-hidden">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF6A3D]/10 blur-[110px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-[#FF9A4D]/08 blur-[100px] pointer-events-none" />

        <div className="space-y-6 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#FF6A3D] font-semibold">
                {getGreeting()} • OPERATOR CONSOLE
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-4xl text-white tracking-tight">
              AUTONOMOUS AI INVESTIGATION
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              Describe a latency regression, memory leak, or performance anomaly. MORPHOS parses the problem, formulates candidate hypotheses, runs deterministic benchmark experiments, and computes Bayesian confidence.
            </p>
          </div>

          {/* Large Command Textarea / Input */}
          <div className="relative">
            <textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={1000}
              aria-label="Investigation question or anomaly description"
              placeholder="e.g. Why is API latency increasing under high request concurrency?"
              className="w-full p-4 sm:p-5 rounded-2xl bg-[#060608] border border-white/[0.12] text-white placeholder-slate-500 text-base sm:text-lg font-sans focus:outline-none focus:border-[#FF6A3D] focus:ring-1 focus:ring-[#FF6A3D] transition-all shadow-inner leading-relaxed resize-none"
            />
            <div className="flex justify-between items-center px-1 mt-1 text-[10px] font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <IconTerminal className="w-3 h-3 text-slate-400" />
                Evidence-driven execution • Min. 8 characters
              </span>
              <span className={question.length > 900 ? 'text-amber-400' : 'text-slate-400'}>
                {question.length}/1000
              </span>
            </div>
          </div>

          {/* Recommended Question Chips */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
              <IconSparkles className="w-3 h-3 text-[#FF6A3D]" />
              RECOMMENDED BENCHMARK TEMPLATES
            </div>
            <div className="flex flex-wrap gap-2">
              {sampleQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuestion(q)}
                  className={`text-xs px-3.5 py-1.5 rounded-full border transition-all duration-200 text-left ${
                    question === q
                      ? 'bg-[#FF6A3D]/15 border-[#FF6A3D] text-white shadow-[0_0_14px_rgba(255,106,61,0.25)] font-medium'
                      : 'bg-white/[0.02] border-white/[0.08] text-slate-400 hover:border-[#FF6A3D]/40 hover:text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-4">
            <button
              onClick={onStartInvestigation}
              disabled={loading}
              className="btn-agent py-3.5 px-8 text-xs uppercase tracking-wider font-bold shadow-[0_0_25px_rgba(255,106,61,0.35)] hover:shadow-[0_0_35px_rgba(255,106,61,0.55)] disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>INVESTIGATING PIPELINE…</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>INITIATE INVESTIGATION</span>
                  <IconArrowRight className="w-4 h-4 text-white" />
                </span>
              )}
            </button>

            <button
              onClick={onTryDemo}
              disabled={loading}
              className="btn-secondary py-3.5 px-7 text-xs uppercase tracking-wider font-mono font-medium hover:border-white/30"
            >
              TRY VERIFIED DEMO
            </button>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs leading-relaxed font-mono">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-5 rounded-2xl bg-[#0D0D12] border border-white/[0.07] relative overflow-hidden space-y-2 group hover:border-[#FF6A3D]/40 transition-all">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#FF6A3D] to-transparent" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Total Investigations
            </span>
            <IconInvestigation className="w-4 h-4 text-[#FF6A3D] opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="font-display font-extrabold text-3xl text-white">
            {metrics.totalInvestigations}
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            Firestore records synced
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-2xl bg-[#0D0D12] border border-white/[0.07] relative overflow-hidden space-y-2 group hover:border-[#FF9A4D]/40 transition-all">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#FF9A4D] to-transparent" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Experiments Run
            </span>
            <IconExperiment className="w-4 h-4 text-[#FF9A4D] opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="font-display font-extrabold text-3xl text-white">
            {metrics.experimentsRun}
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            Deterministic tool sandbox
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-2xl bg-[#0D0D12] border border-white/[0.07] relative overflow-hidden space-y-2 group hover:border-amber-500/30 transition-all">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 to-transparent" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Average Confidence
            </span>
            <IconShield className="w-4 h-4 text-amber-400 opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="font-display font-extrabold text-3xl text-amber-300">
            {Math.round(metrics.avgConfidence * 100)}%
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            Bayesian belief score
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-2xl bg-[#0D0D12] border border-white/[0.07] relative overflow-hidden space-y-2 group hover:border-emerald-500/30 transition-all">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-400 to-transparent" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Completion Rate
            </span>
            <IconActivity className="w-4 h-4 text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="font-display font-extrabold text-3xl text-emerald-400">
            {Math.round(metrics.completionRate)}%
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            Converged investigations
          </div>
        </div>
      </div>

      {/* Recent Investigations Overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-lg text-white">
              Recent Investigations
            </h2>
            <p className="text-xs text-slate-400">
              Latest autonomous runs and verified hypotheses
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {history.length} SAVED INVESTIGATIONS
          </span>
        </div>

        {history.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {history.slice(0, 4).map((item, idx) => {
              const conf = Math.round(Number(item.confidence ?? 0) * (Number(item.confidence ?? 0) <= 1 ? 100 : 1));
              return (
                <div
                  key={String(item.id ?? idx)}
                  onClick={() => onOpenInvestigation(String(item.id ?? ''))}
                  className="p-5 rounded-2xl bg-[#0D0D12] border border-white/[0.07] hover:border-[#FF6A3D]/40 hover:bg-[#121016] transition-all cursor-pointer space-y-3 group shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#FF6A3D] block">
                        {String(item.domain ?? 'general').replace(/_/g, ' ')}
                      </span>
                      <h3 className="text-sm font-semibold text-white group-hover:text-[#FF9A4D] transition-colors line-clamp-1">
                        {String(item.question ?? 'Investigation')}
                      </h3>
                    </div>
                    <span className="status-pill status-completed shrink-0 text-[10px]">
                      {String(item.status ?? 'FINALIZED').toUpperCase()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {String(item.finalConclusion ?? item.analysis ?? 'Analysis concluded with verified evidence.')}
                  </p>

                  <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between text-[11px] font-mono">
                    <div className="flex items-center gap-2 text-slate-400">
                      <span>CONFIDENCE:</span>
                      <span className="text-[#FF6A3D] font-bold">{conf}%</span>
                    </div>
                    <span className="text-slate-400 group-hover:text-white transition-colors flex items-center gap-1">
                      <span>Open Workspace</span>
                      <IconArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-[#0D0D12]/50 border border-dashed border-white/[0.08] text-center space-y-3">
            <IconInvestigation className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No previous investigations found. Type a question above or click &ldquo;TRY VERIFIED DEMO&rdquo; to start your first run.
            </p>
          </div>
        )}
      </div>

      {/* Available Tools Telemetry Strip */}
      <div className="p-5 rounded-2xl bg-[#0D0D12]/60 border border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
            <IconCpu className="w-3.5 h-3.5 text-[#FF6A3D]" />
            AVAILABLE EXPERIMENT TOOLS
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            DETERMINISTIC SANDBOX
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
            <div className="text-xs font-mono font-semibold text-white">benchmarkTool</div>
            <p className="text-[11px] text-slate-400">
              Profiles response latency curves under synthetic client concurrency.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
            <div className="text-xs font-mono font-semibold text-white">calculatorTool</div>
            <p className="text-[11px] text-slate-400">
              Calculates numerical variance, P99 thresholds, and baseline deviations.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
            <div className="text-xs font-mono font-semibold text-white">mockDataTool</div>
            <p className="text-[11px] text-slate-400">
              Simulates distributed thread pool contention and socket saturation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
