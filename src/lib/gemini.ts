import { Mode } from "../types";

export const generateAIResponse = async (
  mode: Mode, 
  prompt: string, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[] = [], 
  imageBase64?: string,
  isPremium: boolean = false,
  premiumFeature?: 'aiResponses' | 'businessReports' | 'diagrams' | 'deepResearch' | 'visualExplanations' | 'none'
) => {
  try {
    const response = await fetch("/api/gemini/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode,
        prompt,
        history,
        imageBase64,
        isPremium,
        premiumFeature,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      text: data.text,
      image: data.image
    };
  } catch (error) {
    console.error("Gemini Proxy Error:", error);
    throw error;
  }
};

export const enhancePrompt = async (prompt: string) => {
  try {
    const response = await fetch("/api/gemini/enhance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Enhance Proxy Error:", error);
    return prompt;
  }
};
