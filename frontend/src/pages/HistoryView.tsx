import { useState, useMemo } from 'react';
import { InvestigationRecord } from '../types';
import {
  IconSearch,
  IconTrash,
  IconInvestigation,
  IconArrowRight,
  IconShield,
} from '../components/Icons';

interface HistoryViewProps {
  history: InvestigationRecord[];
  onOpenInvestigation: (id: string) => void;
  onDeleteInvestigation: (id: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export default function HistoryView({
  history,
  onOpenInvestigation,
  onDeleteInvestigation,
  isLoading = false,
  error = null,
}: HistoryViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'running' | 'failed'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const filteredHistory = useMemo(() => {
    return history
      .filter((item) => {
        const query = search.trim().toLowerCase();
        const matchesQuery =
          !query ||
          [
            item.question,
            item.domain,
            item.status,
            item.finalConclusion,
            item.selectedHypothesis?.title,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query);

        const status = String(item.status ?? '').toLowerCase();
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'completed' && (status === 'finalized' || status === 'completed')) ||
          (statusFilter === 'running' &&
            ['interpreted', 'hypotheses_ready', 'experiment_selected', 'experiment_running', 'analyzed', 'running'].includes(status)) ||
          (statusFilter === 'failed' && status === 'failed');

        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => {
        const aTime = new Date(String(a.updatedAt ?? a.createdAt ?? 0)).getTime();
        const bTime = new Date(String(b.updatedAt ?? b.createdAt ?? 0)).getTime();
        return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
      });
  }, [history, search, statusFilter, sortOrder]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Recent';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatDomain = (domain?: string) => {
    switch (domain) {
      case 'ml_model_performance':
        return 'ML Model Performance';
      case 'api_latency':
        return 'API Latency';
      case 'memory':
        return 'Memory Leak / Heap';
      case 'database':
        return 'Database Performance';
      case 'general':
      default:
        return 'General System';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF6A3D]" />
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
              INVESTIGATION HISTORY
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            {history.length} AUDIT RECORDS SAVED IN FIRESTORE
          </p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="p-4 rounded-2xl bg-[#0D0D12] border border-white/[0.07] flex flex-col md:flex-row items-center gap-4 shadow-sm">
        {/* Search Input */}
        <div className="relative w-full md:flex-1">
          <IconSearch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions, domains, hypotheses, conclusions..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#07070A] border border-white/[0.1] text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#FF6A3D] transition-colors"
          />
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-1.5 self-start md:self-auto overflow-x-auto">
          {(['all', 'completed', 'running', 'failed'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`text-xs px-3 py-1.5 rounded-xl uppercase font-mono tracking-wider transition-colors ${
                statusFilter === filter
                  ? 'bg-[#FF6A3D]/20 text-[#FF9A4D] border border-[#FF6A3D] shadow-[0_0_12px_rgba(255,106,61,0.25)]'
                  : 'bg-white/[0.02] text-slate-400 border border-white/[0.06] hover:text-white'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
          className="px-3 py-2 rounded-xl bg-[#07070A] border border-white/[0.1] text-slate-300 text-xs font-mono uppercase focus:outline-none self-start md:self-auto"
        >
          <option value="newest">NEWEST FIRST</option>
          <option value="oldest">OLDEST FIRST</option>
        </select>
      </div>

      {/* State View: Loading */}
      {isLoading ? (
        <div className="p-16 rounded-2xl bg-[#0D0D12] border border-white/[0.07] text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#FF6A3D] border-t-transparent animate-spin mx-auto" />
          <div className="text-sm font-medium text-white">Loading your investigations...</div>
        </div>
      ) : error ? (
        <div className="p-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-2">
          <div className="text-sm text-rose-300 font-medium">Unable to load your investigation history.</div>
          <div className="text-xs text-rose-400/80 font-mono">{error}</div>
        </div>
      ) : filteredHistory.length > 0 ? (
        /* Investigation Records List */
        <div className="space-y-3.5">
          {filteredHistory.map((item, idx) => {
            const confidencePct = Math.round(
              Number(item.confidence ?? 0) * (item.confidence && item.confidence <= 1 ? 100 : 1)
            );
            const statusStr = String(item.status ?? 'completed').toLowerCase();
            const isCompleted = statusStr === 'finalized' || statusStr === 'completed';

            const resStatus =
              item.resultStatus === 'no_matching_template'
                ? 'NO MATCHING EXPERIMENT'
                : item.resultStatus === 'real'
                ? 'MEASURED'
                : 'SIMULATED';

            const resStatusColor =
              resStatus === 'MEASURED'
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : resStatus === 'NO MATCHING EXPERIMENT'
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                : 'text-orange-300 bg-orange-500/10 border-orange-500/20';

            return (
              <div
                key={String(item.id ?? idx)}
                className="p-5 sm:p-6 rounded-2xl bg-[#0D0D12] border border-white/[0.07] hover:border-[#FF6A3D]/40 hover:bg-[#12121A] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group shadow-sm"
              >
                {/* Left detail */}
                <div
                  onClick={() => onOpenInvestigation(String(item.id ?? ''))}
                  className="space-y-2 flex-1 cursor-pointer"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-xs font-mono text-[#FF6A3D] font-bold">
                      #{idx + 1}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-md bg-white/[0.03] text-slate-300 border border-white/[0.07]">
                      {formatDomain(item.domain as string)}
                    </span>
                    <span className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-md border ${resStatusColor}`}>
                      {resStatus}
                    </span>
                    {item.isLocal && (
                      <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400">
                        Local Guest
                      </span>
                    )}
                  </div>

                  <h2 className="text-base font-semibold text-white group-hover:text-orange-200 transition-colors leading-snug">
                    {item.question ?? 'Untitled Investigation'}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-400 line-clamp-2 max-w-3xl leading-relaxed">
                    {item.finalConclusion || item.analysis || 'Investigation concluded with verified findings.'}
                  </p>
                </div>

                {/* Right stats & actions */}
                <div className="flex items-center gap-5 self-start sm:self-auto shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/[0.05] w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">
                      Confidence
                    </span>
                    <span className="font-display font-bold text-base text-[#FF9A4D]">
                      {confidencePct}%
                    </span>
                  </div>

                  <div className="text-right font-mono text-xs text-slate-400 hidden sm:block">
                    {formatDate(item.createdAt ?? item.updatedAt)}
                  </div>

                  <span className={`status-pill ${
                    isCompleted ? 'status-completed' : 'status-running'
                  }`}>
                    {statusStr.toUpperCase()}
                  </span>

                  <button
                    onClick={() => onOpenInvestigation(String(item.id ?? ''))}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                    title="Open workspace"
                  >
                    <IconArrowRight className="w-4 h-4" />
                  </button>

                  {item.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteInvestigation(String(item.id));
                      }}
                      className="text-xs text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="Delete record"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="p-16 rounded-2xl bg-[#0D0F17]/50 border border-dashed border-white/[0.08] text-center space-y-3">
          <IconInvestigation className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="text-base text-white font-semibold">No investigations recorded yet.</div>
          <div className="text-xs text-slate-400 max-w-sm mx-auto">
            Submit an investigation question from the overview console to generate your first audit record.
          </div>
        </div>
      )}
    </div>
  );
}
