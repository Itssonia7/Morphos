import { useState } from 'react';
import { motion } from 'framer-motion';

export default function HowItWorks() {
  const [selectedStage, setSelectedStage] = useState(0);

  const stages = [
    {
      step: '01',
      node: 'interpretQuestion',
      title: 'INTERPRET QUESTION',
      short: 'Understand problem',
      desc: 'Parses the raw inquiry into a structured problem definition. Extracts telemetry metrics, scope boundaries, and root goals.',
      nodeCode: `// LangGraph Node 1
async function interpretQuestion(state: InvestigationState) {
  const interpreted = await parsePrompt(state.question);
  return { interpretedProblem: interpreted, status: 'interpreted' };
}`,
      details: 'Identifies system domains: latency, memory, concurrency, or regressions.',
    },
    {
      step: '02',
      node: 'generateHypotheses',
      title: 'GENERATE HYPOTHESES',
      short: 'Candidate causes',
      desc: 'Formulates prioritized hypotheses. Powered by Gemini 3.6 Flash structured output or deterministic fallback trees.',
      nodeCode: `// LangGraph Node 2
const schema = z.object({
  hypotheses: z.array(z.object({
    id: z.string(),
    title: z.string(),
    rationale: z.string(),
    confidence: z.number()
  }))
});`,
      details: 'Evaluates multi-cause probabilities rather than jumping to a single guess.',
    },
    {
      step: '03',
      node: 'selectExperiment',
      title: 'SELECT EXPERIMENT',
      short: 'Choose test tool',
      desc: 'Chooses the most discriminative experiment to validate or invalidate the highest-ranked hypothesis safely.',
      nodeCode: `// LangGraph Node 3
const experiment = selectTargetTool({
  hypothesis: topHypothesis,
  registeredTools: ['benchmarkTool', 'calculatorTool']
});`,
      details: 'Selects targeted deterministic measurement scripts and load profiles.',
    },
    {
      step: '04',
      node: 'executeExperiment',
      title: 'RUN EXPERIMENT',
      short: 'Execute safely',
      desc: 'Executes the deterministic tool or benchmark in an isolated sandbox and captures metrics, latencies, and exit codes.',
      nodeCode: `// LangGraph Node 4
const result = await benchmarkTool.execute({
  concurrency: 50,
  endpoint: '/api/v1/resource'
});`,
      details: 'Produces verifiable telemetry without subjective hallucinations.',
    },
    {
      step: '05',
      node: 'analyzeResults',
      title: 'ANALYZE RESULTS',
      short: 'Evaluate evidence',
      desc: 'Compares real experimental output against hypothesized baseline expectations to generate factual observations.',
      nodeCode: `// LangGraph Node 5
const delta = computeDeviation(result, baseline);
const evidence = formulateEvidence(delta);`,
      details: 'Filters noise and correlates anomalies with known fault signatures.',
    },
    {
      step: '06',
      node: 'evaluateConfidence',
      title: 'SCORE CONFIDENCE',
      short: 'Measure certainty',
      desc: 'Updates Bayesian confidence scores. If confidence >= 70% or iteration limit reached, routes to finalize; else loops.',
      nodeCode: `// LangGraph Conditional Edge
export function shouldContinue(state: InvestigationState) {
  if (state.confidence >= 0.70 || state.iteration >= 3) {
    return 'finalize';
  }
  return 'generate_hypotheses';
}`,
      details: 'Strict mathematical stopping condition prevents runaway loops.',
    },
    {
      step: '07',
      node: 'finalize',
      title: 'FINALIZE',
      short: 'Actionable conclusion',
      desc: 'Synthesizes all collected evidence into an executive conclusion with remediation recommendations and stores to Firestore.',
      nodeCode: `// LangGraph Node 7
return {
  status: 'finalized',
  finalConclusion: conclusion,
  events: recordAuditTrail(events)
};`,
      details: 'Persists verified investigation state under authenticated Firebase UID.',
    },
  ];

  return (
    <section id="how-it-works" className="py-24 sm:py-32 bg-[#080808] relative border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2">
            <span className="w-4 h-[2px] bg-[#FF6A3D]" />
            <span className="eyebrow tracking-[0.2em] text-[#A3A3A3]">
              AUTONOMOUS REASONING LOOP
            </span>
            <span className="w-4 h-[2px] bg-[#FF6A3D]" />
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-white tracking-tight">
            HOW MORPHOS THINKS
          </h2>
          <p className="text-base sm:text-lg text-[#A3A3A3]">
            Unlike simple chat bots, MORPHOS runs a stateful LangGraph state machine designed to form hypotheses, test them with real tools, and measure confidence mathematically.
          </p>
        </div>

        {/* Horizontal / Grid Timeline Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mb-10">
          {stages.map((st, idx) => {
            const isSelected = selectedStage === idx;
            return (
              <button
                key={st.step}
                onClick={() => setSelectedStage(idx)}
                className={`text-left p-3.5 rounded-xl border transition-all duration-200 relative ${
                  isSelected
                    ? 'bg-[#FF6A3D]/12 border-[#FF6A3D] shadow-[0_0_20px_rgba(255,106,61,0.25)]'
                    : 'bg-white/[0.02] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[11px] font-mono font-bold ${isSelected ? 'text-[#FF6A3D]' : 'text-[#A3A3A3]'}`}>
                    {st.step}
                  </span>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-[#FF6A3D] shadow-[0_0_8px_#FF6A3D]" />
                  )}
                </div>
                <div className={`text-xs font-bold uppercase tracking-wider line-clamp-1 ${isSelected ? 'text-white' : 'text-[#A3A3A3]'}`}>
                  {st.short}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Stage Detail Panel */}
        <motion.div
          key={selectedStage}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-[#050505] border border-white/10 rounded-2xl p-6 sm:p-10 shadow-2xl"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: Stage Explanation */}
            <div className="lg:col-span-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-[#FF6A3D]/20 text-[#FF6A3D] border border-[#FF6A3D]/30">
                  STEP {stages[selectedStage].step}
                </span>
                <span className="text-xs font-mono text-[#A3A3A3]">
                  node: {stages[selectedStage].node}
                </span>
              </div>

              <h3 className="font-display font-bold text-2xl sm:text-3xl text-white">
                {stages[selectedStage].title}
              </h3>

              <p className="text-base text-[#D4D4D4] leading-relaxed">
                {stages[selectedStage].desc}
              </p>

              <div className="pt-2 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-[#8A8A8A] flex items-center gap-3">
                <span className="text-[#FF7A00] font-bold">KEY CAPABILITY:</span>
                <span>{stages[selectedStage].details}</span>
              </div>
            </div>

            {/* Right Column: Code Snippet */}
            <div className="lg:col-span-6">
              <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0A0A0A] shadow-inner">
                <div className="px-4 py-2.5 bg-black/50 border-b border-white/[0.07] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  </div>
                  <span className="font-mono text-[11px] text-[#8A8A8A]">
                    {stages[selectedStage].node}.ts
                  </span>
                </div>
                <pre className="p-4 sm:p-5 font-mono text-xs text-[#E5E5E5] overflow-x-auto leading-relaxed">
                  <code>{stages[selectedStage].nodeCode}</code>
                </pre>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
