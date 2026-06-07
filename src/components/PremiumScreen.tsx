import React from 'react';
import { Check, ChevronLeft, Crown } from 'lucide-react';
import { UserProfile } from '../types';

interface Props {
  profile: UserProfile;
  onBack: () => void;
  onUpgrade: () => void;
}

export default function PremiumScreen({ profile, onBack, onUpgrade }: Props) {
  const trials = profile.premiumTrials || {
    aiResponses: 3,
    businessReports: 3,
    diagrams: 3,
    pdfDownloads: 3,
    deepResearch: 3,
    visualExplanations: 3,
    lastResetAt: Date.now()
  };

  const trialList = [
    { title: "Premium AI Responses", limit: trials.aiResponses, desc: "Detailed, insightful & highly structured answers" },
    { title: "Premium Diagrams", limit: trials.diagrams, desc: "ASCII schematics & accompanying concept diagrams" },
    { title: "Premium PDF Downloads", limit: trials.pdfDownloads, desc: "Instant high-stakes custom study/marketing exports" },
    { title: "Premium Business Reports", limit: trials.businessReports, desc: "Executive summaries & ROI target tables" },
    { title: "Premium Deep Research Requests", limit: trials.deepResearch, desc: "Comprehensive academic & expert compilation data" },
    { title: "Premium Visual Explanations", limit: trials.visualExplanations, desc: "Illustrative graphics & descriptive concepts breakdown" }
  ];

  return (
    <div className="h-full w-full flex flex-col p-6 overflow-y-auto bg-page transition-colors">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-xl font-display font-bold">Premium Features Preview 👑</h1>
      </div>

      {/* Pre-Launch Special Trial Banner */}
      <div className="mb-8 p-6 bg-purple-accent/15 border border-purple-accent/35 rounded-3xl relative overflow-hidden shadow-xl shadow-purple-accent/10">
        <div className="absolute -top-3 -right-3 w-24 h-24 bg-yellow-400/5 rounded-full blur-xl" />
        <div className="absolute top-0 right-0 bg-yellow-400 text-black text-[9px] font-black px-4 py-1 rounded-bl-xl uppercase tracking-widest animate-pulse">
          Beta Mode
        </div>
        <div className="flex items-center gap-3 mb-3 text-purple-accent">
          <Crown className="w-6 h-6 fill-current text-yellow-500" />
          <h2 className="text-lg font-extrabold tracking-tight">Active Pre-launch Daily Trial</h2>
        </div>
        <p className="text-sm opacity-90 leading-relaxed font-medium">
          Premium subscriptions are coming soon. Until launch, all users can test premium features with limited daily access.
        </p>
      </div>

      {/* Benefits Preview Rows */}
      <div className="space-y-4 mb-8">
        <h3 className="opacity-45 text-[10px] font-black uppercase tracking-widest px-1">Your Daily Quota Balances</h3>
        {trialList.map((trial, index) => (
          <div key={index} className="flex items-center gap-4 glass-card p-4 rounded-2xl border-black/5 dark:border-white/5 shadow-sm transition-all hover:translate-x-1">
            <div className="w-10 h-10 bg-yellow-400/10 rounded-xl flex items-center justify-center border border-yellow-400/10">
              <Check className="w-5 h-5 text-green-500 font-extrabold" />
            </div>
            <div className="flex-1 truncate">
              <h4 className="text-sm font-bold">{trial.title}</h4>
              <p className="text-[11px] opacity-65 truncate font-medium">{trial.desc}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-black px-3 py-1.5 bg-yellow-400/10 text-yellow-500 rounded-full border border-yellow-500/15">
                {trial.limit}/3 left
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pb-4 text-center">
        <p className="text-[10px] opacity-45 font-semibold uppercase tracking-wider">Subscribing is disabled during Beta test loops</p>
      </div>
    </div>
  );
}
