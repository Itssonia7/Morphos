import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InvestigationRecord } from '../types';
import {
  IconBot,
  IconClose,
  IconSend,
  IconSparkles,
  IconZap,
  IconCpu,
  IconShield,
  IconArrowRight,
} from './Icons';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  suggestedAction?: {
    type: 'load_query' | 'deep_dive';
    label: string;
    payload: string;
  };
}

interface MorphosAgentCopilotProps {
  currentInvestigation: InvestigationRecord | null;
  onRunInvestigation: (query: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function MorphosAgentCopilot({
  currentInvestigation,
  onRunInvestigation,
  isOpen,
  onToggle,
}: MorphosAgentCopilotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-01',
      sender: 'agent',
      text: "Greetings Operator. I am the MORPHOS Autonomous Agent Orchestrator. I can assist you with root-cause synthesis, hypothesis verification, experiment simulation parameters, and infrastructure bottleneck diagnoses.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggle]);

  // Generate intelligent agent reasoning response
  const handleSendMessage = (customText?: string) => {
    const query = (customText || inputText).trim();
    if (!query) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      let agentReply = '';
      let action: Message['suggestedAction'] = undefined;
      const lower = query.toLowerCase();

      if (lower.includes('root cause') || lower.includes('explain') || lower.includes('why')) {
        if (currentInvestigation) {
          const hypTitle = currentInvestigation.selectedHypothesis?.title || 'Resource Saturation';
          const conf = Math.round(Number(currentInvestigation.confidence ?? 0.75) * 100);
          agentReply = `Analysis of Active Investigation [${currentInvestigation.id || 'Current'}]:\n\n` +
            `• Primary Causal Hypothesis: **${hypTitle}** (${conf}% Bayesian confidence).\n` +
            `• Evidence Observed: ${currentInvestigation.analysis || 'Telemetry spikes align with concurrency bottlenecks.'}\n` +
            `• Architectural Impact: Elevated worker queue delays cascade upstream into reverse-proxy timeouts.`;
          action = {
            type: 'load_query',
            label: 'Run Concurrency Stress Test',
            payload: `Stress test connection pooling under 100 concurrent workers for ${hypTitle}`,
          };
        } else {
          agentReply = `I examine technical anomalies using a 7-stage LangGraph workflow. Without an active investigation selected, common culprits for production latency are: Database Connection Starvation, Unindexed Query Locks, or Event Loop Blockers.`;
          action = {
            type: 'load_query',
            label: 'Investigate Database Latency',
            payload: 'Why is API latency increasing under high request concurrency?',
          };
        }
      } else if (lower.includes('fix') || lower.includes('remediat') || lower.includes('solution') || lower.includes('action')) {
        agentReply = `Autonomous Action Plan Recommendations:\n\n` +
          `1. **Increase Pool Buffer**: Scale PostgreSQL / DB socket pool min/max boundaries from 20/50 to 50/150.\n` +
          `2. **Set Query Timeouts**: Enforce strict 2.5s statement timeouts to prevent rogue queries from blocking worker sockets.\n` +
          `3. **Implement Redis Read-Through**: Cache high-frequency read queries with a 60-second TTL to offload ~40% of database contention.`;
      } else if (lower.includes('experiment') || lower.includes('tool') || lower.includes('benchmark')) {
        agentReply = `MORPHOS deterministic tool sandbox supports:\n\n` +
          `• **benchmarkTool**: Synthetic load profiling across custom concurrency curves.\n` +
          `• **calculatorTool**: Statistical Bayesian confidence calculations and variance evaluation.\n` +
          `• **mockDataTool**: Synthetic telemetry trace generation for isolated testing.`;
        action = {
          type: 'load_query',
          label: 'Run Memory Leak Benchmark',
          payload: 'Why does memory usage grow over time in background workers?',
        };
      } else {
        agentReply = `I have received your inquiry: "${query}". Based on heuristic telemetry and Bayesian state analysis, I recommend launching an evidence-backed autonomous investigation to isolate the exact anomaly vectors.`;
        action = {
          type: 'load_query',
          label: `Investigate: "${query.slice(0, 35)}..."`,
          payload: query,
        };
      }

      const agentMsg: Message = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: agentReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedAction: action,
      };

      setMessages((prev) => [...prev, agentMsg]);
      setIsTyping(false);
    }, 650);
  };

  const handleActionClick = (action: NonNullable<Message['suggestedAction']>) => {
    if (action.type === 'load_query') {
      onRunInvestigation(action.payload);
      onToggle();
    }
  };

  const presetQueries = [
    { label: 'Explain Current Root Cause', query: 'What is the root cause of the current investigation?' },
    { label: 'Suggest Remediation Steps', query: 'What are the recommended remediation actions?' },
    { label: 'Design Synthetic Experiment', query: 'How does benchmarkTool validate this anomaly?' },
  ];

  return (
    <>
      {/* Floating Holographic AI Agent Launcher Button */}
      <motion.button
        onClick={onToggle}
        aria-label="Open MORPHOS AI Agent Copilot"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-4 py-3 rounded-full bg-[#0D0D12]/95 border border-[#FF6A3D]/40 text-white shadow-[0_0_25px_rgba(255,106,61,0.25)] backdrop-blur-xl group hover:border-[#FF6A3D] hover:shadow-[0_0_35px_rgba(255,106,61,0.45)] transition-all"
      >
        <div className="relative flex items-center justify-center">
          <span className="w-3 h-3 rounded-full bg-[#FF6A3D] animate-ping absolute opacity-70" />
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#FF6A3D] to-[#FF9A4D] flex items-center justify-center relative shadow-inner">
            <IconBot className="w-4 h-4 text-white" />
          </div>
        </div>

        <div className="text-left hidden sm:block">
          <div className="text-[11px] font-mono font-bold tracking-wider uppercase text-[#FF9A4D] flex items-center gap-1.5">
            <span>AI AGENT COPILOT</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            LangGraph Orchestrator
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-300 border border-white/[0.1]">
          ⌘K
        </span>
      </motion.button>

      {/* Slide-Over Cybernetic Copilot HUD */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onToggle}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
            />

            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 right-0 bottom-0 w-full sm:w-[460px] bg-[#0A0A10]/95 border-l border-white/[0.12] z-50 flex flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between bg-[#0E0E16]/80">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF6A3D] via-[#FF8544] to-[#FF9A4D] p-[1px] shadow-[0_0_15px_rgba(255,106,61,0.35)]">
                      <div className="w-full h-full bg-[#08080C] rounded-xl flex items-center justify-center">
                        <IconBot className="w-4 h-4 text-[#FF9A4D]" />
                      </div>
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0A0A10]" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-sm text-white tracking-wide">
                        MORPHOS COPILOT
                      </span>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-[#FF6A3D]/10 text-[#FF9A4D] border border-[#FF6A3D]/30">
                        ONLINE
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Autonomous Reasoning Node 01
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMessages([
                      {
                        id: 'welcome-reset',
                        sender: 'agent',
                        text: "Context refreshed. How can I assist with your infrastructure or algorithm performance analysis?",
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      },
                    ])}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.05] text-[10px] font-mono transition-colors"
                    title="Clear Chat Session"
                  >
                    CLEAR
                  </button>
                  <button
                    onClick={onToggle}
                    aria-label="Close Copilot"
                    className="p-2 text-slate-400 hover:text-white rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
                  >
                    <IconClose className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Context Pill (if active investigation is present) */}
              {currentInvestigation && (
                <div className="px-4 py-2.5 bg-[#FF6A3D]/10 border-b border-[#FF6A3D]/20 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
                    <IconSparkles className="w-3.5 h-3.5 text-[#FF6A3D] shrink-0" />
                    <span className="text-[11px] font-mono text-orange-200 truncate">
                      Context: {currentInvestigation.question || 'Active Investigation'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#FF9A4D] shrink-0 px-1.5 py-0.5 rounded bg-[#FF6A3D]/20">
                    {Math.round(Number(currentInvestigation.confidence ?? 0.72) * 100)}% CONF
                  </span>
                </div>
              )}

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-mono text-slate-500">
                      <span>{msg.sender === 'user' ? 'OPERATOR' : 'MORPHOS AGENT'}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div
                      className={`max-w-[90%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-[#FF6A3D] text-white shadow-[0_4px_15px_rgba(255,106,61,0.3)] rounded-tr-sm'
                          : 'bg-[#101018] border border-white/[0.08] text-slate-200 rounded-tl-sm shadow-md'
                      }`}
                    >
                      <div className="whitespace-pre-line space-y-1">
                        {msg.text}
                      </div>

                      {/* Interactive Action Pill */}
                      {msg.suggestedAction && (
                        <div className="mt-3 pt-2.5 border-t border-white/[0.08]">
                          <button
                            onClick={() => handleActionClick(msg.suggestedAction!)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF6A3D]/20 to-[#FF9A4D]/20 hover:from-[#FF6A3D]/40 hover:to-[#FF9A4D]/40 border border-[#FF6A3D]/30 text-orange-200 text-[11px] font-mono font-semibold transition-all group"
                          >
                            <IconZap className="w-3.5 h-3.5 text-[#FF6A3D] group-hover:scale-110 transition-transform" />
                            <span>{msg.suggestedAction.label}</span>
                            <IconArrowRight className="w-3 h-3 text-[#FF9A4D] ml-auto" />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-xs text-[#FF9A4D] font-mono px-2 py-1"
                  >
                    <div className="w-2 h-2 rounded-full bg-[#FF6A3D] animate-ping" />
                    <span>Agent evaluating causal graph...</span>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Presets Row */}
              <div className="px-4 py-2 border-t border-white/[0.06] bg-[#07070C]/50 flex gap-1.5 overflow-x-auto no-scrollbar">
                {presetQueries.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(p.query)}
                    className="shrink-0 text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-slate-400 hover:text-white hover:border-[#FF6A3D]/50 hover:bg-[#FF6A3D]/10 transition-all"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Chat Input Console */}
              <div className="p-4 border-t border-white/[0.08] bg-[#0E0E16]/90 space-y-2">
                <div className="relative flex items-center">
                  <textarea
                    rows={2}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask agent: 'Why is P99 latency spiking?'"
                    className="w-full p-3 pr-12 rounded-xl bg-[#060609] border border-white/[0.12] text-white placeholder-slate-500 text-xs font-sans focus:outline-none focus:border-[#FF6A3D] focus:ring-1 focus:ring-[#FF6A3D] resize-none transition-all"
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() || isTyping}
                    className="absolute right-2.5 bottom-3.5 p-2 rounded-lg bg-[#FF6A3D] text-white disabled:opacity-40 hover:bg-[#FF5400] transition-colors shadow-[0_0_12px_rgba(255,106,61,0.35)]"
                  >
                    <IconSend className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Telemetry Status Strip */}
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 px-1">
                  <span className="flex items-center gap-1">
                    <IconCpu className="w-3 h-3 text-[#FF9A4D]" />
                    Deterministic Sandbox Ready
                  </span>
                  <span className="flex items-center gap-1">
                    <IconShield className="w-3 h-3 text-emerald-400" />
                    Bayesian Belief v2.1
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
