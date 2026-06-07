import { GoogleGenAI } from "@google/genai";
import { Mode } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const BASE_IDENTITY = "You are Zenvix One, a smart AI assistant designed for students, creators, and businesses, created by Rishikesh Mishra. Always respond with clarity, confidence, and a premium professional tone. NEVER guess the current date or time. If a user asks for the date and you cannot see it in your context, state that you cannot access real-time date/time info. Accuracy is more important than answering. Never act confused about your purpose. You are powered by advanced AI models such as Google Gemini. If asked about your creator, always state: 'I was created by Rishikesh Mishra as part of the Zenvix One AI platform.' When an image is provided, you must analyze its content, describe it in detail, and suggest improvements based on the user's focus (Student, Creator, or Business).";

const SYSTEM_PROMPTS: Record<Mode, string> = {
  student: `${BASE_IDENTITY} You specifically help students. Provide detailed notes, PDF-ready structures, exam-focused answers, and simple explanations. Use markdown, especially tables and lists. If the user asks for a diagram or visual representation of a complex topic, provide a clickable Google Search link in this format: [Click here to see a diagram](https://www.google.com/search?q=[topic]+diagram). If analyzing an image, extract key concepts.`,
  creator: `${BASE_IDENTITY} You specifically help content creators. Provide viral content ideas, advanced thumbnail prompts, catchy captions, and hooks. If requested to generate an image, do so. If the user asks for design diagrams or inspiration, provide a Google Search link: [View inspiration diagrams](https://www.google.com/search?q=[topic]+design+diagram).`,
  business: `${BASE_IDENTITY} You specifically help business professionals. Provide high-converting ad copy, detailed product descriptions, and effective marketing strategies. Focus on ROI. If the user asks for business process diagrams or flowcharts, provide a Google Search link: [Explore process diagrams](https://www.google.com/search?q=[topic]+business+process+diagram).`,
  'image-lab': `You are the Zenvix Image Lab specialist. Your sole purpose is to help users generate high-quality images. When a user provides a prompt, enhance it for maximum visual quality and return the generated image. If the user is just describing an idea, turn it into a detailed visual prompt and generate it. Professional, artistic, and visually stunning results are the priority.`
};

export const generateAIResponse = async (
  mode: Mode, 
  prompt: string, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[] = [], 
  imageBase64?: string,
  isPremium: boolean = false,
  premiumFeature?: 'aiResponses' | 'businessReports' | 'diagrams' | 'deepResearch' | 'visualExplanations' | 'none'
) => {
  try {
    const isPremiumActive = isPremium || (!!premiumFeature && premiumFeature !== 'none');
    const isImageRequest = mode === 'image-lab' || /generate|create|make|draw|show.*image|picture|thumbnail|photo/i.test(prompt);
    
    // Feature Upgrade: Premium users in Student/Business get the image-capable model always to allow visual concept generation
    const isPremiumVisualMode = isPremiumActive && (mode === 'student' || mode === 'business');

    // Rule: Student mode only allows images for Premium users. Free users get text only.
    const canGenerateImage = isPremiumActive || mode === 'image-lab';
    const effectiveIsImageRequest = isImageRequest && canGenerateImage;

    // Use gemini-2.5-flash-image for image generation requests, or premium visual modes/diagrams/visual explanations
    const useVisualModel = effectiveIsImageRequest || isPremiumVisualMode || premiumFeature === 'diagrams' || premiumFeature === 'visualExplanations';
    const modelToUse = useVisualModel ? "gemini-2.5-flash-image" : "gemini-3-flash-preview";

    const parts: any[] = [{ text: prompt || (imageBase64 ? "Please analyze this image." : "") }];
    if (imageBase64) {
      parts.unshift({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64.split(',')[1]
        }
      });
    }

    let systemInstruction = SYSTEM_PROMPTS[mode];
    if (isPremiumActive) {
      systemInstruction += " The user is a PREMIUM subscriber. Provide extra detailed, comprehensive responses with superior formatting and deep insights. Focus on extremely high quality.";
      if (mode === 'student' || mode === 'business' || premiumFeature === 'diagrams' || premiumFeature === 'visualExplanations') {
        systemInstruction += " Since you have visual capabilities, if the user asks about a complex concept, process, or product, YOU MUST ALSO GENERATE A CONCEPTUAL IMAGE OR DIAGRAM illustrating the topic AND then provide your detailed explanation using that image as a reference.";
      }
    } else {
      systemInstruction += " The user is on a FREE plan. Keep responses helpful but concise.";
      if (mode !== 'image-lab') {
        systemInstruction += " If the user asks for an image, explain that you are providing a detailed text explanation instead, and mention that visual generation can be tested by activating Premium Preview Mode in Settings. Never say you 'can't' help; always provide the best text help possible.";
      }
    }

    if (premiumFeature === 'aiResponses') {
      systemInstruction += " [PREMIUM TRIAL ACTION: AI Response] Provide extremely detailed, deep, and high quality answered explanations using professional Markdown tables, lists, and formatting.";
    } else if (premiumFeature === 'businessReports') {
      systemInstruction += " [PREMIUM TRIAL ACTION: Business Report] Structure your output specifically as a highly detailed, professional, executive-standard Business Report. Include clear headers, executive summary, analytical metrics, market observations, or ROI analysis tables.";
    } else if (premiumFeature === 'diagrams') {
      systemInstruction += " [PREMIUM TRIAL ACTION: Diagram] You MUST include a highly descriptive ascii diagram, logical flowchart, or structural visual representation of the concept directly in the text, and also generate an accompanying conceptual image explaining it visually.";
    } else if (premiumFeature === 'deepResearch') {
      systemInstruction += " [PREMIUM TRIAL ACTION: Deep Research] Conduct an exhaustive Analytical Deep Research synthesis. Give a highly detailed academic/professional quality synthesis exploring comprehensive background, expert opinions, comparisons, and structured summaries with references.";
    } else if (premiumFeature === 'visualExplanations') {
      systemInstruction += " [PREMIUM TRIAL ACTION: Visual Explanation] Use visual depiction techniques. You must first generate a descriptive conceptual graphic/image mapping the ideas, then write a highly visual step-by-step description referencing the generated visualization.";
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

    return {
      text: textPart || (imagePart ? "Here is the image I generated for you:" : undefined),
      image: imagePart
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const enhancePrompt = async (prompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: `Enhance the following prompt for an AI assistant to make it more detailed and professional, but keep its core meaning. Only return the enhanced prompt text: ${prompt}` }] }],
      config: {
        temperature: 0.5,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Enhance Error:", error);
    return prompt;
  }
};
