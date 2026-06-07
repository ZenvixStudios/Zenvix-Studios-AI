import React from 'react';
import { motion } from 'motion/react';
import { Crown, Download, Search, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import { cn, downloadImage } from '../lib/utils';
import { Message, UserProfile, Mode, Chat } from '../types';

// smart detection of educational text layout for PDF export enablement
export const isEducationalContent = (text: string) => {
  if (!text || text.length < 600) return false;
  const cleanText = text.toLowerCase();
  
  // Educational keywords for filtering
  const edKeywords = [
    'explain', 'definition', 'concept', 'process', 'guide', 'tutorial', 
    'summary', 'lesson', 'chapter', 'theory', 'analysis', 'how to', 
    'what is', 'define', 'fundamental', 'application', 'step-by-step'
  ];
  
  // Check for structural indicators (headers, lists)
  const lines = text.split('\n');
  const hasHeaders = lines.some(l => l.trim().startsWith('#') || (l.trim().startsWith('**') && l.trim().endsWith('**') && l.trim().length < 60));
  const listCount = lines.filter(l => l.trim().startsWith('- ') || l.trim().startsWith('* ') || /^\d+\./.test(l.trim())).length;
  
  // Avoid casual chat/greetings
  const casualMarkers = ['hello', 'hi ', 'hey ', 'how are you', 'how can i help', 'welcome'];
  const isCasual = casualMarkers.some(m => cleanText.startsWith(m)) && text.length < 1000;

  const hasStructure = hasHeaders || listCount >= 3;
  const hasKeywords = edKeywords.some(k => cleanText.includes(k));
  
  return !isCasual && hasStructure && hasKeywords;
};

interface MessageBubbleProps {
  msg: Message;
  currentMode: Mode;
  profile: UserProfile;
  chats: Chat[];
  currentChatId: string | null;
  requestedPdfs: Set<string>;
  onRequestPdf: () => void;
  onSelectPdfPreview: () => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  trackFeatureUse: (feature: 'aiResponses' | 'businessReports' | 'diagrams' | 'pdfDownloads' | 'deepResearch' | 'visualExplanations') => Promise<void>;
  setZoomedImage: (url: string | null) => void;
  setShowPremiumRequireModal: (show: boolean) => void;
  setShowLimitReachedModal: (show: boolean) => void;
}

const MessageBubbleComponent = ({
  msg,
  currentMode,
  profile,
  chats,
  currentChatId,
  requestedPdfs,
  onRequestPdf,
  onSelectPdfPreview,
  onUpdateProfile,
  trackFeatureUse,
  setZoomedImage,
  setShowPremiumRequireModal,
  setShowLimitReachedModal,
}: MessageBubbleProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      className={cn("flex flex-col gap-2", msg.sender === 'user' ? "items-end" : "items-start")}
    >
      <div className={cn("px-5 py-4 rounded-[1.5rem] max-w-[92%] md:max-w-[75%] shadow-xl border relative transition-all", msg.sender === 'user' ? "bg-purple-accent text-white border-transparent" : "glass-card")}>
        {msg.imageUrl && (
          <div className="relative group/img">
            <img 
              src={msg.imageUrl} 
              alt="" 
              referrerPolicy="no-referrer"
              className="w-full max-h-[30rem] object-contain rounded-xl mb-4 border border-black/5 dark:border-white/5" 
            />
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover/img:opacity-100 transition-all">
              <button 
                type="button"
                onClick={() => setZoomedImage(msg.imageUrl!)}
                className="p-3 bg-black/60 backdrop-blur-md text-white rounded-full hover:bg-black/80 cursor-pointer active:scale-95"
              >
                <Search className="w-4 h-4" />
              </button>
              <button 
                type="button"
                onClick={() => downloadImage(msg.imageUrl!, `zenvix_${Date.now()}.png`)}
                className="p-3 bg-black/60 backdrop-blur-md text-white rounded-full hover:bg-black/80 cursor-pointer active:scale-95"
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
                  type="button"
                  onClick={onRequestPdf}
                  className="flex items-center gap-2 text-[9px] w-fit px-4 py-2 rounded-full font-black uppercase tracking-widest bg-purple-accent/10 text-purple-accent border border-purple-accent/20 hover:bg-purple-accent/20 transition-all cursor-pointer active:scale-95"
                >
                  Create PDF 📄
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {/* View PDF Button (Free) */}
                <button 
                  type="button"
                  onClick={onSelectPdfPreview}
                  className="flex items-center gap-2 text-[9px] px-4 py-2 rounded-full font-black uppercase tracking-widest backdrop-blur-md transition-all shadow-sm bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer active:scale-95"
                >
                  <Search className="w-3.5 h-3.5 opacity-60" />
                  View PDF
                </button>

                {/* Download PDF Button (Premium / Trial) */}
                <button 
                  type="button"
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
                        let r, g, b;
                        if (type === 'title') { r = 222; g = 202; b = 239; }
                        else if (type === 'keyword') { r = 255; g = 247; b = 178; }
                        else { r = 216; g = 249; b = 216; }

                        doc.setFillColor(r, g, b);
                        doc.rect(x - 0.5, y - 4.2, w + 1, 5, "F");
                    };

                    drawNotebookPage();
                    
                    doc.setTextColor(40, 40, 40);
                    
                    if (isStudent) {
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(20);
                        const title = (chats.find(c => c.id === currentChatId)?.title || "Study Notes").toUpperCase();
                        const titleWidth = doc.getTextWidth(title);
                        
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

                    let y = isStudent ? 35 : 40; 
                    const lineSpacing = 8;
                    const margin = isStudent ? 35 : 20;
                    const maxWidth = pageWidth - margin - 15;
                    
                    const lines = cleanText.split('\n');
                    
                    lines.forEach(line => {
                        if (y > pageHeight - 20) {
                          doc.addPage();
                          drawNotebookPage();
                          y = isStudent ? 27 : 30;
                        }

                        const rawText = line.replace(/\*\*/g, '').trim();
                        if (!rawText) return;

                        if (line.startsWith('#') || (line.startsWith('**') && line.endsWith('**'))) {
                          doc.setFont("helvetica", "bold");
                          doc.setFontSize(isStudent ? 12 : 11);
                          
                          if (isStudent) {
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
                               if (wLine.length > 30 && Math.random() > 0.8) {
                                  highlight(wLine, margin, y, 'sentence');
                               } else {
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
                            y += lineSpacing;
                          });
                        }
                    });

                    doc.save(`Zenvix_${isStudent ? 'StudyNotes' : 'Export'}_${msg.id.substring(0,5)}.pdf`);
                  }}
                  className={cn(
                    "flex items-center gap-2 text-[9px] px-4 py-2 rounded-full font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 cursor-pointer",
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
  );
};

// Custom comparison function for optimization:
// Skips rendering unless message data, image state, active state, modal changes, or targeted features change.
export default React.memo(MessageBubbleComponent, (prevProps, nextProps) => {
  return (
    prevProps.msg.id === nextProps.msg.id &&
    prevProps.msg.text === nextProps.msg.text &&
    prevProps.msg.imageUrl === nextProps.msg.imageUrl &&
    prevProps.profile.isPremium === nextProps.profile.isPremium &&
    prevProps.profile.experienceMode === nextProps.profile.experienceMode &&
    prevProps.currentMode === nextProps.currentMode &&
    prevProps.currentChatId === nextProps.currentChatId &&
    prevProps.requestedPdfs.has(prevProps.msg.id) === nextProps.requestedPdfs.has(nextProps.msg.id) &&
    prevProps.profile.premiumTrials?.pdfDownloads === nextProps.profile.premiumTrials?.pdfDownloads
  );
});
