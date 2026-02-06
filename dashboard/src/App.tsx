import React, { useState, useEffect } from 'react';
import {
  Zap,
  Gem,
  Trophy,
  Activity,
  Shield,
  ChevronRight,
  TrendingUp,
  Box
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const StatCard = ({ icon: Icon, label, value, subValue, colorClass, glowClass }: any) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className={`glass-panel p-6 flex flex-col gap-4 relative overflow-hidden group`}
  >
    <div className={`absolute -right-4 -top-4 w-24 h-24 blur-3xl opacity-20 ${glowClass}`} />
    <div className="flex justify-between items-start">
      <div className={`p-3 rounded-lg bg-opacity-10 ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="text-xs font-bold opacity-50 tracking-widest uppercase">HUD_STATUS_OK</div>
    </div>
    <div>
      <h3 className="text-sm opacity-60 mb-1">{label}</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold font-display">{value}</span>
        {subValue && <span className="text-xs opacity-40">{subValue}</span>}
      </div>
    </div>
  </motion.div>
);

const EventItem = ({ title, type, hash, time }: any) => (
  <div className="flex items-center gap-4 p-4 border-b border-white border-opacity-5 hover:bg-white hover:bg-opacity-5 transition-colors group">
    <div className="p-2 rounded bg-purple-500 bg-opacity-20">
      <Activity className="w-4 h-4 text-purple-400" />
    </div>
    <div className="flex-1">
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold text-sm">{title}</span>
        <span className="text-[10px] opacity-40 font-display uppercase">{type}</span>
      </div>
      <div className="flex justify-between items-center">
        <code className="text-[10px] opacity-30 truncate w-32">{hash}</code>
        <span className="text-[10px] opacity-30 italic">{time}</span>
      </div>
    </div>
    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
  </div>
);

function App() {
  const [xp, setXp] = useState(7420);
  const maxXP = 10000;

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      {/* Header */}
      <header className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            CASHIE WATCHER
          </h1>
          <p className="opacity-40 tracking-[0.3em] font-display text-xs">OPERATIONAL_CONTROL_PANEL_V1.0</p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-[10px] opacity-40 font-display uppercase">Agent Sync</p>
            <p className="text-xs font-bold text-emerald-400">ACTIVE</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-purple-600 animate-pulse-glow flex items-center justify-center border border-purple-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <StatCard
          icon={Zap}
          label="Total Experience"
          value={xp.toLocaleString()}
          subValue="LVL 12"
          colorClass="bg-purple-500 text-purple-400"
          glowClass="bg-purple-500"
        />
        <StatCard
          icon={Gem}
          label="Gems Collected"
          value="1,402"
          colorClass="bg-amber-500 text-amber-400"
          glowClass="bg-amber-500"
        />
        <StatCard
          icon={Trophy}
          label="Global Rank"
          value="#42"
          subValue="TOP 1%"
          colorClass="bg-blue-500 text-blue-400"
          glowClass="bg-blue-500"
        />
      </div>

      {/* Progress Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-panel p-8">
            <div className="flex justify-between items-end mb-4">
              <h2 className="text-lg">Progression Status</h2>
              <span className="text-xs opacity-50 font-display">{Math.round((xp / maxXP) * 100)}% TO NEXT LVL</span>
            </div>
            <div className="relative h-4 bg-white bg-opacity-5 rounded-full overflow-hidden mb-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(xp / maxXP) * 100}%` }}
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-indigo-600 shadow-[0_0_15px_rgba(124,58,237,0.5)]"
              />
            </div>
            <div className="flex justify-between text-[10px] opacity-40 font-display">
              <span>ALPHA_SECTOR</span>
              <span>OMEGA_SYNC</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-panel p-6">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm">Active Watchers</h3>
              </div>
              <ul className="space-y-4 text-sm opacity-60">
                <li className="flex justify-between"><span>Base ERC20 Logs</span> <span className="text-emerald-400">UP</span></li>
                <li className="flex justify-between"><span>Medium RSS Feed</span> <span className="text-emerald-400">UP</span></li>
                <li className="flex justify-between"><span>Node Status Agent</span> <span className="text-amber-400">BUSY</span></li>
              </ul>
            </div>
            <div className="glass-panel p-6">
              <div className="flex items-center gap-3 mb-6">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm">Network Load</h3>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold font-display">0.42</span>
                <span className="text-[10px] opacity-30">GWEI</span>
              </div>
              <div className="w-full bg-white bg-opacity-5 h-1 rounded-full overflow-hidden">
                <div className="w-1/3 h-full bg-purple-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Latest Events */}
        <div className="glass-panel flex flex-col">
          <div className="p-6 border-b border-white border-opacity-5 flex justify-between items-center">
            <h2 className="text-sm">SEC_LOGS_STREAM</h2>
            <Box className="w-4 h-4 opacity-30" />
          </div>
          <div className="flex-1 overflow-y-auto max-h-[500px]">
            <EventItem title="Large CARV Transfer" type="TOKEN" hash="0x12a...34b" time="2m ago" />
            <EventItem title="New Medium Post: Cashie" type="RSS" hash="Announcement" time="15m ago" />
            <EventItem title="Contract Interaction" type="BASE" hash="0x584...f2a0" time="42m ago" />
            <EventItem title="Airdrop Claims Active" type="EVENT" hash="ProtocolService" time="1h ago" />
            <EventItem title="Proxy Upgrade Detected" type="ADMIN" hash="0xa91...634" time="3h ago" />
          </div>
          <div className="p-4 text-center">
            <button className="text-[10px] font-display opacity-40 hover:opacity-100 transition-opacity uppercase tracking-widest">
              VIEW_HISTORY_ARCHIVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
