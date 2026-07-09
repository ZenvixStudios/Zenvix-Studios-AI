import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Sparkles, 
  Mic, 
  Send, 
  ChevronLeft, 
  Menu, 
  Download, 
  Trash2, 
  X, 
  Crown, 
  Image as ImageIcon,
  Moon,
  Sun,
  Camera,
  User,
  Settings,
  Palette,
  BookOpen,
  PenTool,
  TrendingUp,
  Layout,
  Briefcase,
  Coins,
  Edit2,
  Check,
  FileText,
  AlertTriangle,
  Calculator,
  Microscope,
  Binary,
  Target,
  BarChart3,
  PieChart,
  Lightbulb,
  Video,
  Instagram,
  Search
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where,
  orderBy, 
  serverTimestamp, 
  doc, 
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Mode, Chat, Message } from '../types';
import { generateAIResponse, enhancePrompt } from '../lib/gemini';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import { cn, applyWatermark, downloadImage, compressImage } from '../lib/utils';
import MessageBubble, { isEducationalContent } from './MessageBubble';


interface Props {
  user: FirebaseUser;
  profile: UserProfile;
  mode: Mode;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  onBack: () => void;
  onGoPremium: () => void;
}


const IMAGE_LIMIT_RESET_MS = 12 * 60 * 60 * 1000;

// --- Local Storage Persistence Helpers ---
const getLocalChatsKey = (userId: string) => `zenvix_chats_${userId}`;
const getLocalMessagesKey = (chatId: string) => `zenvix_msg_${chatId}`;
const getLocalLastChatKey = (userId: string) => `zenvix_last_chat_id_${userId}`;

const sanitizeObject = (obj: any): any => {
  if (!obj) return obj;
  if (typeof obj === 'object') {
    if (typeof obj.toMillis === 'function') return obj.toMillis();
    if (typeof obj.toDate === 'function') return obj.toDate().getTime();
    if (obj.seconds) return obj.seconds * 1000;
  }
  return obj;
};

