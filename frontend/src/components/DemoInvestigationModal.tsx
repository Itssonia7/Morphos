import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DemoInvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWorkspaceWithDemo: () => void;
}

export default function DemoInvestigationModal({
  isOpen,
  onClose,
  onOpenWorkspaceWithDemo,
}: DemoInvestigationModalProps) {
  const [step, setStep] = useState(0);

  const demoSteps = [
    {
      title: '01 / INGESTION & INTERPRETATION',
      sub: 'Problem Ingestion',
      text: 'User inquiries: "Why is API latency increasing?" MORPHOS parses the prompt, identifies latency regression metrics, and isolates target boundaries.',
      badge: 'INTERPRET_QUESTION',
    },
    {
      title: '02 / MULTI-HYPOTHESIS FORMULATION',
      sub: 'Candidate Generation',
      text: 'Generates 3 falsifiable hypotheses: #1 Connection pool exhaustion (72%), #2 External downstream latency (54%), #3 CPU thread contention (31%).',
      badge: 'GENERATE_HYPOTHESES',
    },
    {
      title: '03 / DISCRIMINATIVE EXPERIMENT SELECTION',
      sub: 'Strategy Optimization',
      text: 'Selects benchmarkTool with a 50-client concurrency sweep to test connection saturation without impacting production traffic.',
      badge: 'SELECT_EXPERIMENT',
    },
    {
      title: '04 / DETERMINISTIC TOOL EXECUTION',
      sub: 'Sandboxed Benchmark',
      text: 'Tool executes in isolated sandbox. Output: P99 degraded by +38.0% once socket pool reached 50/50 capacity. Exit code: 0.',
      badge: 'EXECUTE_EXPERIMENT',
    },
    {
      title: '05 / EMPIRICAL ANALYSIS & CONFIDENCE',
      sub: 'Bayesian Scoring',
      text: 'Correlates observed wait-queue metrics with connection limits. Updated posterior confidence: 87%. Threshold >= 70% attained!',
      badge: 'ANALYZE_RESULTS',
    },
    {
      title: '06 / VERDICT & REMEDIATION',
      sub: 'Final Conclusion',
      text: 'Verdict: "The strongest evidence points toward database connection pool exhaustion." Recommendation: Increase pool max size to 120 or introduce connection multiplexing.',
      badge: 'FINALIZE',
    },
  ];

  useEffect(() => {
    if (!isOpen) {
      setStep(0);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const timer = setInterval(() => {
      setStep((prev) => (prev < demoSteps.length - 1 ? prev + 1 : prev));
    }, 2800);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(timer);
    };
  }, [isOpen, onClose, demoSteps.length]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-modal-title"
            className="relative w-full max-w-2xl glass-panel bg-[#0A0A0A]/95 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.95)] z-10 space-y-6 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF6A3D] animate-pulse shadow-[0_0_8px_#FF6A3D]" />
                <span id="demo-modal-title" className="font-display font-bold text-xs tracking-[0.2em] uppercase text-white">
                  MORPHOS AUTONOMOUS DEMO WALKTHROUGH
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-[#8A8A8A] hover:text-white rounded-full w-7 h-7 flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.1] transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Stepper progress dots */}
            <div className="flex items-center gap-2">
              {demoSteps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step
                      ? 'w-10 bg-[#FF6A3D] shadow-[0_0_10px_#FF6A3D]'
                      : i < step
                      ? 'w-4 bg-white/40'
                      : 'w-4 bg-white/10'
                  }`}
                />
              ))}
            </div>

            {/* Step Content */}
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4 p-5 rounded-2xl bg-black/60 border border-white/[0.08]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#FF9A4D] font-bold">
                  {demoSteps[step].title}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-[#8A8A8A]">
                  {demoSteps[step].badge}
                </span>
              </div>

              <h4 className="font-display font-bold text-xl text-white">
                {demoSteps[step].sub}
              </h4>

              <p className="text-sm text-[#D4D4D4] leading-relaxed">
                {demoSteps[step].text}
              </p>
            </motion.div>

            {/* Footer Buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="px-4 py-1.5 rounded-full border border-white/10 text-xs text-[#8A8A8A] hover:text-white disabled:opacity-30 transition-colors"
                >
                  ← Prev
                </button>
                <button
                  disabled={step === demoSteps.length - 1}
                  onClick={() => setStep((s) => Math.min(demoSteps.length - 1, s + 1))}
                  className="px-4 py-1.5 rounded-full border border-white/10 text-xs text-[#8A8A8A] hover:text-white disabled:opacity-30 transition-colors"
                >
                  Next →
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="btn-pill-secondary py-2.5 px-5 text-xs uppercase tracking-wider"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onOpenWorkspaceWithDemo();
                  }}
                  className="btn-pill-coral py-2.5 px-6 text-xs uppercase font-bold tracking-wider"
                >
                  Open in Live Workspace →
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
