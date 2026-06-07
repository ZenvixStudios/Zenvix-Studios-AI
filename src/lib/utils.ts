import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { PremiumTrials } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getOrResetPremiumTrials(trials?: PremiumTrials | null): PremiumTrials {
  const defaultTrials: PremiumTrials = {
    aiResponses: 3,
    businessReports: 3,
    diagrams: 3,
    pdfDownloads: 3,
    deepResearch: 3,
    visualExplanations: 3,
    lastResetAt: Date.now()
  };

  if (!trials) {
    return defaultTrials;
  }

  const resetInterval = 24 * 60 * 60 * 1000; // 24 hours
  const now = Date.now();

  if (now - (trials.lastResetAt || 0) >= resetInterval) {
    return {
      ...defaultTrials,
      lastResetAt: now
    };
  }

  return {
    aiResponses: typeof trials.aiResponses === 'number' ? trials.aiResponses : 3,
    businessReports: typeof trials.businessReports === 'number' ? trials.businessReports : 3,
    diagrams: typeof trials.diagrams === 'number' ? trials.diagrams : 3,
    pdfDownloads: typeof trials.pdfDownloads === 'number' ? trials.pdfDownloads : 3,
    deepResearch: typeof trials.deepResearch === 'number' ? trials.deepResearch : 3,
    visualExplanations: typeof trials.visualExplanations === 'number' ? trials.visualExplanations : 3,
    lastResetAt: trials.lastResetAt || now
  };
}

export function getCurrencyInfo() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (locale && (locale.includes('Calcutta') || locale.includes('Kolkata') || locale.includes('India'))) {
      return { symbol: '₹', code: 'INR', rate: 1 };
    }
  } catch (e) {}
  return { symbol: '$', code: 'USD', rate: 1/83 }; // Simplified rate logic if needed, but here we just use fixed prices in UI
}

export async function applyWatermark(base64Image: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      
      // Safety resize if image is too large for Firestore
      const MAX_SIZE = 1024;
      let width = img.width;
      let height = img.height;
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = (height / width) * MAX_SIZE;
          width = MAX_SIZE;
        } else {
          width = (width / height) * MAX_SIZE;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64Image);

      ctx.drawImage(img, 0, 0, width, height);

      const padding = canvas.width * 0.04;
      const fontSize = Math.max(14, canvas.width * 0.035);
      ctx.font = `900 ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 6;
      ctx.textBaseline = 'bottom';
      
      const text = 'Zenvix One 🎨';
      ctx.fillText(text, padding, canvas.height - padding);

      // Using jpeg instead of png to save massive amount of space
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = base64Image;
  });
}

export async function compressImage(base64Image: string, maxDimension = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64Image);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Image);
    img.src = base64Image;
  });
}

export function downloadImage(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
