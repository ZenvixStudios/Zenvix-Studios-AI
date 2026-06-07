import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { auth, signInWithGoogle, db } from './lib/firebase';
import { UserProfile, Mode } from './types';
import LoginScreen from './components/LoginScreen';
import UsernameSetup from './components/UsernameSetup';
import ModeSelection from './components/ModeSelection';
import ChatScreen from './components/ChatScreen';
import PremiumScreen from './components/PremiumScreen';
import Onboarding from './components/Onboarding';
import { AnimatePresence, motion } from 'motion/react';
import { getOrResetPremiumTrials } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'setup' | 'mode' | 'chat' | 'premium' | 'image-lab'>('mode');
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // 1. Disable auto-reset of storage to support persistence
  useEffect(() => {
    console.log("AUTO-RESET: Storage persistence enabled");
  }, []);

  useEffect(() => {
    document.body.className = isDarkMode ? 'dark' : 'light';
  }, [isDarkMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        console.log("AUTO-RESET: User identified");
        
        try {
          // Check if profile exists first
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);

          if (!docSnap.exists()) {
            // 3. Create fresh Profile
            const initialTrials = getOrResetPremiumTrials(null);
            const newProfileData = {
              username: u.displayName || 'User_' + Math.floor(Math.random() * 1000),
              isPremium: false,
              imageCount: 0,
              premiumTrials: initialTrials,
              onboardingPreference: { language: 'en', completed: false },
              photoURL: u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`,
              createdAt: serverTimestamp(),
            };
            
            await setDoc(docRef, newProfileData);
            setProfile({ uid: u.uid, ...newProfileData } as UserProfile);
          } else {
            // Profile exists, but update standard fields gracefully
            const existingData = docSnap.data();
            const currentTrials = getOrResetPremiumTrials(existingData?.premiumTrials);
            
            const resetData = {
              ...existingData,
              isPremium: existingData.isPremium || false,
              imageCount: existingData.imageCount || 0,
              premiumTrials: currentTrials,
              onboardingPreference: existingData.onboardingPreference || { language: 'en', completed: false },
              username: existingData.username || u.displayName || 'User_' + Math.floor(Math.random() * 1000),
              createdAt: existingData.createdAt || serverTimestamp(),
            };

            await setDoc(docRef, resetData, { merge: true });
            setProfile({ uid: u.uid, ...resetData } as UserProfile);
          }
          
          setView('mode'); 
          console.log("AUTO-RESET: Profile loaded successfully");
        } catch (err) {
          console.error("Auto-reset failed:", err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleUsernameSetup = async (username: string) => {
    if (!user) return;
    const initialTrials = getOrResetPremiumTrials(null);
    const newProfile = {
      username,
      isPremium: false,
      imageCount: 0,
      premiumTrials: initialTrials,
      photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', user.uid), newProfile);
    setProfile({ uid: user.uid, ...newProfile } as UserProfile);
    setView('mode');
  };

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    if (!user || !profile) return;
    await setDoc(doc(db, 'users', user.uid), updates, { merge: true });
    setProfile({ ...profile, ...updates });
  };

  const showOnboarding = profile && !profile.onboardingPreference?.completed;

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-page transition-colors">
        <motion.div 
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-12 h-12 rounded-full border-4 border-purple-accent border-t-transparent animate-spin"
        />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={signInWithGoogle} />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative font-sans bg-page transition-colors text-inherit">
      {showOnboarding && (
        <Onboarding 
          onComplete={async (lang) => {
            await handleUpdateProfile({
              onboardingPreference: { language: lang, completed: true }
            });
          }} 
        />
      )}
      <AnimatePresence mode="wait">
        {view === 'setup' && (
          <UsernameSetup key="setup" onComplete={handleUsernameSetup} />
        )}
        {view === 'mode' && profile && (
          <ModeSelection 
            key="mode" 
            profile={profile} 
            isDarkMode={isDarkMode}
            onToggleTheme={() => setIsDarkMode(!isDarkMode)}
            onSelect={(mode) => {
              setSelectedMode(mode);
              if (mode === 'image-lab') {
                setView('image-lab');
              } else {
                setView('chat');
              }
            }} 
            onGoPremium={() => setView('premium')}
          />
        )}
        {(view === 'chat' || view === 'image-lab') && profile && (
          <ChatScreen 
            key="chat" 
            user={user}
            profile={profile}
            mode={selectedMode!}
            isDarkMode={isDarkMode}
            onToggleTheme={() => setIsDarkMode(!isDarkMode)}
            onUpdateProfile={handleUpdateProfile}
            onBack={() => setView('mode')}
            onGoPremium={() => setView('premium')}
          />
        )}
        {view === 'premium' && profile && (
          <PremiumScreen 
            key="premium" 
            profile={profile}
            onBack={() => setView('mode')} 
            onUpgrade={async () => {
              // Simulate payment success
              const newProfile = { ...profile, isPremium: true };
              await setDoc(doc(db, 'users', user.uid), { isPremium: true }, { merge: true });
              setProfile(newProfile as UserProfile);
              setView('mode');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
