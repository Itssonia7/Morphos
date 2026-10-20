import { ViewId } from '../types';
import {
  IconOverview,
  IconInvestigation,
  IconExperiment,
  IconAnalytics,
  IconSettings,
  IconPlus,
  IconChevronRight,
  IconCpu,
  IconArrowUpRight,
} from './Icons';

interface SidebarProps {
  activeView: ViewId;
  onSelectView: (view: ViewId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onBackToHome: () => void;
  onNewInvestigation: () => void;
  user: { uid: string; email?: string | null } | null;
  onSignOut: () => void;
}

interface NavItemDef {
  id: ViewId;
  label: string;
  icon: (props: { className?: string }) => JSX.Element;
  badge?: string;
}

export default function Sidebar({
  activeView,
  onSelectView,
  collapsed,
  onToggleCollapse,
  onBackToHome,
  onNewInvestigation,
  user,
  onSignOut,
}: SidebarProps) {
  const workspaceItems: NavItemDef[] = [
    { id: 'overview', label: 'Overview', icon: IconOverview },
    { id: 'investigations', label: 'Investigations', icon: IconInvestigation },
    { id: 'experiments', label: 'Experiments', icon: IconExperiment },
    { id: 'analytics', label: 'Analytics', icon: IconAnalytics },
  ];

  const configItems: NavItemDef[] = [
    { id: 'profile', label: 'Settings', icon: IconSettings },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 bg-[#0A0C13] border-r border-white/[0.07] flex flex-col justify-between transition-all duration-300 select-none ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Section: Brand + Actions + Navigation */}
      <div className="p-3.5 space-y-5 overflow-y-auto overflow-x-hidden">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-1">
          <div
            onClick={onBackToHome}
            className="flex items-center gap-2.5 cursor-pointer group"
            title="Morphos Home"
          >
            {/* Morphos Stylized Logo */}
            <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-[#1F1108] to-[#0A0704] border border-[#FF6A3D]/40 flex items-center justify-center font-display font-extrabold text-white text-sm shadow-[0_0_18px_rgba(255,106,61,0.25)] group-hover:border-[#FF6A3D] group-hover:shadow-[0_0_24px_rgba(255,106,61,0.4)] transition-all">
              <span className="bg-gradient-to-r from-[#FF6A3D] via-white to-[#FF9A4D] bg-clip-text text-transparent">
                M
              </span>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#FF6A3D] animate-pulse" />
            </div>

            {!collapsed && (
              <div className="leading-tight">
                <span className="font-display font-bold text-sm tracking-[0.2em] text-white group-hover:text-[#FF9A4D] transition-colors block">
                  MORPHOS
                </span>
                <span className="text-[9px] font-mono tracking-widest text-slate-400 uppercase block">
                  AI AGENT PLATFORM
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onToggleCollapse}
            className="text-slate-400 hover:text-white hover:bg-white/[0.05] p-1.5 rounded-lg text-xs transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="font-mono text-[11px] block">{collapsed ? '→' : '←'}</span>
          </button>
        </div>

        {/* Start New Investigation Button */}
        <button
          onClick={onNewInvestigation}
          className={`w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6A3D] to-[#FF8544] hover:from-[#FF7A00] hover:to-[#FF9A4D] text-white font-semibold text-xs py-2.5 transition-all duration-200 shadow-[0_0_24px_rgba(255,106,61,0.3)] hover:shadow-[0_0_32px_rgba(255,106,61,0.5)] border border-[#FF9A4D]/40 active:scale-[0.98] ${
            collapsed ? 'px-0' : 'px-3.5'
          }`}
          title="New Investigation"
        >
          <IconPlus className="w-4 h-4 text-white" />
          {!collapsed && (
            <span className="font-mono uppercase tracking-wider text-[11px] font-bold">
              New Investigation
            </span>
          )}
        </button>

        {/* Navigation Groups */}
        <div className="space-y-4 pt-1">
          {/* Group 1: WORKSPACE */}
          <div className="space-y-1">
            {!collapsed && (
              <div className="px-2.5 py-1 text-[10px] font-mono font-semibold tracking-[0.16em] uppercase text-slate-400">
                Workspace
              </div>
            )}
            <nav className="space-y-1">
              {workspaceItems.map((item) => {
                const isActive = activeView === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectView(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium tracking-wide transition-all duration-150 ${
                      isActive
                        ? 'bg-[#FF6A3D]/12 text-white border border-[#FF6A3D]/35 shadow-[0_0_16px_rgba(255,106,61,0.2)]'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                    } ${collapsed ? 'justify-center' : 'justify-start'}`}
                    title={item.label}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#FF6A3D]' : 'text-slate-400'}`} />
                    {!collapsed && (
                      <span className="font-sans text-[12px] font-medium tracking-wide">
                        {item.label}
                      </span>
                    )}
                    {isActive && !collapsed && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FF6A3D] shadow-[0_0_8px_#FF6A3D]" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Group 2: CONFIGURATION */}
          <div className="space-y-1 pt-2 border-t border-white/[0.05]">
            {!collapsed && (
              <div className="px-2.5 py-1 text-[10px] font-mono font-semibold tracking-[0.16em] uppercase text-slate-400">
                Configuration
              </div>
            )}
            <nav className="space-y-1">
              {configItems.map((item) => {
                const isActive = activeView === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectView(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium tracking-wide transition-all duration-150 ${
                      isActive
                        ? 'bg-[#FF6A3D]/12 text-white border border-[#FF6A3D]/35 shadow-[0_0_16px_rgba(255,106,61,0.2)]'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                    } ${collapsed ? 'justify-center' : 'justify-start'}`}
                    title={item.label}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#FF6A3D]' : 'text-slate-400'}`} />
                    {!collapsed && (
                      <span className="font-sans text-[12px] font-medium tracking-wide">
                        {item.label}
                      </span>
                    )}
                    {isActive && !collapsed && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FF6A3D] shadow-[0_0_8px_#FF6A3D]" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Technical Agent State Widget (Expanded mode only) */}
        {!collapsed && (
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5 mt-4">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <IconCpu className="w-3 h-3 text-[#FF6A3D]" />
                LangGraph Node
              </span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>
            <div className="text-[11px] text-slate-300 font-mono truncate">
              Engine: Deterministic v1
            </div>
            <div className="text-[9px] text-slate-400 font-mono">
              Loop cap: 5 iterations max
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section: Profile & Exit */}
      <div className="p-3 border-t border-white/[0.07] bg-[#08090E]/80 space-y-2.5">
        {/* Back to Landing Page Link */}
        <button
          onClick={onBackToHome}
          className={`w-full flex items-center gap-2 text-slate-400 hover:text-white text-xs transition-colors py-1.5 px-2 rounded-lg hover:bg-white/[0.04] ${
            collapsed ? 'justify-center' : 'justify-start'
          }`}
          title="Back to Landing Page"
        >
          <IconArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          {!collapsed && (
            <span className="text-[11px] tracking-wider uppercase font-mono font-medium">
              Landing Portal
            </span>
          )}
        </button>

        {/* User Card */}
        <div className={`flex items-center gap-2.5 px-1 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#FF6A3D] to-[#FF9A4D] p-[1px] shrink-0">
            <div className="w-full h-full rounded-[7px] bg-[#0A0704] flex items-center justify-center text-xs font-mono font-bold text-white">
              {(user?.email ?? 'O')[0].toUpperCase()}
            </div>
          </div>
          {!collapsed && (
            <div className="overflow-hidden min-w-0 flex-1">
              <div className="text-xs font-medium text-white truncate">
                {user?.email ?? 'Local Operator'}
              </div>
              <div className="text-[10px] text-slate-400 truncate font-mono flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${user ? 'bg-[#FF6A3D]' : 'bg-slate-500'}`} />
                {user ? 'Cloud Auth' : 'Guest Sandbox'}
              </div>
            </div>
          )}
        </div>

        {user && !collapsed && (
          <button
            onClick={onSignOut}
            className="w-full text-left text-[10px] text-slate-400 hover:text-rose-400 transition-colors py-1 px-2 font-mono uppercase tracking-wider"
          >
            Sign Out
          </button>
        )}
      </div>
    </aside>
  );
}
