
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { PlaylistStats } from '../types';
import { Tv, Film, PlayCircle, Activity } from 'lucide-react';

interface DashboardProps {
  stats: PlaylistStats;
}

const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  const pieData = [
    { name: 'Online', value: stats.online },
    { name: 'Offline', value: stats.offline },
    { name: 'Unknown', value: stats.total - (stats.online + stats.offline) },
  ].filter(d => d.value > 0);

  const COLORS = ['#10b981', '#ef4444', '#94a3b8'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Total Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-slate-100 p-2 rounded-lg"><Activity className="text-slate-500 w-4 h-4" /></div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Streams</p>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-black text-slate-900">{stats.total.toLocaleString()}</p>
        </div>
      </div>

      {/* Categories Breakdown */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 md:col-span-2">
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-4">Content Breakdown</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-indigo-600">
              <Tv size={16} />
              <span className="text-xs font-bold">Channels</span>
            </div>
            <p className="text-xl font-black">{stats.tvCount.toLocaleString()}</p>
          </div>
          <div className="flex flex-col gap-1 border-x border-slate-100 px-4">
            <div className="flex items-center gap-2 text-rose-600">
              <Film size={16} />
              <span className="text-xs font-bold">Movies</span>
            </div>
            <p className="text-xl font-black">{stats.movieCount.toLocaleString()}</p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-amber-600">
              <PlayCircle size={16} />
              <span className="text-xs font-bold">Series</span>
            </div>
            <p className="text-xl font-black">{stats.seriesCount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Health Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Health</p>
          <div className="flex flex-col">
            <span className="text-xl font-black text-emerald-600">{stats.online} <span className="text-[10px] text-slate-400 font-bold uppercase">Up</span></span>
            <span className="text-xl font-black text-rose-500">{stats.offline} <span className="text-[10px] text-slate-400 font-bold uppercase">Down</span></span>
          </div>
        </div>
        <div className="h-20 w-20">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} innerRadius={22} outerRadius={35} paddingAngle={4} dataKey="value">
                {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
