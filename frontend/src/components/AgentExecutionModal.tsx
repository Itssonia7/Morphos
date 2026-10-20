import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconBot,
  IconCpu,
  IconTerminal,
  IconCheck,
} from './Icons';

interface AgentExecutionModalProps {
  isOpen: boolean;
  question: string;
}

const STAGES = [
  { id: 'interpretQuestion', label: 'Interpret Context', desc: 'Classifying domain & isolating problem boundaries', tool: 'Tokenizer' },
  { id: 'generateHypotheses', label: 'Formulate Hypotheses', desc: 'Synthesizing causal models via Bayesian prior', tool: 'StateGraph' },
  { id: 'selectExperiment', label: 'Select Experiment', desc: 'Selecting benchmarkTool concurrency parameters', tool: 'benchmarkTool' },
  { id: 'executeExperiment', label: 'Execute Sandbox', desc: 'Running synthetic threads in isolated telemetry sandbox', tool: 'Docker Engine' },
  { id: 'analyzeResults', label: 'Analyze Telemetry', desc: 'Measuring P99 latency variance vs baseline profile', tool: 'StatsEngine' },
  { id: 'evaluateConfidence', label: 'Bayesian Scoring', desc: 'Computing posterior probability distribution', tool: 'calculatorTool' },
  { id: 'finalize', label: 'Finalize Conclusion', desc: 'Assembling executive briefing & Firestore sync', tool: 'Persistence' },
];

export default function AgentExecutionModal({ isOpen, question }: AgentExecutionModalProps) {
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStageIdx(0);
      setTerminalLogs([]);
      return;
    }

    const startTime = Date.now();
    const getTimestamp = () => {
      const diff = ((Date.now() - startTime) / 1000).toFixed(2);
      return `+${diff}s`;
    };

    setTerminalLogs([
      `[0.00s] [ORCHESTRATOR] Initializing autonomous state machine for inquiry...`,
      `[0.10s] [INPUT] "${question.slice(0, 60)}${question.length > 60 ? '...' : ''}"`,
    ]);

    const stepInterval = setInterval(() => {
      setCurrentStageIdx((prev) => {
        const next = prev + 1;
        if (next < STAGES.length) {
          const currentStage = STAGES[next];
          setTerminalLogs((logs) => [
            ...logs,
            `[${getTimestamp()}] [${currentStage.id.toUpperCase()}] ${currentStage.desc}`,
          ]);
          return next;
        }
        return prev;
      });
    }, 450);

    return () => clearInterval(stepInterval);
  }, [isOpen, question]);

  if (!isOpen) return null;

  const currentStage = STAGES[currentStageIdx] || STAGES[STAGES.length - 1];
  const progressPct = Math.min(100, Math.round(((currentStageIdx + 1) / STAGES.length) * 100));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          className="w-full max-w-2xl rounded-3xl bg-[#0B0B10] border border-[#FF6A3D]/30 shadow-[0_0_50px_rgba(255,106,61,0.2)] overflow-hidden relative"
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-[#FF6A3D]/10 blur-[90px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#FF9A4D]/10 blur-[90px] pointer-events-none" />

          {/* Header */}
          <div className="p-6 border-b border-white/[0.08] relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF6A3D] to-[#FF9A4D] p-[1px] shadow-[0_0_15px_rgba(255,106,61,0.4)]">
                  <div className="w-full h-full bg-[#08080C] rounded-2xl flex items-center justify-center">
                    <IconBot className="w-5 h-5 text-[#FF9A4D] animate-pulse" />
                  </div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF6A3D] absolute -top-0.5 -right-0.5 animate-ping" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-base text-white tracking-wide">
                    AUTONOMOUS AGENT ORCHESTRATION
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FF6A3D]/10 text-[#FF9A4D] border border-[#FF6A3D]/30 animate-pulse">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  LangGraph 7-Node State Machine Execution
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="font-display font-extrabold text-2xl text-[#FF6A3D]">
                {progressPct}%
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                STAGE {currentStageIdx + 1} OF {STAGES.length}
              </div>
            </div>
          </div>

          {/* Question Banner */}
          <div className="px-6 py-3 bg-[#08080C] border-b border-white/[0.06] flex items-center gap-2 text-xs">
            <IconTerminal className="w-4 h-4 text-[#FF6A3D] shrink-0" />
            <span className="text-slate-400 font-mono truncate">
              Investigating: <span className="text-slate-200 font-sans font-medium">"{question}"</span>
            </span>
          </div>

          {/* Stepper Pipeline Visualizer */}
          <div className="p-6 space-y-6 relative z-10">
            {/* Progress Bar */}
            <div className="relative h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#FF6A3D] via-[#FF8544] to-[#FF9A4D] rounded-full"
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>

            {/* Stage Pills Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STAGES.slice(0, 4).map((stg, i) => {
                const isDone = i < currentStageIdx;
                const isCurrent = i === currentStageIdx;
                return (
                  <div
                    key={stg.id}
                    className={`p-3 rounded-xl border text-xs transition-all ${
                      isCurrent
                        ? 'bg-[#FF6A3D]/15 border-[#FF6A3D] text-white shadow-[0_0_15px_rgba(255,106,61,0.25)]'
                        : isDone
                        ? 'bg-white/[0.02] border-emerald-500/30 text-slate-300'
                        : 'bg-white/[0.01] border-white/[0.05] text-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-mono font-bold uppercase text-slate-400">
                        Node 0{i + 1}
                      </span>
                      {isDone ? (
                        <IconCheck className="w-3 h-3 text-emerald-400" />
                      ) : isCurrent ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A3D] animate-ping" />
                      ) : null}
                    </div>
                    <div className="font-semibold truncate text-[11px]">{stg.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Terminal Live Log Feed */}
            <div className="p-4 rounded-2xl bg-[#060609] border border-white/[0.08] shadow-inner space-y-2">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 text-[10px] font-mono text-slate-500">
                <div className="flex items-center gap-1.5 text-[#FF9A4D]">
                  <IconTerminal className="w-3.5 h-3.5" />
                  <span>AGENT REASONING LOG STREAM</span>
                </div>
                <span className="text-slate-600">STATE_MACHINE_STDOUT</span>
              </div>

              <div className="font-mono text-xs text-slate-300 space-y-1 h-32 overflow-y-auto leading-relaxed">
                {terminalLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-[#FF6A3D] font-bold shrink-0">›</span>
                    <span className={idx === terminalLogs.length - 1 ? 'text-[#FF9A4D] font-semibold' : 'text-slate-400'}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Status */}
          <div className="p-4 px-6 bg-[#08080C] border-t border-white/[0.08] flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-2">
              <IconCpu className="w-4 h-4 text-[#FF9A4D] animate-spin" />
              <span>Running deterministic benchmark sandbox...</span>
            </span>
            <span className="text-[10px] text-slate-500">
              Safe Iteration Cap: 5 Max
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