const getLocalChats = (userId: string): Chat[] => {
  try {
    const raw = localStorage.getItem(getLocalChatsKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((c: any) => ({
      ...c,
      lastMessageAt: sanitizeObject(c.lastMessageAt)
    }));
  } catch (e) {
    console.error("Failed to load local chats", e);
    return [];
  }
};

const saveLocalChats = (userId: string, chats: Chat[]) => {
  try {
    const serialized = chats.map(c => ({
      ...c,
      lastMessageAt: sanitizeObject(c.lastMessageAt)
    }));
    localStorage.setItem(getLocalChatsKey(userId), JSON.stringify(serialized));
  } catch (e) {
    console.error("Failed to save local chats", e);
  }
};

const getLocalMessages = (chatId: string): Message[] => {
  try {
    const raw = localStorage.getItem(getLocalMessagesKey(chatId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((m: any) => ({
      ...m,
      createdAt: sanitizeObject(m.createdAt)
    }));
  } catch (e) {
    console.error("Failed to load local messages", e);
    return [];
  }
};

const saveLocalMessages = (chatId: string, messages: Message[]) => {
  try {
    const serialized = messages.map(m => ({
      ...m,
      createdAt: sanitizeObject(m.createdAt)
    }));
    localStorage.setItem(getLocalMessagesKey(chatId), JSON.stringify(serialized));
  } catch (e) {
    console.error("Failed to save local messages", e);
  }
};
// ----------------------------------------

export default function ChatScreen({ 
  user, 
  profile, 
  mode, 
  isDarkMode, 
  onToggleTheme, 
  onUpdateProfile,
  onBack, 
  onGoPremium 
}: Props) {
  const [chats, setChats] = useState<Chat[]>(() => getLocalChats(user.uid));
  const [currentChatId, setCurrentChatId] = useState<string | null>(() => {
    return localStorage.getItem(getLocalLastChatKey(user.uid));
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    const lastId = localStorage.getItem(getLocalLastChatKey(user.uid));
    if (lastId) {
      return getLocalMessages(lastId);
    }
    return [];
  });
  const [inputText, setInputText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [showUsername, setShowUsername] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showModeModal, setShowModeModal] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editUsernameVal, setEditUsernameVal] = useState(profile.username);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [pdfPreviewMessage, setPdfPreviewMessage] = useState<{id: string, text: string} | null>(null);
  const [requestedPdfs, setRequestedPdfs] = useState<Set<string>>(new Set());
  const [loadingMessage, setLoadingMessage] = useState('Thinking...');
  const [activePremiumFeature, setActivePremiumFeature] = useState<'aiResponses' | 'businessReports' | 'diagrams' | 'deepResearch' | 'visualExplanations' | 'none'>('none');
  const [showLimitReachedModal, setShowLimitReachedModal] = useState(false);
  const [showPremiumRequireModal, setShowPremiumRequireModal] = useState(false);

  const [isPremiumPanelExpanded, setIsPremiumPanelExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('premium_panel_expanded');
    return saved !== 'false';
  });

  const handleToggleExpand = (val: boolean) => {
    setIsPremiumPanelExpanded(val);
    localStorage.setItem('premium_panel_expanded', String(val));
  };

  const getRemainingUsesText = () => {
    const trials = profile.premiumTrials || {
      aiResponses: 3,
      businessReports: 3,
      diagrams: 3,
      pdfDownloads: 3,
      deepResearch: 3,
      visualExplanations: 3,
      lastResetAt: Date.now()
    };

    if (activePremiumFeature !== 'none') {
      const featureLabels: Record<string, string> = {
        aiResponses: 'AI Response',
        businessReports: 'Report',
        diagrams: 'Diagram',
        deepResearch: 'Research',
        visualExplanations: 'Visual'
      };
      const count = trials[activePremiumFeature] ?? 3;
      const label = featureLabels[activePremiumFeature] || 'Active';
      return `${count}/3 ${label} Uses Left`;
    } else {
      const totalLeft = 
        (trials.aiResponses ?? 3) +
        (trials.businessReports ?? 3) +
        (trials.diagrams ?? 3) +
        (trials.pdfDownloads ?? 3) +
        (trials.deepResearch ?? 3) +
        (trials.visualExplanations ?? 3);
      return `${totalLeft}/18 Total Uses Left`;
    }
  };

  const trackModeSelect = async (newMode: 'freemium' | 'premium-preview') => {
    const currentAnalytics = profile.betaAnalytics || {
      modeSelectFreemiumCount: 0,
      modeSelectPremiumPreviewCount: 0,
      featureUses: {
        aiResponses: 0,
        businessReports: 0,
        diagrams: 0,
        pdfDownloads: 0,
        deepResearch: 0,
        visualExplanations: 0
      }
    };

    const updatedAnalytics = {
      ...currentAnalytics,
      modeSelectFreemiumCount: currentAnalytics.modeSelectFreemiumCount + (newMode === 'freemium' ? 1 : 0),
      modeSelectPremiumPreviewCount: currentAnalytics.modeSelectPremiumPreviewCount + (newMode === 'premium-preview' ? 1 : 0),
    };

    await onUpdateProfile({
      experienceMode: newMode,
      betaAnalytics: updatedAnalytics
    });
  };

  const trackFeatureUse = async (feature: 'aiResponses' | 'businessReports' | 'diagrams' | 'pdfDownloads' | 'deepResearch' | 'visualExplanations') => {
    const currentAnalytics = profile.betaAnalytics || {
      modeSelectFreemiumCount: 0,
      modeSelectPremiumPreviewCount: 0,
      featureUses: {
        aiResponses: 0,
        businessReports: 0,
        diagrams: 0,
        pdfDownloads: 0,
        deepResearch: 0,
        visualExplanations: 0
      }
    };

    const updatedAnalytics = {
      ...currentAnalytics,
      featureUses: {
        ...currentAnalytics.featureUses,
        [feature]: (currentAnalytics.featureUses[feature] || 0) + 1
      }
    };

    await onUpdateProfile({
      betaAnalytics: updatedAnalytics
    });
  };

  // Progressive Loading State
  useEffect(() => {
    if (!isTyping || isGeneratingImage) return;

    let timer1: any;
    let timer2: any;

    if (loadingMessage.includes('Deep Research')) {
      timer1 = setTimeout(() => {
        setLoadingMessage('Analyzing source data blocks... 📂');
        timer2 = setTimeout(() => setLoadingMessage('Synthesizing research notes... 📝'), 4000);
      }, 2500);
    } else if (loadingMessage === 'Analyzing...') {
      timer1 = setTimeout(() => {
        setLoadingMessage('Thinking...');
        timer2 = setTimeout(() => setLoadingMessage('Deep thinking...'), 3000);
      }, 2000);
    } else if (loadingMessage === 'Thinking...') {
      timer1 = setTimeout(() => setLoadingMessage('Deep thinking...'), 3000);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isTyping, isGeneratingImage, loadingMessage]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  const currentMode = chats.find(c => c.id === currentChatId)?.mode || pendingMode || mode;

  // Persistence and Sweep Utilities
  const saveTimeoutRef = useRef<any>(null);

  const debouncedSaveLocal = (userId: string, chatsList: Chat[], chatId: string | null, msgs: Message[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveLocalChats(userId, chatsList);
      if (chatId && msgs.length > 0) {
        saveLocalMessages(chatId, msgs);
      }
    }, 500);
  };

  const sweepEmptyChats = async (exceptChatId?: string | null) => {
    const currentLocalChats = getLocalChats(user.uid);
    const toKeep: Chat[] = [];
    
    for (const chat of currentLocalChats) {
      const msgs = getLocalMessages(chat.id);
      if (msgs.length === 0 && chat.id !== exceptChatId) {
        console.log(`AUTO-SWEEP: Discarding empty chat ${chat.id}`);
        try {
          await deleteDoc(doc(db, 'chats', chat.id));
        } catch (err) {
          console.error("Failed to delete empty chat from DB", err);
        }
        localStorage.removeItem(getLocalMessagesKey(chat.id));
      } else {
        toKeep.push(chat);
      }
    }
    
    saveLocalChats(user.uid, toKeep);
  };

  // Mount/Unmount sweep routines & cleanup
  useEffect(() => {
    sweepEmptyChats(currentChatId);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      sweepEmptyChats(null);
    };
  }, []);

  // Set up instant load helper for chat switching
  useEffect(() => {
    if (!currentChatId) {
      setMessages([]);
      return;
    }
    const cached = getLocalMessages(currentChatId);
    if (cached.length > 0) {
      setMessages(cached);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    }
  }, [currentChatId]);

  // Load Chats
  useEffect(() => {
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      orderBy('lastMessageAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Chat));
      
      const sortedChats = data.sort((a, b) => {
        const tA = typeof a.lastMessageAt === 'number' ? a.lastMessageAt : (a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : (a.lastMessageAt?.seconds ? a.lastMessageAt.seconds * 1000 : 0));
        const tB = typeof b.lastMessageAt === 'number' ? b.lastMessageAt : (b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : (b.lastMessageAt?.seconds ? b.lastMessageAt.seconds * 1000 : 0));
        return tB - tA;
      });

      setChats(sortedChats);
      debouncedSaveLocal(user.uid, sortedChats, currentChatId, messages);
    });
    return unsubscribe;
  }, [user.uid]);

  // Load Messages
  useEffect(() => {
    if (!currentChatId) return;
    const q = query(
      collection(db, `chats/${currentChatId}/messages`),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(data);
      debouncedSaveLocal(user.uid, chats, currentChatId, data);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
    });
    return unsubscribe;
  }, [currentChatId]);

  const handleSend = async () => {
    console.log("SEND CLICKED");
    if (!inputText.trim() && !attachedImage) {
      console.log("SEND ABORTED: Empty input");
      return;
    }

    // Daily Premium Trial limit check
    const trials = profile.premiumTrials || {
      aiResponses: 3,
      businessReports: 3,
      diagrams: 3,
      pdfDownloads: 3,
      deepResearch: 3,
      visualExplanations: 3,
      lastResetAt: Date.now()
    };

    const isPremiumFeatureUse = activePremiumFeature !== 'none';
    const currentExpMode = profile.experienceMode || 'freemium';
    if (isPremiumFeatureUse) {
      if (currentExpMode === 'freemium') {
        setShowPremiumRequireModal(true);
        console.log("SEND ABORTED: Premium feature attempted in freemium mode");
        return;
      }
      if (!profile.isPremium) {
        if ((trials[activePremiumFeature] || 0) <= 0) {
          setShowLimitReachedModal(true);
          console.log("SEND ABORTED: Premium feature limit reached", activePremiumFeature);
          return;
        }
      }
    }

    // Check Reset Logic 12h
    if (!profile.isPremium) {
      const now = Date.now();
      const lastGen = profile.lastImageGenerationAt?.toMillis ? profile.lastImageGenerationAt.toMillis() : (profile.lastImageGenerationAt || 0);
      if (now - lastGen > IMAGE_LIMIT_RESET_MS && (profile.imageCount || 0) > 0) {
        await onUpdateProfile({ imageCount: 0 });
      }
    }

    let chatId = currentChatId;
    const currentInput = inputText;
    const currentAttached = attachedImage;
    const sentPremiumFeature = activePremiumFeature;
    const activeMode = pendingMode || mode;

    // Create chat if it doesn't exist (Lazy creation)
    if (!chatId) {
      console.log("CREATING NEW CHAT", { activeMode });
      
      const newChatObj: Chat = {
        id: 'local_chat_' + Date.now(),
        userId: user.uid,
        title: currentInput.slice(0, 30) || 'New Session',
        mode: activeMode,
        lastMessageAt: Date.now() as any
      };
      
      try {
        const chatDoc = await addDoc(collection(db, 'chats'), {
          userId: user.uid,
          title: currentInput.slice(0, 30) || 'New Session',
          mode: activeMode,
          lastMessageAt: serverTimestamp()
        });
        chatId = chatDoc.id;
        newChatObj.id = chatId;
      } catch (err) {
        console.error("Firestore chat creation failed", err);
        chatId = newChatObj.id;
      }
      
      setCurrentChatId(chatId);
      localStorage.setItem(getLocalLastChatKey(user.uid), chatId);
      setPendingMode(null);

      // Save list immediately
      const updatedChats = [newChatObj, ...chats];
      setChats(updatedChats);
      saveLocalChats(user.uid, updatedChats);
    }

    if (!chatId) {
      console.log("SEND ERROR: Could not establish chatId");
      return;
    }

    // Build User Msg
    const userMsg: Message = {
      id: 'local_msg_' + Date.now(),
      text: currentInput,
      sender: 'user' as const,
      createdAt: Date.now() as any
    };
    if (currentAttached) userMsg.imageUrl = currentAttached;
    
    // Instant UI Update feedback
    setInputText('');
    setAttachedImage(null);

    // Decrement the daily trials count if applicable
    if (isPremiumFeatureUse && !profile.isPremium) {
      const updatedTrials = {
        ...trials,
        [sentPremiumFeature]: Math.max(0, (trials[sentPremiumFeature] || 0) - 1)
      };
      await onUpdateProfile({ premiumTrials: updatedTrials });
      if (sentPremiumFeature && sentPremiumFeature !== 'none') {
        await trackFeatureUse(sentPremiumFeature);
      }
    }

    const isGenReq = /generate|create|make|draw|show.*image|picture|thumbnail|photo/i.test(currentInput);
    const isDateQuery = /today's date|current date|what is the date|what's the date|the date today|aaj ki date|aaj kya date hai|current time and date/i.test(currentInput);
    const isCreatorQuery = /who (made|created|developed|built) you|who is your (creator|developer|maker)|whose assistant are you/i.test(currentInput);
    const isActuallyGeneratingImage = (isGenReq && (profile.isPremium || currentMode === 'image-lab')) || sentPremiumFeature === 'diagrams' || sentPremiumFeature === 'visualExplanations';
    
    if (sentPremiumFeature === 'deepResearch') {
      setLoadingMessage("Initiating Deep Research... 🔍");
    } else if (isActuallyGeneratingImage) {
      setLoadingMessage("Generating your masterpiece...");
    } else if (currentAttached) {
      setLoadingMessage("Analyzing...");
    } else if (isDateQuery) {
      setLoadingMessage("Fetching real-time data...");
    } else if (isCreatorQuery) {
      setLoadingMessage("Verifying identity...");
    } else {
      setLoadingMessage("Thinking...");
    }

    // Save userMsg locally & optimistically first!
    const updatedUserMsgs = [...messages, userMsg];
    setMessages(updatedUserMsgs);
    debouncedSaveLocal(user.uid, chats, chatId, updatedUserMsgs);

    // Save to Firestore in background
    try {
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        text: userMsg.text,
        sender: 'user',
        createdAt: serverTimestamp(),
        ...(userMsg.imageUrl ? { imageUrl: userMsg.imageUrl } : {})
      });
      console.log("MESSAGE SENT TO FIRESTORE");
    } catch (err) {
      console.error("FAILED TO SEND USER MESSAGE TO FIRESTORE:", err);
    }

    if (isActuallyGeneratingImage) {
      setIsGeneratingImage(true);
      setIsTyping(false);
    } else {
      setIsTyping(true);
      setIsGeneratingImage(false);
    }

    try {
      // Direct Response for Date Queries
      if (isDateQuery && !currentAttached && !isGenReq) {
        const now = new Date();
        const isValid = !isNaN(now.getTime());
        
        let responseText = "";
        if (isValid) {
          const options: Intl.DateTimeFormatOptions = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          };
          const dateStr = now.toLocaleDateString(undefined, options);
          responseText = `Today's date is **${dateStr}**. (Source: Real-time System Clock)`;
        } else {
          responseText = "I cannot access real-time date right now. Please check your device clock for accuracy.";
        }
        
        const aiMsg: Message = {
          id: 'local_ai_' + Date.now(),
          text: responseText,
          sender: 'ai',
          createdAt: Date.now() as any
        };
        
        const updatedMsgsWithAI = [...updatedUserMsgs, aiMsg];
        setMessages(updatedMsgsWithAI);
        debouncedSaveLocal(user.uid, chats, chatId, updatedMsgsWithAI);

        try {
          await addDoc(collection(db, `chats/${chatId}/messages`), {
            text: aiMsg.text,
            sender: 'ai',
            createdAt: serverTimestamp()
          });
          await updateDoc(doc(db, 'chats', chatId), { lastMessageAt: serverTimestamp() });
        } catch (err) {
          console.error("Failed to write manual response to DB", err);
        }
        setIsTyping(false);
        return;
      }

      // Direct Response for Creator Queries
      if (isCreatorQuery && !currentAttached && !isGenReq) {
        const aiMsg: Message = {
          id: 'local_ai_' + Date.now(),
          text: "I was created by **Rishikesh Mishra** as part of the **Zenvix One** AI platform. I am powered by advanced AI models such as **Google Gemini**.",
          sender: 'ai',
          createdAt: Date.now() as any
        };
        
        const updatedMsgsWithAI = [...updatedUserMsgs, aiMsg];
        setMessages(updatedMsgsWithAI);
        debouncedSaveLocal(user.uid, chats, chatId, updatedMsgsWithAI);

        try {
          await addDoc(collection(db, `chats/${chatId}/messages`), {
            text: aiMsg.text,
            sender: 'ai',
            createdAt: serverTimestamp()
          });
          await updateDoc(doc(db, 'chats', chatId), { lastMessageAt: serverTimestamp() });
        } catch (err) {
          console.error("Failed to write manual response to DB", err);
        }
        setIsTyping(false);
        return;
      }

      const history = messages.map(m => ({
        role: m.sender === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.text }]
      }));
      
      const isGeneratingImageInternal = isActuallyGeneratingImage;
      
      if (isGeneratingImageInternal && !profile.isPremium) {
        const count = profile.imageCount || 0;
        if (count >= 3) {
          const aiMsg: Message = {
            id: 'local_ai_' + Date.now(),
            text: "You have reached your free image limit. Upgrade to Premium for unlimited generation 🚀",
            sender: 'ai',
            createdAt: Date.now() as any
          };
          const updatedMsgsWithAI = [...updatedUserMsgs, aiMsg];
          setMessages(updatedMsgsWithAI);
          debouncedSaveLocal(user.uid, chats, chatId, updatedMsgsWithAI);

          try {
            await addDoc(collection(db, `chats/${chatId}/messages`), {
              text: aiMsg.text,
              sender: 'ai',
              createdAt: serverTimestamp()
            });
          } catch (err) {
            console.error("Failed to write manual response to DB", err);
          }
          setIsTyping(false);
          setIsGeneratingImage(false);
          return;
        }
      }

      const { text, image } = await generateAIResponse(
        currentMode, 
        currentInput, 
        history, 
        currentAttached || undefined, 
        profile.isPremium,
        sentPremiumFeature
      );
      
      const aiMsg: Message = {
        id: 'local_ai_' + Date.now(),
        text: text || (image ? "I've generated an image for you." : "Analysis complete."),
        sender: 'ai',
        createdAt: Date.now() as any
      };
      
      if (image) {
        let imageData = `data:image/png;base64,${image}`;
        if (!profile.isPremium) {
          imageData = await applyWatermark(imageData);
          const newCount = (profile.imageCount || 0) + 1;
          await onUpdateProfile({ 
            imageCount: newCount,
            lastImageGenerationAt: serverTimestamp()
          });
        } else {
          imageData = await compressImage(imageData);
        }
        aiMsg.imageUrl = imageData;
      }

      const finalMsgs = [...updatedUserMsgs, aiMsg];
      setMessages(finalMsgs);
      debouncedSaveLocal(user.uid, chats, chatId, finalMsgs);
      
      try {
        await addDoc(collection(db, `chats/${chatId}/messages`), {
          text: aiMsg.text,
          sender: 'ai',
          createdAt: serverTimestamp(),
          ...(aiMsg.imageUrl ? { imageUrl: aiMsg.imageUrl } : {})
        });
        await updateDoc(doc(db, 'chats', chatId), { lastMessageAt: serverTimestamp() });
      } catch (err) {
        console.error("Failed to save AI response to Firestore", err);
      }
      console.log("AI RESPONSE RECEIVED AND SAVED");
    } catch (e: any) {
      console.error("AI RESPONSE ERROR:", e);
      
      const errMsg = e.message || "";
      const isQuotaError = errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("429");
      const isPermissionError = errMsg.includes("permission") || errMsg.includes("PERMISSION_DENIED") || errMsg.includes("403");
      const isImageModel = errMsg.includes("gemini-3.1-flash-image") || errMsg.includes("image");
      
      let errorText = "### ⚠️ Service Connection Error\n\nAn unexpected error occurred while communicating with the AI platform. Please check your internet connection and try again.";
      
      if (isQuotaError) {
        if (isImageModel) {
          errorText = `### ⚠️ Premium Visual Key Required\n\nThe premium visual generation engine (**gemini-3.1-flash-image**) requires a **Paid-tier Gemini API key** with active billing. On the free tier, image generation has a limit of 0.\n\n**To resolve this:**\n1. **Use Text Features**: Standard text queries (Student, Creator, Business) continue to work normally on the free tier.\n2. **Upgrade Key**: Enable billing inside your Google AI Studio project to gain paid visual generation quota.\n3. **Switch Mode**: Set your mode to Student, Creator, or Business and ask standard text questions.`;
        } else {
          errorText = `### ⚠️ Quota Exceeded (429)\n\nYou have temporarily exceeded your Gemini API rate limit or daily token quota.\n\n**To resolve this:**\n- Wait a minute before sending another query.\n- Check your quota limits in the Google AI Studio console.`;
        }
      } else if (isPermissionError) {
        errorText = `### ⚠️ API Key Access Denied (403)\n\nYour Gemini API key does not have permission to access the selected model (**${isImageModel ? "gemini-3.1-flash-image" : "gemini-3.5-flash"}**).\n\n**To resolve this:**\n- Verify your API key is correctly entered in the platform secrets settings.\n- Ensure the key has not been deleted or restricted in Google AI Studio.`;
      } else if (errMsg) {
        errorText = `### ⚠️ Gemini API Request Failed\n\n${errMsg}`;
      }

      const errorMsg: Message = {
        id: 'local_ai_err_' + Date.now(),
        text: errorText,
        sender: 'ai',
        createdAt: Date.now() as any
      };

      const finalMsgs = [...updatedUserMsgs, errorMsg];
      setMessages(finalMsgs);
      debouncedSaveLocal(user.uid, chats, chatId, finalMsgs);
      
      try {
        await addDoc(collection(db, `chats/${chatId}/messages`), {
          text: errorMsg.text,
          sender: 'ai',
          createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'chats', chatId), { lastMessageAt: serverTimestamp() });
      } catch (err) {
        console.error("Failed to save error message to Firestore", err);
      }
      console.log("AI RESPONSE ERROR VISUALIZED AND SAVED");
    } finally {
      setIsTyping(false);
      setIsGeneratingImage(false);
      setActivePremiumFeature('none');
    }
  };

  const handleNewChat = async (selectedMode: Mode) => {
    await sweepEmptyChats(null);
    setPendingMode(selectedMode);
    setCurrentChatId(null);
    localStorage.removeItem(getLocalLastChatKey(user.uid));
    setMessages([]);
    setShowModeModal(false);
    setIsSidebarOpen(false);
  };

  const handleEnhance = async () => {
    if (!inputText.trim()) return;
    const enhanced = await enhancePrompt(inputText);
    setInputText(enhanced || inputText);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setAttachedImage(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        // Avatars can be small
        const compressed = await compressImage(reader.result as string, 256, 0.7);
        onUpdateProfile({ photoURL: compressed });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(prev => prev + (prev ? ' ' : '') + transcript);
    };
    recognition.start();
  };

  const selectChat = async (id: string) => {
    await sweepEmptyChats(id);
    setCurrentChatId(id);
    localStorage.setItem(getLocalLastChatKey(user.uid), id);

    // Instant local restore of messages for target chat
    const localMsgs = getLocalMessages(id);
    setMessages(localMsgs);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);

    const now = Date.now();
    try {
      await updateDoc(doc(db, 'chats', id), { lastMessageAt: serverTimestamp() });
    } catch (e) {
      console.error("Failed to update lastMessageAt in DB", e);
    }

    // Move opened chat to top immediately in local state
    const updated = chats.map(c => c.id === id ? { ...c, lastMessageAt: now } : c)
                         .sort((a, b) => {
                           const tA = typeof a.lastMessageAt === 'number' ? a.lastMessageAt : (a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : (a.lastMessageAt?.seconds ? a.lastMessageAt.seconds * 1000 : 0));
                           const tB = typeof b.lastMessageAt === 'number' ? b.lastMessageAt : (b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : (b.lastMessageAt?.seconds ? b.lastMessageAt.seconds * 1000 : 0));
                           return tB - tA;
                         });
    setChats(updated);
    saveLocalChats(user.uid, updated);
  };

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatToDelete(id);
  };

  const confirmDelete = async () => {
    if (!chatToDelete) return;
    try {
      await deleteDoc(doc(db, 'chats', chatToDelete));
    } catch (e) {
      console.error("Failed to delete chat in firestore", e);
    }
    
    // Local deletion
    localStorage.removeItem(getLocalMessagesKey(chatToDelete));
    if (localStorage.getItem(getLocalLastChatKey(user.uid)) === chatToDelete) {
      localStorage.removeItem(getLocalLastChatKey(user.uid));
    }
    const updatedChats = chats.filter(c => c.id !== chatToDelete);
    setChats(updatedChats);
    saveLocalChats(user.uid, updatedChats);

    if (currentChatId === chatToDelete) {
      setCurrentChatId(null);
      setMessages([]);
    }
    setChatToDelete(null);
  };

  const saveUsername = async () => {
    if (editUsernameVal.trim().length >= 3) {
      await onUpdateProfile({ username: editUsernameVal.trim() });
      setIsEditingUsername(false);
    }
  };

  const renderDoodlesByMode = () => {
    const doodles: Record<Mode, any[]> = {
      student: [BookOpen, PenTool, TrendingUp, FileText, Calculator, Microscope, Binary],
      creator: [Camera, Layout, Sparkles, Palette, Video, Instagram, Lightbulb],
      business: [Briefcase, Coins, TrendingUp, Layout, Target, BarChart3, PieChart],
      'image-lab': [Palette, Sparkles, ImageIcon, Camera, Layout, Sparkles, ImageIcon]
    };

    const icons = doodles[mode] || doodles.student;

    return (
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.03] dark:opacity-[0.05]">
        {[...Array(24)].map((_, i) => {
          const Icon = icons[i % icons.length];
          return (
            <Icon 
              key={i} 
              className="absolute text-purple-accent"
              style={{
                top: `${(i * 9 + 5) % 95}%`,
                left: `${(i * 13 + 8) % 95}%`,
                width: i % 3 === 0 ? '70px' : i % 3 === 1 ? '50px' : '35px',
                height: i % 3 === 0 ? '70px' : i % 3 === 1 ? '50px' : '35px',
                transform: `rotate(${(i * 29) % 360}deg)`
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full w-full flex md:flex-row flex-col relative overflow-hidden transition-colors duration-300">
      {renderDoodlesByMode()}

      {/* PDF View Modal */}
      <AnimatePresence>
        {pdfPreviewMessage && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card w-full max-w-2xl h-[80vh] flex flex-col p-8 relative shadow-3xl text-left"
            >
              <button 
                onClick={() => setPdfPreviewMessage(null)}
                className="absolute top-6 right-6 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-all"
              >
                <X className="w-6 h-6"/>
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-purple-accent/20 rounded-xl flex items-center justify-center text-purple-accent">
                   <FileText className="w-6 h-6"/>
                </div>
                <div>
                   <h3 className="text-xl font-bold">Zenvix PDF Preview</h3>
                   <p className="text-xs opacity-50 uppercase tracking-widest font-black">Free Viewer Mode</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-6 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 mb-8 scrollbar-hide">
                 <div className="markdown-body">
                   <ReactMarkdown>{pdfPreviewMessage.text}</ReactMarkdown>
                 </div>
              </div>

              <div className="flex justify-between items-center bg-purple-accent/5 p-4 rounded-2xl border border-purple-accent/20">
                 <p className="text-[10px] font-bold opacity-60 max-w-[60%] leading-relaxed">
                   {profile.experienceMode === 'premium-preview' 
                     ? "Your Premium Preview Mode is active! You can download this PDF directly from the download button on the chat bubble." 
                     : "Enable Premium Preview Mode to download, print, and share PDFs without limits during Beta."}
                 </p>
                 {profile.experienceMode === 'premium-preview' ? (
                   <button 
                     onClick={() => setPdfPreviewMessage(null)}
                     className="px-6 py-2 bg-black/20 dark:bg-white/20 border border-black/10 dark:border-white/10 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                   >
                     Got it! 👍
                   </button>
                 ) : (
                   <button 
                     onClick={async () => {
                       setPdfPreviewMessage(null);
                       await trackModeSelect('premium-preview');
                     }}
                     className="px-6 py-2 premium-gradient text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                   >
                     Enable Preview 👑
                   </button>
                 )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Zoom Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <div 
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-10"
            onClick={() => setZoomedImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full h-full flex items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setZoomedImage(null)}
                className="absolute top-0 right-0 p-4 text-white/60 hover:text-white transition-all z-10"
              >
                <X className="w-8 h-8"/>
              </button>
              
              <div className="w-full h-full flex items-center justify-center overflow-auto p-4 scrollbar-hide">
                 <motion.img 
                   src={zoomedImage} 
                   alt="Zoomed" 
                   className="max-w-full max-h-full object-contain rounded-xl shadow-2xl cursor-zoom-out"
                   onClick={() => setZoomedImage(null)}
                   drag
                   dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                   dragElastic={0.1}
                 />
              </div>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                 <button 
                   onClick={() => downloadImage(zoomedImage, `zenvix_zoom_${Date.now()}.png`)}
                   className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-full font-bold transition-all"
                 >
                   <Download className="w-4 h-4"/>
                   Download High-Res
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {chatToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setChatToDelete(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-card w-full max-w-xs p-8 relative z-10 text-center shadow-3xl">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-base font-bold mb-8 px-2">Are you sure you want to delete this conversation?</h3>
              <div className="flex flex-col gap-3">
                <button onClick={confirmDelete} className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold active:scale-95 transition-all">Delete</button>
                <button onClick={() => setChatToDelete(null)} className="w-full py-4 bg-black/5 dark:bg-white/5 rounded-2xl font-bold active:scale-95 transition-all">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mode Selection Modal */}
      <AnimatePresence>
        {showModeModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModeModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-card w-full max-w-sm p-8 relative z-10 text-center shadow-2xl">
              <h2 className="text-2xl font-display font-bold mb-2">New Session</h2>
              <p className="text-sm opacity-60 mb-8">Choose a brain mode for your new chat</p>
              
              <div className="grid gap-4">
                {(['student', 'creator', 'business', 'image-lab'] as Mode[]).map(m => (
                  <button 
                    key={m} 
                    onClick={() => handleNewChat(m)}
                    className="p-5 ring-1 ring-purple-accent/20 hover:ring-purple-accent bg-purple-accent/5 rounded-2xl flex items-center gap-4 group transition-all relative overflow-hidden"
                  >
                    <div className="w-12 h-12 rounded-xl bg-purple-accent/20 flex items-center justify-center text-purple-accent group-hover:scale-110 transition-transform">
                      {m === 'student' ? <BookOpen/> : m === 'creator' ? <Layout/> : m === 'business' ? <Briefcase/> : <ImageIcon/>}
                    </div>
                    <div className="text-left">
                      <p className="font-bold capitalize">{m.replace('-', ' ')} Mode</p>
                      <p className="text-[10px] opacity-50 uppercase tracking-widest leading-none mt-1">
                        {m === 'image-lab' ? 'Visual Lab' : 'Smart Assistance'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Popup */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setShowProfileModal(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="glass-card w-full max-w-sm p-8 relative z-10 shadow-3xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold">Zenvix Identity</h2>
                <button onClick={() => setShowProfileModal(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full"><X className="w-5 h-5"/></button>
              </div>

              <div className="flex flex-col items-center gap-6 mb-8">
                <div className="relative cursor-pointer group" onClick={() => avatarInputRef.current?.click()}>
                  <img 
                    src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`} 
                    alt="" 
                    className="w-28 h-28 rounded-full border-4 border-purple-accent p-1 shadow-2xl object-cover ring-8 ring-purple-accent/5" 
                  />
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <Camera className="text-white w-8 h-8" />
                  </div>
                  <input type="file" ref={avatarInputRef} hidden onChange={handleAvatarUpload} accept="image/*" />
                </div>

                <div className="w-full flex flex-col items-center gap-4">
                  <div className="px-4 py-1.5 bg-purple-500/15 border border-purple-500/35 text-purple-400 rounded-full font-black text-[10px] uppercase tracking-widest shadow-md flex items-center gap-1.5 animate-pulse">
                     🧪 Zenvix One Beta
                  </div>

                  {isEditingUsername ? (
                    <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 p-1 rounded-xl w-full">
                      <input 
                        value={editUsernameVal} 
                        onChange={e => setEditUsernameVal(e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none px-3 py-2 font-bold"
                        autoFocus
                      />
                      <button onClick={saveUsername} className="p-2 bg-purple-accent text-white rounded-lg"><Check className="w-4 h-4"/></button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3 group">
                      <span className="text-2xl font-display font-bold">{profile.username}</span>
                      <button onClick={() => setIsEditingUsername(true)} className="p-2 opacity-0 group-hover:opacity-100 hover:text-purple-accent transition-all">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

               {/* Hidden AI Experience Mode in Version 1.0 */}

              <div className="space-y-4">
                <div className="flex justify-center gap-4">
                  {['Felix', 'Maya', 'Nora', 'Leo'].map(seed => (
                    <button 
                      key={seed}
                      onClick={() => onUpdateProfile({ photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}` })}
                      className={cn(
                        "w-12 h-12 rounded-full border-2 overflow-hidden transition-all scale-100 hover:scale-110",
                        profile.photoURL?.includes(seed) ? "border-purple-accent ring-4 ring-purple-accent/20" : "border-transparent opacity-60 hover:opacity-100"
                      )}
                    >
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} alt="" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-72 border-r border-black/5 dark:border-white/5 bg-sidebar p-4 z-20 transition-colors">
        <div className="flex items-center justify-between mb-8 px-2">
          <h2 className="text-2xl font-display font-bold">Zenvix One</h2>
          <button onClick={() => setShowModeModal(true)} className="p-2.5 bg-purple-accent text-white rounded-xl shadow-lg hover:shadow-purple-accent/20 transition-all active:scale-95">
             <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
          <p className="text-[10px] opacity-60 uppercase font-bold tracking-widest mb-4 px-2">Chat History</p>
          {chats.map(c => (
            <div key={c.id} onClick={() => selectChat(c.id)} className={cn("p-4 rounded-2xl border flex items-center justify-between cursor-pointer group transition-all", currentChatId === c.id ? "bg-purple-accent/15 border-purple-accent/30 shadow-sm" : "bg-black/5 dark:bg-white/5 border-transparent hover:bg-purple-accent/10")}>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm truncate pr-2 font-medium", currentChatId === c.id ? "text-purple-accent" : "")}>{c.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[8px] premium-gradient text-white px-2 py-0.5 rounded uppercase font-bold tracking-tighter">{c.mode}</span>
                </div>
              </div>
              <button onClick={(e) => deleteChat(c.id, e)} className="p-1 opacity-0 group-hover:opacity-40 hover:opacity-100 hover:text-red-500 transition-all"><Trash2 className="w-3.5 h-3.5"/></button>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-black/5 dark:border-white/5 space-y-3">
          <button onClick={onToggleTheme} className="w-full h-12 glass-card flex items-center justify-center gap-3 text-sm font-bold shadow-sm active:scale-95 transition-all">
            {isDarkMode ? <Sun className="w-4 h-4 text-yellow-400"/> : <Moon className="w-4 h-4 text-purple-accent"/>}
            {isDarkMode ? 'Light Surface' : 'Dark Interface'}
          </button>
          <div onClick={() => setShowProfileModal(true)} className="w-full h-14 glass-card flex items-center gap-3 px-3 cursor-pointer group transition-all border-none relative overflow-hidden">
            <img src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`} className="w-9 h-9 rounded-full border-2 border-purple-accent" alt=""/>
            <div className="flex-1 min-w-0">
               <p className="text-sm font-bold truncate flex items-center gap-1.5">
                {profile.username}
               </p>
               <p className="text-[9px] opacity-40 uppercase font-bold tracking-widest">My Profile</p>
            </div>
            <Settings className="w-4 h-4 opacity-40 group-hover:rotate-45 transition-transform" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full relative z-10 transition-colors">
        {/* Fixed Top Center Experience Mode Indicator Hidden in Version 1.0 */}

        {/* Mobile Header */}
        <div className="h-16 flex items-center justify-between px-4 sticky top-0 bg-transparent z-20">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 md:hidden"><ChevronLeft/></button>
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setShowUsername(!showUsername)}>
               <div className="relative">
                 <img src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`} className="w-10 h-10 rounded-full border-[2.5px] border-purple-accent p-0.5 shadow-xl bg-black/5 dark:bg-white/5" alt=""/>
               </div>
               <div className="flex flex-col items-start -space-y-0.5">
                <AnimatePresence>
                  {showUsername && (
                      <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="text-sm font-bold tracking-tight">{profile.username}</motion.span>
                  )}
                </AnimatePresence>
               </div>
            </div>
          </div>
          
          {/* Mobile Center Premium Switch Display Hidden in Version 1.0 */}

          <button onClick={() => setIsSidebarOpen(true)} className="p-2 md:hidden"><Menu/></button>
        </div>

        {/* Mobile Premium Button (Hidden in favor of top icon or fixed) */}
        {/* Removing old redundant button code */}

        {/* Messages Container */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8 md:px-16 space-y-8 scrollbar-hide">
          {currentMode === 'image-lab' ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto my-auto select-none">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="glass-card p-8 md:p-12 rounded-[2.5rem] border-purple-accent/30 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center w-full"
              >
                {/* Visual subtle glowing background */}
                <div className="absolute -top-12 -left-12 w-32 h-32 bg-purple-accent/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="w-20 h-20 bg-purple-accent/10 rounded-[2.2rem] flex items-center justify-center mb-8 border border-purple-accent/25 shadow-lg">
                  <ImageIcon className="w-9 h-9 text-purple-accent animate-pulse" />
                </div>
                
                <h3 className="text-3xl font-display font-black tracking-tight mb-4 flex items-center gap-3 justify-center text-amber-500 dark:text-amber-400">
                  <span>🚧</span> Coming Soon
                </h3>
                
                <p className="text-lg font-bold mb-4 leading-normal text-page-foreground">
                  AI Image Generation is currently unavailable in Version 1.0.
                </p>
                
                <p className="text-sm opacity-70 leading-relaxed font-medium mb-4">
                  We're rebuilding our image engine and this feature will return in the next update.
                </p>
                
                <p className="text-sm opacity-90 leading-relaxed font-semibold mb-8">
                  Thank you for your patience.
                </p>
                
                <div className="px-4 py-1.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest opacity-60">
                  Version 1.0
                </div>
              </motion.div>
            </div>
          ) : (
            <>
              {messages.length === 0 && (() => {
                const sessionLabels: Record<Mode, string> = {
                  student: "Student Success Mode",
                  creator: "Creative Studio Mode",
                  business: "Business Mode",
                  'image-lab': "🚧 Coming Soon"
                };
                const sessionDesc: Record<Mode, string> = {
                  student: "Get detailed notes, exam answers, and summaries.",
                  creator: "Generate viral ideas, hooks, and thumbnails.",
                  business: "Build marketing strategies and ad copy.",
                  'image-lab': ""
                };
                return (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40 mt-[-10%] px-6">
                     <div className="w-20 h-20 bg-purple-accent/10 rounded-[2.5rem] flex items-center justify-center mb-8 border border-purple-accent/20">
                       {currentMode === 'student' ? <BookOpen className="w-9 h-9 text-purple-accent"/> : 
                        currentMode === 'creator' ? <Palette className="w-9 h-9 text-purple-accent"/> : 
                        <Briefcase className="w-9 h-9 text-purple-accent"/>}
                     </div>
                     <h3 className="text-3xl font-display font-bold">{sessionLabels[currentMode]}</h3>
                     <p className="text-sm max-w-[18rem] mt-4 leading-relaxed font-medium whitespace-pre-wrap">{sessionDesc[currentMode]}</p>
                  </div>
                );
              })()}

              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  currentMode={currentMode}
                  profile={profile}
                  chats={chats}
                  currentChatId={currentChatId}
                  requestedPdfs={requestedPdfs}
                  onRequestPdf={() => setRequestedPdfs(prev => new Set(prev).add(msg.id))}
                  onSelectPdfPreview={() => setPdfPreviewMessage({ id: msg.id, text: msg.text })}
                  onUpdateProfile={onUpdateProfile}
                  trackFeatureUse={trackFeatureUse}
                  setZoomedImage={setZoomedImage}
                  setShowPremiumRequireModal={setShowPremiumRequireModal}
                  setShowLimitReachedModal={setShowLimitReachedModal}
                />
              ))}
            </>
          )}

          {false && messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className={cn("flex flex-col gap-2", msg.sender === 'user' ? "items-end" : "items-start")}>
              <div className={cn("px-5 py-4 rounded-[1.5rem] max-w-[92%] md:max-w-[75%] shadow-xl border relative transition-all", msg.sender === 'user' ? "bg-purple-accent text-white border-transparent" : "glass-card")}>
                {msg.imageUrl && (
                  <div className="relative group/img">
                    <img src={msg.imageUrl} alt="" className="w-full max-h-[30rem] object-contain rounded-xl mb-4 border border-black/5 dark:border-white/5" />
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover/img:opacity-100 transition-all">
                      <button 
                        onClick={() => setZoomedImage(msg.imageUrl!)}
                        className="p-3 bg-black/60 backdrop-blur-md text-white rounded-full hover:bg-black/80"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => downloadImage(msg.imageUrl!, `zenvix_${Date.now()}.png`)}
                        className="p-3 bg-black/60 backdrop-blur-md text-white rounded-full hover:bg-black/80"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                <div className="markdown-body">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
                {msg.sender === 'ai' && isEducationalContent(msg.text) && (
                  <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                    {!requestedPdfs.has(msg.id) ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-[10px] font-bold opacity-50 italic">Do you want this as a study PDF?</p>
                        <button 
                          onClick={() => setRequestedPdfs(prev => new Set(prev).add(msg.id))}
                          className="flex items-center gap-2 text-[9px] w-fit px-4 py-2 rounded-full font-black uppercase tracking-widest bg-purple-accent/10 text-purple-accent border border-purple-accent/20 hover:bg-purple-accent/20 transition-all"
                        >
                          Create PDF 📄
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {/* View PDF Button (Free) */}
                        <button 
                          onClick={() => setPdfPreviewMessage({ id: msg.id, text: msg.text })}
                          className="flex items-center gap-2 text-[9px] px-4 py-2 rounded-full font-black uppercase tracking-widest backdrop-blur-md transition-all shadow-sm bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10"
                        >
                          <Search className="w-3.5 h-3.5 opacity-60" />
                          View PDF
                        </button>

                        {/* Download PDF Button (Premium / Trial) */}
                        <button 
                          onClick={async () => {
                            const currentExpMode = profile.experienceMode || 'freemium';
                            if (currentExpMode === 'freemium') {
                              setShowPremiumRequireModal(true);
                              return;
                            }

                            const trials = profile.premiumTrials || {
                              aiResponses: 3,
                              businessReports: 3,
                              diagrams: 3,
                              pdfDownloads: 3,
                              deepResearch: 3,
                              visualExplanations: 3,
                              lastResetAt: Date.now()
                            };

                            if (!profile.isPremium) {
                              if ((trials.pdfDownloads || 0) <= 0) {
                                setShowLimitReachedModal(true);
                                return;
                              }
                              await onUpdateProfile({
                                premiumTrials: {
                                  ...trials,
                                  pdfDownloads: (trials.pdfDownloads || 0) - 1
                                }
                              });
                              await trackFeatureUse('pdfDownloads');
                            }
                            const doc = new jsPDF();
                            const pageWidth = doc.internal.pageSize.getWidth();
                            const pageHeight = doc.internal.pageSize.getHeight();
                            const isStudent = currentMode === 'student';
                            
                            // Content Cleaning
                            const cleanText = msg.text
                              .split('\n')
                              .filter(line => {
                                const l = line.toLowerCase().trim();
                                if (l.startsWith('hello') || l.startsWith('hi ') || l.startsWith('hey ')) return false;
                                if (l.includes('how can i help') || l.includes('what can i do next')) return false;
                                if (l.includes('let me know if you need more help')) return false;
                                if (l.includes('hope this helps')) return false;
                                return true;
                              })
                              .join('\n');

                            const drawNotebookPage = () => {
                              if (!isStudent) return;
                              // Draw Notebook Lines
                              doc.setDrawColor(220, 235, 255); // Light Blue
                              doc.setLineWidth(0.2);
                              for (let i = 28; i < pageHeight - 10; i += 8) {
                                doc.line(0, i, pageWidth, i);
                              }
                              // Margin Line
                              doc.setDrawColor(255, 200, 200); // Soft Pink/Red
                              doc.setLineWidth(0.5);
                              doc.line(30, 0, 30, pageHeight);
                            };

                            const highlight = (text: string, x: number, y: number, type: 'title' | 'keyword' | 'sentence') => {
                                const w = doc.getTextWidth(text);
                                // RGBA emulation by blending with white background for maximum compatibility
                                // Title (Purple): rgba(123, 44, 191, 0.25) -> [222, 202, 239]
                                // Keyword (Yellow): rgba(255, 230, 0, 0.3) -> [255, 247, 178]
                                // Sentence (Green): rgba(144, 238, 144, 0.35) -> [216, 249, 216]
                                let r, g, b;
                                if (type === 'title') { r = 222; g = 202; b = 239; }
                                else if (type === 'keyword') { r = 255; g = 247; b = 178; }
                                else { r = 216; g = 249; b = 216; }

                                doc.setFillColor(r, g, b);
                                // Soft marker stroke effect with padding
                                doc.rect(x - 0.5, y - 4.2, w + 1, 5, "F");
                            };

                            drawNotebookPage();
                            
                            doc.setTextColor(40, 40, 40);
                            
                            if (isStudent) {
                                // Centered Bold Title
                                doc.setFont("helvetica", "bold");
                                doc.setFontSize(20);
                                const title = (chats.find(c => c.id === currentChatId)?.title || "Study Notes").toUpperCase();
                                const titleWidth = doc.getTextWidth(title);
                                
                                // Purple Highlight for Title
                                highlight(title, (pageWidth - titleWidth) / 2, 20, 'title');
                                doc.text(title, pageWidth / 2, 20, { align: "center" });

                                doc.setFontSize(8);
                                doc.setFont("helvetica", "normal");
                                doc.text(`PROCESSED BY ZENVIX ONE • STUDENT MODE • ${new Date().toLocaleDateString()}`, pageWidth / 2, 26, { align: "center" });
                            } else {
                                doc.setFontSize(18);
                                doc.setFont("helvetica", "bold");
                                doc.text("ZENVIX ONE EXPORT", 20, 20);
                            }

                            // Initial Y positioning to sit on the first line after header
                            // Lines at 28, 36, 44... Text at y-1
                            let y = isStudent ? 35 : 40; 
                            const lineSpacing = 8;
                            const margin = isStudent ? 35 : 20;
                            const maxWidth = pageWidth - margin - 15;
                            
                            const lines = cleanText.split('\n');
                            
                            lines.forEach(line => {
                                if (y > pageHeight - 20) {
                                  doc.addPage();
                                  drawNotebookPage();
                                  y = isStudent ? 27 : 30; // 27 sits on 28
                                }

                                const rawText = line.replace(/\*\*/g, '').trim();
                                if (!rawText) return;

                                if (line.startsWith('#') || (line.startsWith('**') && line.endsWith('**'))) {
                                  doc.setFont("helvetica", "bold");
                                  doc.setFontSize(isStudent ? 12 : 11);
                                  
                                  if (isStudent) {
                                    // Keyword / Heading highlighting (Yellow)
                                    highlight(rawText, margin, y, 'keyword');
                                  }
                                  
                                  doc.text(rawText, margin, y);
                                  y += lineSpacing;
                                } else {
                                  doc.setFont("helvetica", "normal");
                                  doc.setFontSize(9);
                                  
                                  const isBullet = line.trim().startsWith('-') || line.trim().startsWith('*') || /^\d+\./.test(line.trim());
                                  const prefix = isBullet ? "• " : "";
                                  const content = isBullet ? rawText.replace(/^[-*]|\d+\./, '').trim() : rawText;
                                  
                                  const wrappedLines = doc.splitTextToSize(prefix + content, maxWidth);
                                  
                                  wrappedLines.forEach((wLine: string) => {
                                    if (y > pageHeight - 20) {
                                      doc.addPage();
                                      drawNotebookPage();
                                      y = isStudent ? 27 : 30;
                                    }

                                    if (isStudent) {
                                       // Precise Sentence / Keyword Highlighting
                                       if (wLine.length > 30 && Math.random() > 0.8) {
                                          // Important Sentence Highlight (Green)
                                          highlight(wLine, margin, y, 'sentence');
                                       } else {
                                          // Random keyword highlights
                                          const words = wLine.split(' ');
                                          let curX = margin;
                                          words.forEach(word => {
                                            if (word.length > 5 && /^[A-Z]/.test(word) && Math.random() > 0.9) {
                                              highlight(word, curX, y, 'keyword');
                                            }
                                            curX += doc.getTextWidth(word + " ");
                                          });
                                       }
                                    }

                                    doc.text(wLine, margin, y);
                                    y += lineSpacing; // Move to EXACTLY next notebook line
                                  });
                                }
                            });

                            doc.save(`Zenvix_${isStudent ? 'StudyNotes' : 'Export'}_${msg.id.substring(0,5)}.pdf`);
                          }}
                          className={cn(
                            "flex items-center gap-2 text-[9px] px-4 py-2 rounded-full font-black uppercase tracking-widest transition-all shadow-xl active:scale-95",
                            profile.isPremium 
                              ? "premium-gradient text-white" 
                              : "bg-yellow-400 text-black shadow-yellow-400/20"
                          )}
                        >
                          <Crown className="w-3.5 h-3.5 fill-current" />
                          Download PDF 👑
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-[9px] uppercase font-black opacity-30 px-1 tracking-[0.15em]">{msg.sender === 'user' ? 'Me' : 'Zenvix One'}</p>
            </motion.div>
          ))}
          {(isGeneratingImage || isTyping) && (
             <div className="flex flex-col gap-3 p-4 items-start ml-4 glass-card border-none bg-purple-accent/10 rounded-2xl w-fit">
                <div className="flex gap-2 items-center text-purple-accent">
                   {[0, 1, 2].map(i => (
                     <motion.div key={i} animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }} className="w-1.5 h-1.5 bg-current rounded-full" />
                   ))}
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-purple-accent/60">{loadingMessage}</p>
             </div>
          )}
        </div>

        {/* Input Navigation Bar */}
        <div className="p-4 md:p-8 bg-transparent max-w-5xl mx-auto w-full z-20 pb-16">
          <AnimatePresence>
            {currentMode === 'image-lab' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-3xl p-5 text-center shadow-lg backdrop-blur-md max-w-xl mx-auto"
              >
                <p className="text-lg font-bold text-amber-500 mb-1.5 flex items-center justify-center gap-2">
                  <span>🚧</span> Coming Soon
                </p>
                <p className="text-sm font-semibold opacity-90 leading-relaxed">
                  Image Generation is temporarily unavailable in Version 1.0.
                </p>
                <p className="text-xs opacity-60 mt-2 leading-relaxed">
                  We're currently upgrading our image engine and this feature will return in the next update. Thank you for your patience.
                </p>
              </motion.div>
            )}
            {attachedImage && (
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 10 }} className="mb-6 flex items-center gap-4 glass-card p-3 pr-5 w-fit mx-auto relative border-purple-accent/30 shadow-2xl">
                <img src={attachedImage} className="w-16 h-16 rounded-2xl object-cover border border-purple-accent shadow-lg" alt=""/>
                <div className="text-left">
                  <p className="text-[12px] font-black uppercase text-purple-accent tracking-[0.1em]">Attached</p>
                  <p className="text-[10px] opacity-60 font-bold">Analysis Ready</p>
                </div>
                <button onClick={() => setAttachedImage(null)} className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"><X className="w-4 h-4"/></button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Daily Premium Trial Selector */}
          {false && !profile.isPremium && (
            <motion.div 
              layout
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="mb-4 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-3xl relative overflow-hidden"
              id="premium-preview-panel"
            >
              {isPremiumPanelExpanded ? (
                /* EXPANDED STATE (Default) */
                <div className="p-4 pt-7 transition-all duration-200">
                  {/* Small centered toggle arrow for collapse */}
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10">
                    <button
                      type="button"
                      onClick={() => handleToggleExpand(false)}
                      className="w-10 h-6 flex items-center justify-center bg-transparent hover:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-full transition-all cursor-pointer active:scale-95"
                      title="Collapse Premium Panel"
                      id="btn-collapse-arrow"
                    >
                      <span className="text-sm font-bold antialiased leading-none">▼</span>
                    </button>
                  </div>

                  <div className="flex md:flex-row flex-col md:items-center justify-between gap-3 mb-3 border-b border-black/5 dark:border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-yellow-500 fill-current animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-wider">👑 Premium Daily Trial Features</span>
                    </div>
                    {activePremiumFeature !== 'none' && (
                      <div className="text-[11px] font-bold text-yellow-500 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20 animate-pulse">
                         👑 Premium Uses Left Today: {(profile.premiumTrials || {
                          aiResponses: 3,
                          businessReports: 3,
                          diagrams: 3,
                          pdfDownloads: 3,
                          deepResearch: 3,
                          visualExplanations: 3,
                          lastResetAt: Date.now()
                         })[activePremiumFeature]}/3
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActivePremiumFeature('none')}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                        activePremiumFeature === 'none' 
                          ? "bg-purple-accent text-white border-transparent" 
                          : "bg-black/5 dark:bg-white/5 border-transparent hover:bg-black/10 dark:hover:bg-white/10"
                      )}
                    >
                      Standard (Unlimited)
                    </button>
                    {[
                      { id: 'aiResponses' as const, label: 'Premium AI Response', limitKey: 'aiResponses' as const, icon: Sparkles },
                      { id: 'businessReports' as const, label: 'Business Report', limitKey: 'businessReports' as const, icon: Briefcase },
                      { id: 'diagrams' as const, label: 'Diagram Pro', limitKey: 'diagrams' as const, icon: Layout },
                      { id: 'deepResearch' as const, label: 'Deep Research', limitKey: 'deepResearch' as const, icon: Search },
                      { id: 'visualExplanations' as const, label: 'Visual Explanation', limitKey: 'visualExplanations' as const, icon: ImageIcon }
                    ].map(feat => {
                      const Icon = feat.icon;
                      const useCount = (profile.premiumTrials || {
                        aiResponses: 3,
                        businessReports: 3,
                        diagrams: 3,
                        pdfDownloads: 3,
                        deepResearch: 3,
                        visualExplanations: 3,
                        lastResetAt: Date.now()
                      })[feat.limitKey];
                      const isActive = activePremiumFeature === feat.id;
                      return (
                        <button
                          key={feat.id}
                          type="button"
                          onClick={() => {
                            if (useCount <= 0) {
                              setShowLimitReachedModal(true);
                              return;
                            }
                            setActivePremiumFeature(isActive ? 'none' : feat.id);
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border",
                            isActive 
                              ? "bg-yellow-400 text-black border-yellow-400/30 scale-105 shadow-md font-black" 
                              : "bg-black/5 dark:bg-white/5 border-transparent hover:bg-black/10 dark:hover:bg-white/10"
                          )}
                        >
                          <Icon className={cn("w-3.5 h-3.5", isActive ? "text-black" : "text-yellow-500")} />
                          <span>{feat.label}</span>
                          <span className="opacity-55 text-[10px]">({useCount}/3)</span>
                        </button>
                      );
                    })}
                    {/* Read-only / descriptive pill showing PDF Downloads limit */}
                    <div 
                      className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border border-dashed border-yellow-500/20 bg-yellow-400/5 dark:bg-yellow-400/10 text-yellow-500 dark:text-yellow-400"
                      title="PDF Download limit"
                      id="pdf-downloads-pill"
                    >
                      <Download className="w-3.5 h-3.5 text-yellow-500 dark:text-yellow-400" />
                      <span>PDF Downloads Remaining</span>
                      <span className="opacity-75 text-[10px]">({(profile.premiumTrials || { pdfDownloads: 3 }).pdfDownloads ?? 3}/3)</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* COLLAPSED STATE */
                <div className="p-3.5 flex items-center justify-between transition-all duration-200">
                  <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-xs md:text-sm">
                    <Crown className="w-4 h-4 text-purple-500 fill-current animate-pulse shrink-0" />
                    <span>👑 Premium Preview Active • {getRemainingUsesText()}</span>
                  </div>
                  {/* Large easy-to-tap ▲ arrow trigger */}
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(true)}
                    className="w-10 h-7 flex items-center justify-center bg-transparent hover:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-full transition-all cursor-pointer active:scale-95 shrink-0"
                    title="Expand Premium Panel"
                    id="btn-expand-arrow"
                  >
                    <span className="text-xs font-bold antialiased leading-none">▲</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}

          <div className="glass-card p-2 md:p-2.5 flex items-end gap-2 shadow-2xl transition-all border-black/5 dark:border-white/5 relative">
            <div className="relative">
              <button 
                onClick={() => {
                  if (currentMode !== 'image-lab') {
                    setShowUploadMenu(!showUploadMenu);
                  }
                }} 
                disabled={currentMode === 'image-lab'}
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-all opacity-60 hover:opacity-100 group disabled:opacity-30 disabled:cursor-not-allowed",
                  showUploadMenu && "bg-purple-accent/10 opacity-100"
                )}
              >
                <Plus className={cn("w-7 h-7 transition-transform duration-300", showUploadMenu && "rotate-45")}/>
              </button>

              <AnimatePresence>
                {showUploadMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full left-0 mb-4 bg-sidebar border border-black/5 dark:border-white/5 rounded-2xl p-2 w-48 shadow-3xl z-30"
                  >
                    <button 
                      disabled
                      className="w-full flex items-center justify-between p-3 opacity-40 cursor-not-allowed rounded-xl transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <ImageIcon className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-bold">Upload Image</span>
                      </div>
                      <span className="text-[9px] bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded font-black uppercase tracking-tight">Soon</span>
                    </button>
                    <button 
                      disabled
                      className="w-full flex items-center justify-between p-3 opacity-40 cursor-not-allowed rounded-xl transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Palette className="w-5 h-5 text-purple-accent" />
                        <span className="text-sm font-bold">Generate Image 🎨</span>
                      </div>
                      <span className="text-[9px] bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded font-black uppercase tracking-tight">Soon</span>
                    </button>
                    <button 
                      onClick={() => { 
                        if (!profile.isPremium) {
                          onGoPremium();
                        } else {
                          alert('PDF analysis feature coming soon to Zenvix One Pro!'); 
                        }
                        setShowUploadMenu(false); 
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all relative group/pdflock"
                    >
                      <FileText className="w-5 h-5 text-blue-500" />
                      <span className="text-sm font-bold">Upload PDF</span>
                      {!profile.isPremium ? (
                        <div className="ml-auto flex items-center gap-1 opacity-40 group-hover/pdflock:opacity-100 transition-opacity">
                            <Crown className="w-3 h-3 text-yellow-500 fill-current" />
                            <span className="text-[9px]">🔒</span>
                        </div>
                      ) : (
                        <Crown className="w-3 h-3 text-yellow-400 fill-current ml-auto" />
                      )}
                    </button>
                    <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5 px-3">
                      <p className="text-[9px] opacity-40 font-bold uppercase tracking-widest text-center">AI Data Analysis</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <input type="file" ref={fileInputRef} hidden onChange={handleImageUpload} accept="image/*" />
            
            <textarea 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={currentMode === 'image-lab' ? "Image Generation is temporarily unavailable..." : ((isGeneratingImage || isTyping) ? "Ask next..." : "Ask anything...")}
              disabled={currentMode === 'image-lab'}
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
              }}
              onKeyDown={(e) => { 
                if(e.key === 'Enter' && !e.shiftKey) { 
                  e.preventDefault(); 
                  if (currentMode !== 'image-lab') {
                    handleSend();
                  } 
                } 
              }}
              className="flex-1 bg-transparent border-none outline-none py-3 px-2 text-[15px] font-medium max-h-[200px] scrollbar-hide leading-relaxed placeholder-gray-500/60 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            
            <div className="flex items-center gap-1.5 pb-1">
              <button 
                onClick={() => {
                  if (currentMode !== 'image-lab') {
                    handleVoiceInput();
                  }
                }} 
                disabled={currentMode === 'image-lab'}
                className={cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed", 
                  isListening ? "bg-red-500/20 text-red-500 scale-110 shadow-lg" : "hover:bg-black/5 dark:hover:bg-white/10 opacity-60 hover:opacity-100"
                )}
              >
                <Mic className={cn("w-5 h-5", isListening && "animate-pulse")}/>
              </button>
              <button 
                onClick={() => {
                  if (currentMode !== 'image-lab') {
                    handleEnhance();
                  }
                }} 
                disabled={currentMode === 'image-lab'}
                className="w-11 h-11 rounded-2xl flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-purple-accent/60 group disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform"/>
              </button>
              <button 
                type="button"
                onClick={() => {
                  if (currentMode !== 'image-lab') {
                    handleSend();
                  }
                }} 
                disabled={currentMode === 'image-lab' || (!inputText.trim() && !attachedImage)}
                className={cn(
                  "w-12 h-12 flex-shrink-0 premium-gradient rounded-2xl flex items-center justify-center text-white shadow-xl shadow-purple-accent/20 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:scale-95",
                  (!inputText.trim() && !attachedImage) 
                    ? "opacity-30 cursor-not-allowed scale-95" 
                    : "opacity-100 cursor-pointer hover:scale-105"
                )}
              >
                <Send className="w-5 h-5"/>
              </button>
            </div>
          </div>
          <p className="text-[10px] text-center opacity-30 mt-3 font-medium">Zenvix AI can make mistakes. Please verify important information.</p>
        </div>
      </div>

      {/* Mobile Slide Menu */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-md z-[70] md:hidden" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed right-0 top-0 bottom-0 w-[82%] bg-sidebar z-[80] p-6 flex flex-col md:hidden border-l border-black/5 dark:border-white/5">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-display font-bold">Menu</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2"><X className="w-7 h-7"/></button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide">
                <div className="flex items-center justify-between px-1 mb-4">
                  <p className="text-[10px] font-black opacity-60 uppercase tracking-widest">History</p>
                  <button onClick={() => { setShowModeModal(true); setIsSidebarOpen(false); }} className="text-[10px] text-purple-accent font-black uppercase tracking-widest border border-purple-accent/20 px-3 py-1 rounded-full">New Session</button>
                </div>
                {chats.map(c => (
                  <div key={c.id} onClick={() => { selectChat(c.id); setIsSidebarOpen(false); }} className={cn("p-5 rounded-3xl border transition-all active:scale-[0.98]", currentChatId === c.id ? "bg-purple-accent/15 border-purple-accent/40" : "bg-black/5 dark:bg-white/5 border-transparent")}>
                    <p className="text-sm font-bold truncate mb-1">{c.title}</p>
                    <div className="flex items-center gap-2">
                       <div className="w-1 h-1 bg-purple-accent rounded-full"/>
                       <span className="text-[9px] opacity-40 uppercase font-black">{c.mode}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-auto space-y-4 pt-8 pb-4">
                <button onClick={onToggleTheme} className="w-full h-16 glass-card rounded-3xl flex items-center justify-center gap-4 text-sm font-black uppercase tracking-widest shadow-xl border-none">
                  {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400"/> : <Moon className="w-5 h-5 text-purple-accent"/>}
                  {isDarkMode ? 'Light Surface' : 'Dark Interface'}
                </button>
                <div onClick={() => { setShowProfileModal(true); setIsSidebarOpen(false); }} className="w-full h-16 glass-card rounded-3xl flex items-center px-4 gap-4 active:scale-95 transition-transform border-none">
                  <img src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`} alt="" className="w-10 h-10 rounded-full border-2 border-purple-accent p-0.5 shadow-lg" />
                  <span className="font-extrabold flex-1 truncate">{profile.username}</span>
                  <Settings className="w-6 h-6 opacity-40" />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Limit Reached Modal */}
      <AnimatePresence>
        {showLimitReachedModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLimitReachedModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-card w-full max-w-sm p-8 relative z-10 text-center shadow-3xl border-purple-accent/30">
              <div className="w-16 h-16 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Crown className="w-8 h-8 text-yellow-500 fill-current animate-pulse" />
              </div>
              <h3 className="text-xl font-bold mb-3">👑 Premium Preview Limit Reached</h3>
              <p className="text-sm font-medium leading-relaxed">
                Your daily preview quota has been used.
              </p>
              <p className="text-xs opacity-60 leading-relaxed mb-6 mt-1">
                Resets automatically in 24 hours.
              </p>
              <button onClick={() => setShowLimitReachedModal(false)} className="w-full py-3.5 premium-gradient text-white rounded-2xl font-bold active:scale-95 transition-all shadow-xl text-xs uppercase tracking-wider">
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Premium Preview Require Modal */}
      <AnimatePresence>
        {showPremiumRequireModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPremiumRequireModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-card w-full max-w-sm p-8 relative z-10 text-center shadow-3xl border-purple-accent/30">
              <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Crown className="w-8 h-8 text-purple-400 fill-current animate-pulse" />
              </div>
              <h3 className="text-xl font-bold mb-3">👑 Premium Preview Required</h3>
              <p className="text-sm opacity-85 leading-relaxed mb-6">
                This is a future premium feature. Change your AI Experience Mode to Premium Preview to test this capability during Beta!
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={async () => {
                    setShowPremiumRequireModal(false);
                    await trackModeSelect('premium-preview');
                  }} 
                  className="w-full py-3.5 premium-gradient text-white rounded-2xl font-bold active:scale-95 transition-all shadow-xl text-xs uppercase tracking-wider animate-pulse"
                >
                  Switch to Premium Preview 👑
                </button>
                <button onClick={() => setShowPremiumRequireModal(false)} className="w-full py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl font-bold active:scale-95 transition-all text-xs hover:bg-black/10 dark:hover:bg-white/10">
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
