import React, { useState } from 'react';
import { motion } from 'motion/react';
import { UserCircle } from 'lucide-react';

interface Props {
  onComplete: (username: string) => void;
}

export default function UsernameSetup({ onComplete }: Props) {
  const [username, setUsername] = useState('');

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center p-6 bg-page transition-colors">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm text-center"
      >
        <div className="mb-8 flex flex-col items-center">
          <div className="w-16 h-16 bg-black/5 dark:bg-white/10 rounded-full flex items-center justify-center mb-4">
            <UserCircle className="w-10 h-10 text-purple-accent" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">Set your username</h1>
          <p className="opacity-60 text-sm">How should Zenvix call you?</p>
        </div>

        <div className="relative mb-6">
          <input 
            id="username-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Explorer123"
            className="w-full h-14 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl px-5 text-inherit focus:border-purple-accent focus:outline-none transition-all placeholder:opacity-30"
          />
        </div>

        <button 
          id="setup-complete-btn"
          disabled={username.length < 3}
          onClick={() => onComplete(username)}
          className="w-full h-14 premium-gradient text-white rounded-2xl font-semibold shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
        >
          Get Started
        </button>
      </motion.div>
    </div>
  );
}
