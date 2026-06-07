import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Globe } from 'lucide-react';

interface Props {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: Props) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center p-6 bg-page transition-colors">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <div className="mb-8 flex flex-col items-center">
          <div className="w-20 h-20 bg-purple-accent rounded-3xl flex items-center justify-center purple-glow mb-4">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-display font-bold tracking-tight mb-2">Zenvix One</h1>
          <p className="opacity-60 text-sm">Your premium AI companion</p>
        </div>

        <button 
          id="google-login-btn"
          onClick={onLogin}
          className="w-full h-14 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-semibold flex items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5 pointer-events-none" alt="" />
          Continue with Google
        </button>

        <button 
          id="ms-login-btn"
          onClick={onLogin}
          className="w-full h-14 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-inherit rounded-2xl font-semibold flex items-center justify-center gap-3 mt-4 active:scale-95 transition-transform"
        >
          <Globe className="w-5 h-5 text-blue-500" />
          Continue with Microsoft
        </button>

        <p className="mt-8 text-xs opacity-40 max-w-[280px] mx-auto">
          By continuing, you agree to Zenvix's Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}
