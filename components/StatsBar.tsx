import React from 'react';
import { GameStats } from '../types';
import { MAX_MISTAKES } from '../constants';

interface StatsBarProps {
  stats: GameStats;
}

const StatsBar: React.FC<StatsBarProps> = ({ stats }) => {
  return (
    <div className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-50 flex justify-between items-center border-b border-slate-700">
      <div className="flex items-center space-x-6">
        <div className="hidden md:flex flex-col border-r border-slate-600 pr-6">
           <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Explorer</span>
           <span className="text-lg font-bold text-cyan-400 brand-font">{stats.playerName || 'Guest'}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Score</span>
          <span className="text-2xl font-bold text-yellow-400 brand-font">{stats.score}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Best</span>
          <span className="text-xl font-semibold">{stats.highScore}</span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="hidden sm:flex flex-col items-end">
           <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Lives</span>
           <div className="flex space-x-1 mt-1">
             {[...Array(MAX_MISTAKES)].map((_, i) => (
               <span
                key={i}
                className={`text-base transition-all ${i < stats.mistakesLeft ? 'opacity-100' : 'opacity-15 grayscale'}`}
               >❤️</span>
             ))}
           </div>
        </div>

        <div className="hidden sm:flex flex-col items-end ml-2">
           <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Clues</span>
           <div className="flex space-x-1 mt-1">
             {[...Array(3)].map((_, i) => (
               <div
                key={i}
                className={`w-3 h-3 rounded-full ${i < stats.cluesLeft ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-slate-600'}`}
               />
             ))}
           </div>
        </div>

        <div className="h-8 w-px bg-slate-600 mx-2 hidden sm:block"></div>

        <div className="flex space-x-1">
           {stats.history.slice(-5).map((item, idx) => (
             <div
               key={idx}
               className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                 item.result === 'VERNUM' ? 'bg-green-500 text-white shadow-sm' : 'bg-red-500 text-white shadow-sm'
               }`}
               title={item.country}
             >
               {item.result === 'VERNUM' ? '✓' : '✗'}
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};

export default StatsBar;
