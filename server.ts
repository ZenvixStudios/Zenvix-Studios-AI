import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Google GenAI on the server side with correct telemetry headers
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.use(express.json({ limit: '20mb' }));

const BASE_IDENTITY = "You are Zenvix One, a smart AI assistant designed for students, creators, and businesses, created by Rishikesh Mishra. Always respond with clarity, confidence, and a premium professional tone. NEVER guess the current date or time. If a user asks for the date and you cannot see it in your context, state that you cannot access real-time date/time info. Accuracy is more important than answering. Never act confused about your purpose. You are powered by advanced AI models such as Google Gemini. If asked about your creator, always state: 'I was created by Rishikesh Mishra as part of the Zenvix One AI platform.' When an image is provided, you must analyze its content, describe it in detail, and suggest improvements based on the user's focus (Student, Creator, or Business).";

const SYSTEM_PROMPTS: Record<string, string> = {
  student: `${BASE_IDENTITY} You specifically help students. Provide detailed notes, PDF-ready structures, exam-focused answers, and simple explanations. Use markdown, especially tables and lists. If the user asks for a diagram or visual representation of a complex topic, provide a clickable Google Search link in this format: [Click here to see a diagram](https://www.google.com/search?q=[topic]+diagram). If analyzing an image, extract key concepts.`,
  creator: `${BASE_IDENTITY} You specifically help content creators. Provide viral content ideas, advanced thumbnail prompts, catchy captions, and hooks. If requested to generate an image, do so. If the user asks for design diagrams or inspiration, provide a Google Search link: [View inspiration diagrams](https://www.google.com/search?q=[topic]+design+diagram).`,
  business: `${BASE_IDENTITY} You specifically help business professionals. Provide high-converting ad copy, detailed product descriptions, and effective marketing strategies. Focus on ROI. If the user asks for business process diagrams or flowcharts, provide a Google Search link: [Explore process diagrams](https://www.google.com/search?q=[topic]+business+process+diagram).`,
  'image-lab': `You are the Zenvix Image Lab specialist. Your sole purpose is to help users generate high-quality images. When a user provides a prompt, enhance it for maximum visual quality and return the generated image. If the user is just describing an idea, turn it into a detailed visual prompt and generate it. Professional, artistic, and visually stunning results are the priority.`
};

// API endpoint for generating AI content (text and images)
app.post("/api/gemini/generate", async (req, res) => {
  try {
    const { mode, prompt, history = [], imageBase64, isPremium = false, premiumFeature } = req.body;

    const isPremiumActive = isPremium || (!!premiumFeature && premiumFeature !== 'none');
    const isImageRequest = mode === 'image-lab' || /generate|create|make|draw|show.*image|picture|thumbnail|photo/i.test(prompt);
    
    // Feature Upgrade: Premium users in Student/Business get the image-capable model always to allow visual concept generation
    const isPremiumVisualMode = isPremiumActive && (mode === 'student' || mode === 'business');

    // Rule: Student mode only allows images for Premium users. Free users get text only.
    const canGenerateImage = isPremiumActive || mode === 'image-lab';
    const effectiveIsImageRequest = isImageRequest && canGenerateImage;

    // Use gemini-3.1-flash-image for image generation requests, or premium visual modes/diagrams/visual explanations
    // TEMPORARILY DISABLED FOR VERSION 1.0: Route all requests to gemini-3.5-flash to avoid model quota failures
    const useVisualModel = false; 
    const modelToUse = "gemini-3.5-flash";

    const parts: any[] = [{ text: prompt || (imageBase64 ? "Please analyze this image." : "") }];
    if (imageBase64) {
      parts.unshift({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64.split(',')[1]
        }
      });
    }

    let systemInstruction = SYSTEM_PROMPTS[mode] || BASE_IDENTITY;
    if (isPremiumActive) {
      systemInstruction += " The user is a PREMIUM subscriber. Provide extra detailed, comprehensive responses with superior formatting and deep insights. Focus on extremely high quality.";
      if (mode === 'student' || mode === 'business' || premiumFeature === 'diagrams' || premiumFeature === 'visualExplanations') {
        systemInstruction += " If the user asks about a complex concept, process, or product, include an ASCII diagram, detailed flowchart, or highly structured layout illustrating the topic.";
      }
    } else {
      systemInstruction += " The user is on a FREE plan. Keep responses helpful but concise.";
      if (mode !== 'image-lab') {
        systemInstruction += " If the user asks for an image, explain that visual generation is temporarily unavailable in Version 1.0. Never say you 'can't' help; always provide the best text help possible.";
      }
    }

    if (premiumFeature === 'aiResponses') {
      systemInstruction += " [PREMIUM TRIAL ACTION: AI Response] Provide extremely detailed, deep, and high quality answered explanations using professional Markdown tables, lists, and formatting.";
    } else if (premiumFeature === 'businessReports') {
      systemInstruction += " [PREMIUM TRIAL ACTION: Business Report] Structure your output specifically as a highly detailed, professional, executive-standard Business Report. Include clear headers, executive summary, analytical metrics, market observations, or ROI analysis tables.";
    } else if (premiumFeature === 'diagrams') {
      systemInstruction += " [PREMIUM TRIAL ACTION: Diagram] You MUST include a highly descriptive ascii diagram, logical flowchart, or structural visual representation of the concept directly in the text.";
    } else if (premiumFeature === 'deepResearch') {
      systemInstruction += " [PREMIUM TRIAL ACTION: Deep Research] Conduct an exhaustive Analytical Deep Research synthesis. Give a highly detailed academic/professional quality synthesis exploring comprehensive background, expert opinions, comparisons, and structured summaries with references.";
    } else if (premiumFeature === 'visualExplanations') {
      systemInstruction += " [PREMIUM TRIAL ACTION: Visual Explanation] Use visual description techniques. You must first design a descriptive ASCII layout or table mapping the ideas, then write a highly visual step-by-step description referencing that layout.";
    }

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: [
        ...history,
        { role: 'user', parts }
      ],
      config: {
        systemInstruction,
        temperature: 0.7,
        ...(modelToUse.includes("-image") && {
          imageConfig: {
            aspectRatio: '1:1'
          }
        })
      }
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    const textPart = response.text;

    res.json({
      text: textPart || (imagePart ? "Here is the image I generated for you:" : undefined),
      image: imagePart
    });
  } catch (error: any) {
    console.error("Gemini server generation error:", error);
    res.status(500).json({ error: error.message || "An error occurred during generation." });
  }
});

// API endpoint for enhancing prompt
app.post("/api/gemini/enhance", async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: `Enhance the following prompt for an AI assistant to make it more detailed and professional, but keep its core meaning. Only return the enhanced prompt text: ${prompt}` }] }],
      config: {
        temperature: 0.5,
      }
    });
    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini server enhancement error:", error);
    res.status(500).json({ error: error.message || "An error occurred during enhancement." });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
