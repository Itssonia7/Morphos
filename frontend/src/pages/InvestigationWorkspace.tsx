import { useState } from 'react';
import {
  InvestigationRecord,
  InvestigationResponse,
  InvestigationDomain,
  ResultStatus,
  Hypothesis,
} from '../types';
import { classifyDomain, getDomainInsights } from '../services/domain';
import {
  IconCheck,
  IconCpu,
  IconDownload,
  IconRefresh,
  IconTrash,
  IconShield,
  IconTerminal,
  IconChevronDown,
  IconCopy,
  IconSparkles,
  IconBot,
} from '../components/Icons';

interface InvestigationWorkspaceProps {
  investigation: InvestigationRecord | InvestigationResponse;
  onBack: () => void;
  onRunAgain: (q: string) => void;
  onExport: () => void;
  onDelete?: () => void;
  isRunning?: boolean;
  onOpenCopilot?: () => void;
}

export default function InvestigationWorkspace({
  investigation,
  onBack,
  onRunAgain,
  onExport,
  onDelete,
  isRunning = false,
  onOpenCopilot,
}: InvestigationWorkspaceProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [selectedHypothesisIndex, setSelectedHypothesisIndex] = useState<number>(0);
  const [copiedState, setCopiedState] = useState(false);

  const question = investigation.question || 'Untitled Investigation';
  const domain: InvestigationDomain =
    investigation.domain || classifyDomain(question).domain;

  const rawConfidence = Number(investigation.confidence ?? 0.72);
  const confidencePct = Math.round(rawConfidence * (rawConfidence <= 1 ? 100 : 1));
  const confidenceTier: 'High' | 'Medium' | 'Low' =
    confidencePct >= 70 ? 'High' : confidencePct >= 45 ? 'Medium' : 'Low';

  const resultStatus: ResultStatus =
    investigation.resultStatus ||
    (domain === 'ml_model_performance'
      ? 'no_matching_template'
      : investigation.isLocal
      ? 'simulated'
      : 'simulated');

  const hypotheses: Hypothesis[] =
    investigation.hypotheses && investigation.hypotheses.length > 0
      ? investigation.hypotheses
      : [];

  const activeHypothesis =
    hypotheses.length > selectedHypothesisIndex
      ? hypotheses[selectedHypothesisIndex]
      : investigation.selectedHypothesis || (hypotheses.length > 0 ? hypotheses[0] : null);

  const insights = getDomainInsights(domain, activeHypothesis?.title);

  // Extract plain-English answer
  const plainEnglishAnswer = (() => {
    if (resultStatus === 'no_matching_template') {
      return 'Possible causes include overfitting, noisy labels, distribution shift, or insufficient regularization.';
    }
    if (domain === 'ml_model_performance') {
      return 'Possible causes include overfitting, noisy labels, distribution shift, or insufficient regularization.';
    }
    if (activeHypothesis) {
      return `${activeHypothesis.title} is causing the observed performance degradation.`;
    }
    return insights.plainEnglishAnswer;
  })();

  // 3 short evidence bullets
  const evidenceBullets = (() => {
    if (resultStatus === 'no_matching_template') {
      return [
        'No matching experiment was available for this question.',
        'These are domain-based hypotheses, not measured findings.',
        'Validate them with real model training and evaluation data.',
      ];
    }
    if (activeHypothesis && activeHypothesis.evidence && activeHypothesis.evidence.length >= 2) {
      const list = [...activeHypothesis.evidence];
      if (list.length < 3 && insights.evidence.length > 0) {
        list.push(insights.evidence[0]);
      }
      return list.slice(0, 3);
    }
    return insights.evidence.slice(0, 3);
  })();

  // 2-3 concrete actions
  const recommendedActions = insights.recommendedActions.slice(0, 3);

  // Stepper stages (LangGraph Observable Lifecycle)
  const pipelineStages = [
    { num: 1, label: 'Asked', desc: 'Received question and parsed context' },
    { num: 2, label: 'Understood', desc: 'Identified problem boundaries and domain' },
    { num: 3, label: 'Hypotheses', desc: 'Generated structured causal candidates' },
    { num: 4, label: 'Experiment', desc: 'Selected deterministic benchmark tool' },
    { num: 5, label: 'Execution', desc: 'Ran isolated sandbox telemetry' },
    { num: 6, label: 'Analysis', desc: 'Compared observed vs baseline metrics' },
    { num: 7, label: 'Confidence', desc: 'Bayesian evidence update evaluation' },
    { num: 8, label: 'Conclusion', desc: 'Finalized executive explanation' },
  ];

  const currentStageIndex = isRunning ? 4 : 7;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(investigation, null, 2));
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header & Context Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#0D0F17] border border-white/[0.08] shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.06] text-xs font-mono transition-colors flex items-center gap-1.5"
            title="Back to Overview"
          >
            <span>←</span>
            <span className="hidden sm:inline uppercase tracking-wider text-[11px]">Overview</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#FF6A3D]/10 text-[#FF9A4D] border border-[#FF6A3D]/30 font-semibold">
              {domain.replace(/_/g, ' ')}
            </span>

            {resultStatus === 'no_matching_template' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Reasoning Only
              </span>
            ) : resultStatus === 'real' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Measured Result
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-[#FF6A3D]/10 text-[#FF9A4D] border border-[#FF6A3D]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A3D]" />
                Simulated Sandbox
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {onOpenCopilot && (
            <button
              onClick={onOpenCopilot}
              className="btn-secondary py-2 px-3 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5 text-[#FF9A4D] border-[#FF6A3D]/30 hover:border-[#FF6A3D] hover:text-white shadow-[0_0_12px_rgba(255,106,61,0.15)]"
              title="Open AI Agent Copilot"
            >
              <IconBot className="w-3.5 h-3.5 text-[#FF6A3D]" />
              <span>Ask Agent</span>
            </button>
          )}

          <button
            onClick={onExport}
            className="btn-secondary py-2 px-3 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5 text-slate-300 hover:text-white"
            title="Export markdown report"
          >
            <IconDownload className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          <button
            onClick={() => onRunAgain(question)}
            className="btn-agent py-2 px-4 text-xs uppercase tracking-wider font-bold flex items-center gap-1.5"
          >
            <IconRefresh className="w-3.5 h-3.5" />
            <span>Re-Run</span>
          </button>

          {onDelete && (
            <button
              onClick={onDelete}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Delete investigation"
              aria-label="Delete investigation"
            >
              <IconTrash className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Analysis (Left/Center) + Telemetry & Stepper (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT / MAIN COLUMN (8 cols on lg)                         */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. EXECUTIVE CONCLUSION CARD */}
          <section className="relative rounded-3xl bg-gradient-to-b from-[#120F18] to-[#0A080E] border border-[#FF6A3D]/30 p-6 sm:p-8 shadow-[0_0_35px_rgba(255,106,61,0.15)] space-y-5 overflow-hidden">
            {/* Ambient Coral Glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#FF6A3D]/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#FF9A4D]/08 blur-3xl pointer-events-none" />

            {/* Header / Question Label */}
            <div className="space-y-2 relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#FF6A3D] font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#FF6A3D] animate-pulse" />
                  INVESTIGATION CONCLUSION
                </span>
                <span className="text-xs font-mono text-slate-400">
                  ID: {String(investigation.id || 'guest-run').slice(0, 16)}
                </span>
              </div>

              <h1 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight leading-snug">
                {question}
              </h1>
            </div>

            {/* Plain-English Answer Banner */}
            <div className="p-5 rounded-2xl bg-[#07060A]/90 border border-white/[0.08] space-y-2 relative z-10 shadow-inner">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#FF9A4D] font-bold block">
                Primary Finding &amp; Causal Explanation
              </span>
              <p className="text-base sm:text-lg font-medium text-white leading-relaxed">
                {plainEnglishAnswer}
              </p>
            </div>

            {/* Confidence Gauge & What This Means */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1 relative z-10">
              {/* Confidence Meter Card */}
              <div className="md:col-span-5 p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                    {resultStatus === 'no_matching_template' ? 'Assessment' : 'Confidence'}
                  </span>
                  <span className="font-display font-extrabold text-2xl text-white mt-0.5 block">
                    {confidencePct}%
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {confidenceTier} Credibility
                  </span>
                </div>
                <div className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                  resultStatus === 'no_matching_template'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : confidenceTier === 'High'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : confidenceTier === 'Medium'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30'
                }`}>
                  {resultStatus === 'no_matching_template' ? 'PRELIMINARY' : confidenceTier.toUpperCase()}
                </div>
              </div>

              {/* What This Means Context */}
              <div className="md:col-span-7 p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  {resultStatus === 'no_matching_template' ? 'Assessment Context' : 'What This Means'}
                </span>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {resultStatus === 'no_matching_template'
                    ? 'This reflects domain reasoning based on question formulation. No matching local tool template was available.'
                    : insights.whatThisMeans}
                </p>
              </div>
            </div>
          </section>

          {/* 2. WHY WE THINK SO (MEASURED EVIDENCE) */}
          <section className="p-6 rounded-2xl bg-[#0D0D12] border border-white/[0.07] space-y-4 shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
              <IconShield className="w-4 h-4 text-[#FF6A3D]" />
              <h2 className="font-display font-bold text-sm text-white tracking-wide uppercase">
                Observed Evidence &amp; Telemetry
              </h2>
            </div>

            <ul className="space-y-2.5 pt-1">
              {evidenceBullets.map((bullet, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs sm:text-sm text-slate-200 leading-relaxed"
                >
                  <span className="w-5 h-5 rounded-full bg-[#FF6A3D]/10 text-[#FF9A4D] border border-[#FF6A3D]/25 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    ✓
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 3. WHAT WE TESTED / CANDIDATE HYPOTHESES */}
          <section className="p-6 rounded-2xl bg-[#0D0D12] border border-white/[0.07] space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <IconSparkles className="w-4 h-4 text-[#FF6A3D]" />
                <h2 className="font-display font-bold text-sm text-white tracking-wide uppercase">
                  {resultStatus === 'no_matching_template' ? 'Domain Hypotheses Evaluated' : 'Hypotheses Tested'}
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {hypotheses.length} EXPLANATIONS ANALYZED
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {hypotheses.map((hyp, index) => {
                const hConf = Number(hyp.confidence ?? 0.5);
                const hPct = Math.round(hConf * (hConf <= 1 ? 100 : 1));
                const status: 'Likely' | 'Possible' | 'Unlikely' =
                  hPct >= 65 ? 'Likely' : hPct >= 45 ? 'Possible' : 'Unlikely';

                const isSelected = selectedHypothesisIndex === index;

                const statusColor =
                  status === 'Likely'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : status === 'Possible'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-zinc-700/30 text-zinc-400 border-zinc-600/30';

                const barColor =
                  status === 'Likely'
                    ? 'bg-emerald-500'
                    : status === 'Possible'
                    ? 'bg-amber-500'
                    : 'bg-slate-600';

                return (
                  <div
                    key={hyp.id || index}
                    onClick={() => setSelectedHypothesisIndex(index)}
                    className={`p-4 sm:p-5 rounded-xl border transition-all cursor-pointer space-y-3 ${
                      isSelected
                        ? 'bg-[#FF6A3D]/10 border-[#FF6A3D]/40 shadow-[0_0_15px_rgba(255,106,61,0.15)]'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.035]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-[#FF9A4D] uppercase font-bold">
                            H{index + 1}
                          </span>
                          <h3 className="font-semibold text-sm sm:text-base text-white tracking-tight">
                            {hyp.title}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {hyp.rationale}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-display font-bold text-sm text-white font-mono">
                          {hPct}%
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${statusColor}`}>
                          {status}
                        </span>
                      </div>
                    </div>

                    {/* Confidence Meter Bar */}
                    <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${Math.max(5, Math.min(100, hPct))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 4. WHAT TO DO NEXT (RECOMMENDED ACTIONS) */}
          <section className="p-6 rounded-2xl bg-[#0D0D12] border border-white/[0.07] space-y-4 shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
              <IconCpu className="w-4 h-4 text-[#FF6A3D]" />
              <h2 className="font-display font-bold text-sm text-white tracking-wide uppercase">
                Actionable Remediation Steps
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              {recommendedActions.map((action, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2 flex flex-col justify-between"
                >
                  <span className="text-[10px] font-mono text-[#FF9A4D] font-bold uppercase tracking-wider">
                    Step 0{idx + 1}
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {action}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* 5. AI AGENT COPILOT CONSULTATION BANNER */}
          {onOpenCopilot && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-[#18110D] via-[#0E0B0A] to-[#07060A] border border-[#FF6A3D]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_25px_rgba(255,106,61,0.15)]">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF6A3D] to-[#FF9A4D] p-[1px] shrink-0 shadow-[0_0_15px_rgba(255,106,61,0.35)]">
                  <div className="w-full h-full bg-[#0A0705] rounded-xl flex items-center justify-center">
                    <IconBot className="w-5 h-5 text-[#FF9A4D]" />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Consult MORPHOS AI Agent on this Result</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#FF6A3D]/20 text-[#FF9A4D] border border-[#FF6A3D]/30 font-bold">
                      LIVE
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Ask the agent to formulate custom test fixtures, evaluate code fixes, or stress-test these findings.
                  </div>
                </div>
              </div>

              <button
                onClick={onOpenCopilot}
                className="btn-agent py-2 px-4 text-xs font-mono uppercase tracking-wider shrink-0 flex items-center gap-1.5 shadow-[0_0_15px_rgba(255,106,61,0.25)] hover:shadow-[0_0_25px_rgba(255,106,61,0.45)] font-bold"
              >
                <IconBot className="w-3.5 h-3.5" />
                <span>Open Copilot</span>
              </button>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: PIPELINE STEPPER & TELEMETRY (4 cols on lg) */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-6">
          {/* Observable LangGraph Lifecycle Pipeline */}
          <section className="p-6 rounded-2xl bg-[#0D0D12] border border-white/[0.07] space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FF6A3D] animate-pulse" />
                <h2 className="font-display font-bold text-xs tracking-wider uppercase text-white">
                  Lifecycle Pipeline
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                8 STAGES
              </span>
            </div>

            <div className="space-y-2 pt-1">
              {pipelineStages.map((stage, idx) => {
                const isDone = idx <= currentStageIndex;
                const isActive = idx === currentStageIndex && isRunning;

                return (
                  <div
                    key={stage.num}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                      isActive
                        ? 'bg-[#FF6A3D]/20 border-[#FF6A3D] ring-1 ring-[#FF6A3D]/40 shadow-[0_0_15px_rgba(255,106,61,0.25)]'
                        : isDone
                        ? 'bg-white/[0.02] border-white/[0.07]'
                        : 'bg-white/[0.005] border-white/[0.03] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`text-[10px] font-mono font-bold shrink-0 ${
                        isActive ? 'text-[#FF6A3D]' : isDone ? 'text-white' : 'text-slate-600'
                      }`}>
                        0{stage.num}
                      </span>
                      <div className="min-w-0">
                        <div className={`text-xs font-semibold truncate ${
                          isActive ? 'text-[#FF9A4D]' : isDone ? 'text-slate-200' : 'text-slate-500'
                        }`}>
                          {stage.label}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {stage.desc}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 ml-2">
                      {isActive ? (
                        <span className="w-3.5 h-3.5 border-2 border-[#FF6A3D] border-t-transparent rounded-full animate-spin inline-block" />
                      ) : isDone ? (
                        <span className="text-emerald-400 text-xs font-bold">✓</span>
                      ) : (
                        <span className="text-slate-600 text-xs">•</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Execution Telemetry Card */}
          <section className="p-5 rounded-2xl bg-[#0D0D12] border border-white/[0.07] space-y-3 shadow-sm text-xs font-mono">
            <div className="flex items-center gap-2 text-slate-400 pb-2 border-b border-white/[0.06]">
              <IconTerminal className="w-3.5 h-3.5 text-[#FF6A3D]" />
              <span className="text-[10px] uppercase tracking-wider font-semibold">
                EXECUTION TELEMETRY
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">DOMAIN</span>
                <span className="text-white font-semibold">{domain}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">STATUS</span>
                <span className="text-[#FF6A3D] font-bold">{String(investigation.status || 'finalized').toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">STORAGE</span>
                <span className="text-white">{investigation.isLocal ? 'Local Cache' : 'Firestore Persisted'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ITERATION</span>
                <span className="text-white">{Number(investigation.iteration ?? 1)} / {Number(investigation.maxIterations ?? 5)}</span>
              </div>
              {investigation.experiment?.tool && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">TOOL</span>
                  <span className="text-[#FF9A4D] font-semibold">{String(investigation.experiment.tool)}</span>
                </div>
              )}
            </div>
          </section>

          {/* Technical Details Accordion */}
          <section className="rounded-2xl bg-[#0D0D12] border border-white/[0.07] overflow-hidden shadow-sm">
            <button
              onClick={() => setShowTechnicalDetails((prev) => !prev)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
              aria-expanded={showTechnicalDetails}
            >
              <div className="flex items-center gap-2">
                <IconTerminal className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-display font-bold text-xs tracking-wider uppercase text-white">
                  Technical Details
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#FF6A3D] uppercase font-bold">
                {showTechnicalDetails ? 'Collapse ▲' : 'Expand ▼'}
              </span>
            </button>

            {showTechnicalDetails && (
              <div className="p-4 pt-0 border-t border-white/[0.06] space-y-4 mt-2">
                {/* Copy JSON Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleCopyJson}
                    className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[10px] font-mono text-slate-300 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <IconCopy className="w-3 h-3" />
                    <span>{copiedState ? 'Copied!' : 'Copy State'}</span>
                  </button>
                </div>

                {/* Experiment Config */}
                {investigation.experiment && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">
                      Experiment Configuration
                    </span>
                    <pre className="p-3 rounded-xl bg-black border border-white/[0.08] text-[11px] font-mono text-slate-300 overflow-x-auto">
                      {JSON.stringify(investigation.experiment, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Experiment Result */}
                {investigation.experimentResult && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">
                      Experiment Output
                    </span>
                    <pre className="p-3 rounded-xl bg-black border border-white/[0.08] text-[11px] font-mono text-slate-300 overflow-x-auto">
                      {JSON.stringify(investigation.experimentResult, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Full State */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">
                    Full State Machine
                  </span>
                  <pre className="p-3 rounded-xl bg-black border border-white/[0.08] text-[11px] font-mono text-slate-300 max-h-60 overflow-y-auto leading-relaxed">
                    {JSON.stringify(investigation, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
