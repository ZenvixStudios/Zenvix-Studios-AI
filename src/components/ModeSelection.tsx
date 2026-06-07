import React from 'react';
import { motion } from 'motion/react';
import { GraduationCap, Palette, Briefcase, Crown, Moon, Sun, Image as ImageIcon } from 'lucide-react';
import { UserProfile, Mode } from '../types';

interface Props {
  profile: UserProfile;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onSelect: (mode: Mode) => void;
  onGoPremium: () => void;
}

export default function ModeSelection({ profile, isDarkMode, onToggleTheme, onSelect, onGoPremium }: Props) {
  const modes: { id: Mode; title: string; icon: any; color: string; desc: string }[] = [
    { 
      id: 'student', 
      title: 'Student', 
      icon: GraduationCap, 
      color: 'bg-blue-500',
      desc: 'Simple explanations & summaries'
    },
    { 
      id: 'creator', 
      title: 'Content Creator', 
      icon: Palette, 
      color: 'bg-orange-500',
      desc: 'Hooks, captions & thumbnails'
    },
    { 
      id: 'business', 
      title: 'Business', 
      icon: Briefcase, 
      color: 'bg-emerald-500',
      desc: 'Ad copy & marketing strategies'
    },
    {
      id: 'image-lab',
      title: 'Image Lab 🎨',
      icon: ImageIcon,
      color: 'bg-purple-600',
      desc: 'Advanced prompt generator'
    }
  ];

  return (
    <div className="h-full w-full flex flex-col p-6 overflow-y-auto bg-page transition-colors">
      <div className="flex items-center justify-between mb-8 mt-4">
        <div>
          <h2 className="opacity-60 text-sm">Welcome back,</h2>
          <h1 className="text-2xl font-bold font-display">{profile.username}</h1>
        </div>
        <div className="px-4 py-1.5 bg-purple-500/15 border border-purple-500/35 text-purple-400 rounded-full font-black text-[10px] uppercase tracking-widest shadow-md flex items-center gap-1.5 animate-pulse">
           🧪 Zenvix One Beta
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {modes.map((mode, index) => (
          <motion.div
            key={mode.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onSelect(mode.id)}
            className="glass-card p-5 flex items-center gap-5 cursor-pointer active:scale-[0.98] transition-all hover:bg-black/5 dark:hover:bg-white/10"
          >
            <div className={`w-14 h-14 ${mode.color} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
              <mode.icon className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold font-display">{mode.title}</h3>
              <p className="opacity-60 text-xs">{mode.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-auto pt-8 pb-4 flex items-center justify-between opacity-50 px-2 border-t border-black/5 dark:border-white/5 mt-8">
         <p className="text-[10px] uppercase tracking-widest opacity-60 font-bold">Zenvix One v1.0</p>
         <div className="flex gap-4">
            <button onClick={onToggleTheme} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
              {isDarkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-purple-accent" />}
            </button>
         </div>
      </div>
    </div>
  );
}
