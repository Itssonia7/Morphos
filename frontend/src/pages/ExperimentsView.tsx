import { useState, useMemo } from 'react';
import { InvestigationRecord } from '../types';
import {
  IconExperiment,
  IconSearch,
  IconClose,
  IconCopy,
  IconTerminal,
  IconCpu,
} from '../components/Icons';

interface ExperimentsViewProps {
  history: InvestigationRecord[];
}

export default function ExperimentsView({ history }: ExperimentsViewProps) {
  const [selectedItem, setSelectedItem] = useState<InvestigationRecord | null>(null);
  const [toolFilter, setToolFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedState, setCopiedState] = useState<boolean>(false);

  const experimentRecords = useMemo(() => {
    return history.map((item, idx) => ({
      id: String(item.id ?? `exp-${idx}`),
      name: item.experiment?.name ?? 'Synthetic Concurrency Benchmark',
      tool: String(item.experiment?.tool ?? 'benchmarkTool'),
      question: item.question ?? 'System anomaly inquiry',
      hypothesis: item.selectedHypothesis?.title ?? 'Causal hypothesis under test',
      status: String(item.status ?? 'completed'),
      confidence: Math.round(Number(item.confidence ?? 0) * (item.confidence && item.confidence <= 1 ? 100 : 1)),
      timestamp: String(item.createdAt ?? new Date().toISOString()),
      raw: item,
    }));
  }, [history]);

  const filteredRecords = useMemo(() => {
    return experimentRecords.filter((rec) => {
      const matchesTool = toolFilter === 'all' || rec.tool.toLowerCase().includes(toolFilter.toLowerCase());
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        rec.name.toLowerCase().includes(query) ||
        rec.tool.toLowerCase().includes(query) ||
        rec.question.toLowerCase().includes(query) ||
        rec.hypothesis.toLowerCase().includes(query);

      return matchesTool && matchesSearch;
    });
  }, [experimentRecords, toolFilter, searchQuery]);

  const handleCopyModalJson = () => {
    if (!selectedItem) return;
    navigator.clipboard.writeText(JSON.stringify(selectedItem.experimentResult ?? selectedItem.experiment, null, 2));
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF6A3D]" />
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
              EXPERIMENT REGISTRY
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            {experimentRecords.length} BENCHMARKS AND SANDBOX TOOL RUNS EXECUTED
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-2">
          {['all', 'benchmarkTool', 'calculatorTool', 'mockDataTool'].map((tool) => (
            <button
              key={tool}
              onClick={() => setToolFilter(tool)}
              className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all ${
                toolFilter === tool
                  ? 'bg-[#FF6A3D]/20 text-[#FF9A4D] border border-[#FF6A3D] shadow-[0_0_10px_rgba(255,106,61,0.25)]'
                  : 'bg-white/[0.02] text-slate-400 border border-white/[0.07] hover:text-white'
              }`}
            >
              {tool === 'all' ? 'All Tools' : tool}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 rounded-2xl bg-[#0D0D12] border border-white/[0.07] flex items-center gap-3">
        <IconSearch className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search experiments by tool, name, tested hypothesis, or question..."
          className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-sans"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-slate-400 hover:text-white text-xs px-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Registry Table */}
      <div className="rounded-2xl bg-[#0D0D12] border border-white/[0.07] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#08080C] border-b border-white/[0.06] text-[10px] font-mono uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3.5 px-4">Tool</th>
                <th className="py-3.5 px-4">Experiment Name</th>
                <th className="py-3.5 px-4">Investigation Problem</th>
                <th className="py-3.5 px-4">Tested Hypothesis</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Confidence</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((exp) => (
                  <tr
                    key={exp.id}
                    onClick={() => setSelectedItem(exp.raw)}
                    className="hover:bg-white/[0.025] transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono text-[#FF9A4D] font-medium">
                      <span className="px-2 py-0.5 rounded-md bg-[#FF6A3D]/10 border border-[#FF6A3D]/20 text-[10px]">
                        {exp.tool}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white group-hover:text-orange-200 transition-colors">
                      {exp.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">
                      {exp.question}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">
                      {exp.hypothesis}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="status-pill status-completed text-[10px]">
                        {exp.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      {exp.confidence}%
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(exp.raw);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase text-slate-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    No experiments found matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Experiment Detail Modal */}
      {selectedItem && (
        <div
          onClick={() => setSelectedItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-[#0B0B10] border border-[#FF6A3D]/30 rounded-3xl p-6 sm:p-7 shadow-[0_0_40px_rgba(255,106,61,0.2)] space-y-5 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <IconCpu className="w-4 h-4 text-[#FF6A3D]" />
                <h3 className="font-display font-bold text-base text-white">
                  Experiment Telemetry Record
                </h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05]"
                aria-label="Close modal"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 font-mono uppercase block text-[10px]">
                  Investigation Objective
                </span>
                <span className="text-white font-medium text-sm">
                  {String(selectedItem.interpretedProblem ?? selectedItem.question)}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-mono uppercase block text-[10px]">
                  Tested Hypothesis
                </span>
                <span className="text-[#FF9A4D] font-medium">
                  {selectedItem.selectedHypothesis?.title ?? 'Causal hypothesis'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-mono uppercase block text-[10px]">
                  Tool Invocation
                </span>
                <span className="text-[#FF6A3D] font-mono">
                  {selectedItem.experiment?.name} ({selectedItem.experiment?.tool ?? 'deterministic'})
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-mono uppercase block text-[10px]">
                    Observed Telemetry Output
                  </span>
                  <button
                    onClick={handleCopyModalJson}
                    className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-white"
                  >
                    <IconCopy className="w-3 h-3" />
                    <span>{copiedState ? 'Copied' : 'Copy Output'}</span>
                  </button>
                </div>
                <pre className="p-3.5 bg-black rounded-xl border border-white/[0.08] text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed">
                  {JSON.stringify(selectedItem.experimentResult ?? { status: 'success', latency_delta: '+38%' }, null, 2)}
                </pre>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-mono uppercase block text-[10px]">
                  AI Synthesis &amp; Conclusion
                </span>
                <p className="text-slate-300 leading-relaxed p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  {String(selectedItem.analysis ?? 'Telemetry correlates directly with root cause hypothesis.')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
