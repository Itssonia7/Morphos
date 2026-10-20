import { motion } from 'framer-motion';

export default function FeatureSection() {
  const features = [
    {
      num: '01',
      title: 'Autonomous Hypothesis Engine',
      desc: 'Formulates structured, falsifiable explanations instead of guessing. Each candidate hypothesis receives explicit rationale and starting confidence.',
      badge: 'GEMINI 3.6 FLASH + HEURISTICS',
    },
    {
      num: '02',
      title: 'Deterministic Tool Execution',
      desc: 'Connects to reproducible benchmarking tools, latency profilers, and calculation modules in a sandboxed runtime environment.',
      badge: 'ZERO HALLUCINATION',
    },
    {
      num: '03',
      title: 'LangGraph State Machine',
      desc: 'Controls execution flow with state graphs, conditional routing, and bounded iterations to guarantee convergence and safe exit.',
      badge: 'FINITE STATE MACHINE',
    },
    {
      num: '04',
      title: 'Firestore Cloud Storage',
      desc: 'Stores every investigation, event stream, and telemetry record under cryptographic Firebase user tokens with strict authorization.',
      badge: 'ENTERPRISE SECURITY',
    },
    {
      num: '05',
      title: 'Verifiable Evidence Trails',
      desc: 'Audit all observations with exact timestamps, raw metrics, and delta comparisons so technical teams can verify conclusions.',
      badge: 'FULL AUDIT TRAIL',
    },
    {
      num: '06',
      title: 'Zero-Downtime Fallback',
      desc: 'Operates in deterministic fallback mode even when external model quotas expire, maintaining uninterrupted operational uptime.',
      badge: 'HIGH AVAILABILITY',
    },
  ];

  return (
    <section id="features" className="py-24 sm:py-32 bg-[#050505] relative border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mb-16 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-5 h-[2px] bg-[#FF6A3D]" />
            <span className="eyebrow tracking-[0.2em] text-[#A3A3A3]">
              ENGINEERED FOR PRODUCTION
            </span>
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-white tracking-tight">
            CORE PLATFORM CAPABILITIES
          </h2>
          <p className="text-base sm:text-lg text-[#A3A3A3]">
            Designed for software engineers, site reliability teams, and AI researchers who require empirical evidence over generic LLM conversation.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => (
            <motion.div
              key={feat.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              className="group p-6 sm:p-8 rounded-2xl bg-[#080808] border border-white/[0.08] hover:border-[#FF6A3D]/40 hover:bg-[#0D0D0D] transition-all duration-300 relative flex flex-col justify-between shadow-sm"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#FF6A3D] tracking-wider">
                    {feat.num}
                  </span>
                  <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded bg-white/[0.04] text-[#A3A3A3] border border-white/[0.06]">
                    {feat.badge}
                  </span>
                </div>

                <h3 className="font-display font-bold text-xl text-white group-hover:text-[#FF9A4D] transition-colors">
                  {feat.title}
                </h3>

                <p className="text-sm text-[#A3A3A3] leading-relaxed">
                  {feat.desc}
                </p>
              </div>

              <div className="pt-6 mt-4 border-t border-white/[0.05] flex items-center justify-between text-xs text-[#666666] group-hover:text-[#A3A3A3] transition-colors">
                <span className="font-mono">STATUS: OPERATIONAL</span>
                <span className="text-[#FF6A3D] opacity-0 group-hover:opacity-100 transition-opacity font-mono text-[11px]">
                  Learn more →
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
