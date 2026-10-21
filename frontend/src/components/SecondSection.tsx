import { motion } from 'framer-motion';

interface SecondSectionProps {
  onExploreFeatures: () => void;
  onViewGitHub: () => void;
}

export default function SecondSection({ onExploreFeatures, onViewGitHub }: SecondSectionProps) {
  return (
    <section id="about" className="py-24 sm:py-32 bg-[#050505] relative overflow-hidden border-b border-white/[0.06]">
      {/* Background radial glow */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#FF7A00]/8 blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Editorial Headline & Copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-6 space-y-6"
          >
            {/* Eyebrow */}
            <div className="flex items-center gap-3">
              <span className="w-6 h-[2px] bg-[#FF7A00] rounded-full shadow-[0_0_8px_rgba(255,122,0,0.8)]" />
              <span className="eyebrow tracking-[0.2em] text-[#8A8A8A]">
                BUILT FOR A SMARTER TOMORROW
              </span>
            </div>

            {/* Headline */}
            <h2 className="font-display font-extrabold text-3xl sm:text-5xl lg:text-5xl tracking-tight leading-[1.08] text-white">
              AI INVESTIGATION<br />
              <span className="text-[#8A8A8A]">FOR EVERYONE.</span>
            </h2>

            {/* Description */}
            <p className="text-base sm:text-lg text-[#8A8A8A] leading-relaxed max-w-xl font-normal">
              MORPHOS makes technical problem solving faster, smarter, and accessible — from curious beginners to power users.
            </p>

            {/* Feature highlights */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="w-5 h-5 rounded-md bg-[#FF7A00]/15 text-[#FF7A00] flex items-center justify-center text-xs mt-0.5">
                  ✓
                </div>
                <div>
                  <div className="text-xs font-semibold text-white tracking-wide">
                    Controlled LangGraph Loop
                  </div>
                  <div className="text-xs text-[#8A8A8A] mt-0.5">
                    Safe termination bounds, preventing runaway LLM hallucinations.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="w-5 h-5 rounded-md bg-[#FF7A00]/15 text-[#FF7A00] flex items-center justify-center text-xs mt-0.5">
                  ✓
                </div>
                <div>
                  <div className="text-xs font-semibold text-white tracking-wide">
                    Dual Fallback Engine
                  </div>
                  <div className="text-xs text-[#8A8A8A] mt-0.5">
                    Seamless switch to deterministic tools if Gemini API is offline.
                  </div>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="pt-4 flex flex-wrap items-center gap-4">
              <button
                onClick={onExploreFeatures}
                className="btn-primary py-3.5 px-8 text-sm tracking-wider uppercase font-bold group"
              >
                <span>Explore Features</span>
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </button>

              <button
                onClick={onViewGitHub}
                className="btn-secondary py-3.5 px-7 text-sm tracking-wider uppercase font-medium flex items-center gap-2.5"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span>View GitHub</span>
              </button>
            </div>
          </motion.div>

          {/* Right Column: AI Chip Processor Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 relative flex items-center justify-center"
          >
            <div className="relative w-full max-w-xl aspect-[16/10] rounded-2xl overflow-hidden border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] group">
              <picture className="w-full h-full">
                <source srcSet="/ai-chip.webp" type="image/webp" />
                <img
                  src="/ai-chip.jpg"
                  alt="MORPHOS Neural Processor"
                  width={640}
                  height={400}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (img.src.endsWith('.webp')) {
                      img.src = '/ai-chip.jpg';
                    }
                  }}
                />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-40 pointer-events-none" />
              
              {/* Subtle floating telemetry badge */}
              <div className="absolute bottom-4 left-4 right-4 sm:right-auto bg-[#0A0A0A]/90 backdrop-blur-md border border-white/10 rounded-xl p-3 sm:px-4 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF7A00] animate-pulse" />
                <div className="text-xs">
                  <span className="text-white font-mono font-semibold">MORPHOS SILICON ARCHITECTURE</span>
                  <span className="text-[#8A8A8A] block sm:inline sm:ml-2 text-[11px]">Sub-millisecond graph state transitions</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
