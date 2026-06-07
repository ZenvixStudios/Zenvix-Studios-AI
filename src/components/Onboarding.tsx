import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Camera, Zap, MessageSquare, ChevronRight, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  onComplete: (language: string) => void;
}

const LANGUAGES = [
  { id: 'en', name: 'English', flag: '🇺🇸' },
  { id: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { id: 'hn', name: 'Hinglish', flag: '🇮🇳' },
  { id: 'es', name: 'Spanish', flag: '🇪🇸' },
  { id: 'fr', name: 'French', flag: '🇫🇷' },
  { id: 'de', name: 'German', flag: '🇩🇪' },
];

const TUTORIAL_CONTENT: Record<string, any[]> = {
  en: [
    {
      title: "Choose Your Mode",
      desc: "Switch between Student, Creator, and Business modes to get specialized AI help for your tasks.",
      icon: BookOpen,
      color: "text-blue-500"
    },
    {
      title: "Smart Chat",
      desc: "Chat with Zenvix One naturally. It remembers your context and provides high-quality structured answers.",
      icon: MessageSquare,
      color: "text-purple-accent"
    },
    {
      title: "Image Lab",
      desc: "Generate stunning images from prompts or analyze your uploaded photos instantly.",
      icon: Camera,
      color: "text-emerald-500"
    },
    {
      title: "Go Premium",
      desc: "Unlock PDF exports, unlimited image generation, and faster response times with Premium.",
      icon: Zap,
      color: "text-yellow-500"
    }
  ],
  hi: [
    {
      title: "अपना मोड चुनें",
      desc: "अपने कार्यों के लिए विशेष AI सहायता प्राप्त करने के लिए छात्र, निर्माता और व्यावसायिक मोड के बीच स्विच करें।",
      icon: BookOpen,
      color: "text-blue-500"
    },
    {
      title: "स्मार्ट चैट",
      desc: "Zenvix One के साथ सहजता से चैट करें। यह आपके संदर्भ को याद रखता है और उच्च गुणवत्ता वाले उत्तर देता है।",
      icon: MessageSquare,
      color: "text-purple-accent"
    },
    {
      title: "इमेज लैब",
      desc: "प्रॉम्प्ट से शानदार चित्र बनाएं या अपनी अपलोड की गई तस्वीरों का तुरंत विश्लेषण करें।",
      icon: Camera,
      color: "text-emerald-500"
    },
    {
      title: "प्रीमियम बनें",
      desc: "प्रीमियम के साथ PDF एक्सपोर्ट, असीमित इमेज जनरेशन और तेज़ रिस्पांस टाइम अनलॉक करें।",
      icon: Zap,
      color: "text-yellow-500"
    }
  ],
  hn: [
    {
      title: "Apna Mode Chune",
      desc: "Student, Creator, aur Business modes ke beech switch karein specialized AI help ke liye.",
      icon: BookOpen,
      color: "text-blue-500"
    },
    {
      title: "Smart Chat",
      desc: "Zenvix One ke saath naturally chat karein. Ye aapka context yaad rakhta hai aur badhiya answers deta hai.",
      icon: MessageSquare,
      color: "text-purple-accent"
    },
    {
      title: "Image Lab",
      desc: "Prompts se amazing images banayein ya apni photos ka instant analysis karein.",
      icon: Camera,
      color: "text-emerald-500"
    },
    {
      title: "Go Premium",
      desc: "PDF exports aur unlimited image generation ke liye Premium unlock karein.",
      icon: Zap,
      color: "text-yellow-500"
    }
  ],
  es: [
    {
      title: "Elige tu modo",
      desc: "Cambia entre los modos Estudiante, Creador y Negocios para obtener ayuda de IA especializada.",
      icon: BookOpen,
      color: "text-blue-500"
    },
    {
      title: "Chat Inteligente",
      desc: "Chatea con Zenvix One de forma natural. Recuerda tu contexto y ofrece respuestas estructuradas.",
      icon: MessageSquare,
      color: "text-purple-accent"
    },
    {
      title: "Laboratorio de Imágenes",
      desc: "Genera imágenes impresionantes a partir de prompts o analiza tus fotos subidas al instante.",
      icon: Camera,
      color: "text-emerald-500"
    },
    {
      title: "Hazte Premium",
      desc: "Desbloquea exportaciones PDF, generación ilimitada de imágenes y respuestas más rápidas con Premium.",
      icon: Zap,
      color: "text-yellow-500"
    }
  ],
  fr: [
    {
      title: "Choisissez votre mode",
      desc: "Passez d'un mode Étudiant, Créateur ou Entreprise pour obtenir une aide IA spécialisée.",
      icon: BookOpen,
      color: "text-blue-500"
    },
    {
      title: "Chat Intelligent",
      desc: "Discutez naturellement avec Zenvix One. Il mémorise votre contexte et fournit des réponses structurées.",
      icon: MessageSquare,
      color: "text-purple-accent"
    },
    {
      title: "Laboratoire d'Images",
      desc: "Générez des images époustouflantes à partir de prompts ou analysez instantanément vos photos.",
      icon: Camera,
      color: "text-emerald-500"
    },
    {
      title: "Passez au Premium",
      desc: "Débloquez les exports PDF, la génération d'images illimitée et des réponses plus rapides.",
      icon: Zap,
      color: "text-yellow-500"
    }
  ],
  de: [
    {
      title: "Wähle deinen Modus",
      desc: "Wechsle zwischen den Modi Student, Creator und Business für spezialisierte KI-Hilfe.",
      icon: BookOpen,
      color: "text-blue-500"
    },
    {
      title: "Smarter Chat",
      desc: "Chatte ganz natürlich mit Zenvix One. Es merkt sich deinen Kontext und gibt strukturierte Antworten.",
      icon: MessageSquare,
      color: "text-purple-accent"
    },
    {
      title: "Bild-Labor",
      desc: "Erstelle beeindruckende Bilder aus Prompts oder analysiere deine hochgeladenen Fotos sofort.",
      icon: Camera,
      color: "text-emerald-500"
    },
    {
      title: "Werde Premium",
      desc: "Schalte PDF-Exporte, unbegrenzte Bilderzeugung und schnellere Antworten mit Premium frei.",
      icon: Zap,
      color: "text-yellow-500"
    }
  ],
};

export default function Onboarding({ onComplete }: Props) {
  const [stage, setStage] = useState<'language' | 'tutorial'>('language');
  const [selectedLang, setSelectedLang] = useState('en');
  const [step, setStep] = useState(0);

  const steps = TUTORIAL_CONTENT[selectedLang] || TUTORIAL_CONTENT.en;

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(s => s + 1);
    } else {
      onComplete(selectedLang);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md pointer-events-auto">
      <AnimatePresence mode="wait">
        {stage === 'language' ? (
          <motion.div 
            key="language"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="w-full max-w-sm glass-card p-8 rounded-[2.5rem] border-none shadow-2xl relative overflow-hidden z-10 pointer-events-auto"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-accent/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <h2 className="text-2xl font-display font-bold mb-2">Welcome! 🚀</h2>
            <p className="text-sm opacity-60 mb-8">Choose your tutorial language</p>
            
            <div className="grid grid-cols-1 gap-3">
              {LANGUAGES.map(lang => (
                <motion.button 
                  key={lang.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    setSelectedLang(lang.id);
                    setStage('tutorial');
                  }}
                  className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 hover:bg-purple-accent/10 hover:ring-1 hover:ring-purple-accent/30 rounded-2xl transition-all group cursor-pointer text-left w-full"
                >
                  <span className="font-bold text-sm tracking-tight">{lang.name}</span>
                  <span className="text-xl">{lang.flag}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="tutorial"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-md glass-card p-4 rounded-[2.5rem] border-none shadow-2xl overflow-hidden z-10 pointer-events-auto"
          >
            <div className="p-6 relative z-20">
              <div className="flex items-center justify-between mb-8">
                <div className="flex gap-1.5">
                  {steps.map((_, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "h-1 rounded-full transition-all duration-500", 
                        i === step ? "w-8 bg-purple-accent" : "w-3 bg-black/10 dark:bg-white/10"
                      )} 
                    />
                  ))}
                </div>
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onComplete(selectedLang)} 
                  className="text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer p-2 -mr-2"
                >
                  Skip <X className="w-3.5 h-3.5" />
                </motion.button>
              </div>

              <div className="min-h-[220px]">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={step}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    <div className={cn("w-20 h-20 rounded-[2rem] bg-black/5 dark:bg-white/5 flex items-center justify-center mx-auto transition-colors", steps[step].color)}>
                      {React.createElement(steps[step].icon, { size: 32, className: "stroke-[2.5px]" })}
                    </div>
                    
                    <div className="text-center space-y-3">
                      <h3 className="text-2xl font-display font-bold tracking-tight">{steps[step].title}</h3>
                      <p className="text-sm opacity-60 leading-relaxed max-w-[280px] mx-auto font-medium">{steps[step].desc}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-10 flex gap-4">
                <motion.button 
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNext}
                  className="flex-1 h-14 bg-purple-accent hover:bg-purple-accent/90 rounded-[1.5rem] text-white font-bold flex items-center justify-center gap-2 group shadow-lg shadow-purple-accent/20 transition-all cursor-pointer"
                >
                  <span className="text-sm uppercase tracking-widest">{step === steps.length - 1 ? 'Get Started' : 'Next'}</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
