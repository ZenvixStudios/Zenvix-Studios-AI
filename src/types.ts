import { Timestamp } from 'firebase/firestore';

export type Mode = 'student' | 'creator' | 'business' | 'image-lab';

export interface PremiumTrials {
  aiResponses: number;
  businessReports: number;
  diagrams: number;
  pdfDownloads: number;
  deepResearch: number;
  visualExplanations: number;
  lastResetAt: number;
}

export type ExperienceMode = 'freemium' | 'premium-preview';

export interface BetaAnalytics {
  modeSelectFreemiumCount: number;
  modeSelectPremiumPreviewCount: number;
  featureUses: {
    aiResponses: number;
    businessReports: number;
    diagrams: number;
    pdfDownloads: number;
    deepResearch: number;
    visualExplanations: number;
  };
}

export interface UserProfile {
  uid: string;
  username: string;
  isPremium: boolean;
  imageCount?: number;
  lastImageGenerationAt?: any;
  premiumTrials?: PremiumTrials;
  experienceMode?: ExperienceMode;
  betaAnalytics?: BetaAnalytics;
  onboardingPreference?: {
    language: string;
    completed: boolean;
  };
  photoURL?: string;
  createdAt: any;
}

export interface Chat {
  id: string;
  userId: string;
  title: string;
  mode: Mode;
  lastMessageAt: any;
}

export interface Message {
  id: string;
  text: string;
  imageUrl?: string;
  sender: 'user' | 'ai';
  createdAt: any;
}
