import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface HeroProps {
  onStartInvestigating: () => void;
  onWatchDemo: () => void;
}

export default function Hero({ onStartInvestigating, onWatchDemo }: HeroProps) {
  const [activeStage, setActiveStage] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStage((prev) => (prev % 5) + 1);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const pipelineStages = [
    { num: '01', title: 'Interpret Question' },
    { num: '02', title: 'Generate Hypotheses' },
    { num: '03', title: 'Select Experiment' },
    { num: '04', title: 'Analyze Results' },
    { num: '05', title: 'Finalize Conclusion' },
  ];

  return (
    <section
      id="hero"
      className="relative min-h-[94vh] pt-28 pb-16 flex items-center overflow-hidden bg-[#050505] starfield"
    >
      {/* Restrained Ambient Radial Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Warm coral/orange glow near right side */}
        <div className="absolute top-1/3 right-[10%] w-[500px] h-[500px] rounded-full bg-[#FF6A3D]/14 blur-[140px]" />
        {/* Deep solar amber glow bottom */}
        <div className="absolute bottom-10 right-[25%] w-[420px] h-[420px] rounded-full bg-[#FF9A4D]/10 blur-[130px]" />
        {/* Subtle center warm glow */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-[#FF6A3D]/08 blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Hero Copy & Calls to Action (7 cols on lg) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 space-y-7 pt-4"
          >
            {/* Eyebrow Label with Coral & Blue Accent */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#FF6A3D] animate-pulse" />
              <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-slate-300 font-semibold">
                AUTONOMOUS AI AGENTS &amp; EXPERIMENTATION
              </span>
            </div>

            {/* Oversized Headline with Tight Letter Spacing */}
            <div className="space-y-1">
              <h1 className="font-display font-extrabold text-4xl sm:text-6xl lg:text-[4.75rem] tracking-tight leading-[1.02] text-white">
                <span className="block text-white">AI experimentation,</span>
                <span className="block bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  evolved.
                </span>
              </h1>
            </div>

            {/* Supporting Description */}
            <p className="text-base sm:text-lg text-[#A3A3A3] leading-relaxed max-w-xl font-normal">
              An evidence-driven AI system that learns by experimenting. MORPHOS turns technical ambiguity into structured, observable investigations — step by step.
            </p>

            {/* Action Buttons: Pill shapes per reference */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={onStartInvestigating}
                className="btn-pill-primary group"
              >
                <span>Start an Investigation</span>
                <span className="transition-transform duration-200 group-hover:translate-x-1 font-mono text-base">
                  →
                </span>
              </button>

              <button
                onClick={onWatchDemo}
                className="btn-pill-secondary flex items-center gap-2.5"
              >
                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-white text-[9px] pl-0.5">
                  ▶
                </div>
                <span>Watch Demo</span>
              </button>
            </div>

            {/* Metric Strip */}
            <div className="pt-8 border-t border-white/[0.08] grid grid-cols-3 gap-6 max-w-lg">
              <div>
                <div className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
                  300+
                </div>
                <div className="text-[11px] text-[#A3A3A3] uppercase tracking-wider font-mono mt-0.5">
                  Investigations
                </div>
              </div>

              <div>
                <div className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
                  98%
                </div>
                <div className="text-[11px] text-[#A3A3A3] uppercase tracking-wider font-mono mt-0.5">
                  Convergence Rate
                </div>
              </div>

              <div>
                <div className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
                  10×
                </div>
                <div className="text-[11px] text-[#A3A3A3] uppercase tracking-wider font-mono mt-0.5">
                  Faster Resolution
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Glossy 3D Multicolored Ribbon Artwork (5 cols on lg) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 relative flex items-center justify-center min-h-[480px] lg:min-h-[560px]"
          >
            {/* Subtle glow beneath ribbon */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[380px] h-[380px] rounded-full bg-gradient-to-tr from-[#FF6A3D]/25 via-[#FF9A4D]/20 to-transparent blur-[80px]" />
            </div>

            {/* 3D Ribbon Container with Floating Micro-motion */}
            <div className="relative z-10 w-full max-w-[460px] aspect-square flex items-center justify-center ribbon-floating">
              <picture className="w-full h-full">
                <img
                  src="/glossy-ribbon.jpg"
                  alt="Glossy 3D Multicolored Ribbon — MORPHOS AI Architecture"
                  width={500}
                  height={500}
                  className="w-full h-full object-cover rounded-3xl drop-shadow-[0_25px_50px_rgba(0,0,0,0.95)]"
                  loading="eager"
                  fetchPriority="high"
                />
              </picture>

              {/* Seamless Vignette Overlay to blend perfectly into pure black #050505 */}
              <div className="absolute inset-0 rounded-3xl pointer-events-none bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-50" />
            </div>

            {/* Floating Glass HUD Badge (Top Right) */}
            <div className="absolute top-2 sm:top-6 -right-2 sm:right-0 z-20 bg-[#080808]/85 backdrop-blur-md border border-white/10 rounded-2xl p-3 sm:p-4 shadow-[0_15px_35px_rgba(0,0,0,0.8)] max-w-[190px] sm:max-w-[210px]">
              <div className="text-[9px] tracking-[0.18em] uppercase text-[#A3A3A3] font-semibold mb-2 flex items-center gap-1.5 font-mono">
                <span className="w-2 h-2 rounded-full bg-[#FF6A3D] animate-ping" />
                <span>STATE MACHINE</span>
              </div>

              <div className="space-y-1.5">
                {pipelineStages.slice(0, 3).map((stage, idx) => {
                  const isCurrent = activeStage === idx + 1;
                  return (
                    <div
                      key={stage.num}
                      className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-mono transition-colors ${
                        isCurrent
                          ? 'bg-[#FF6A3D]/15 text-white border border-[#FF6A3D]/30'
                          : 'text-[#666666]'
                      }`}
                    >
                      <span className="text-[10px] text-[#FF9A4D] font-bold">
                        {stage.num}
                      </span>
                      <span className="truncate text-[11px]">
                        {stage.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Floating Glass Telemetry Pill (Bottom Left) */}
            <div className="absolute bottom-4 sm:bottom-6 left-0 z-20 bg-[#080808]/85 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2.5 shadow-xl flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-[11px] font-mono leading-tight">
                <div className="text-white font-medium">Consensus: Verified</div>
                <div className="text-[#A3A3A3] text-[9px]">Deterministic Tool Sandbox</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
