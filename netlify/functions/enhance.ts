import { GoogleGenAI } from "@google/genai";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const jsonResponse = (statusCode: number, body: unknown) =>
  new Response(JSON.stringify(body), { status: statusCode, headers: CORS_HEADERS });

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method Not Allowed" });
  }

  // Initialize Google GenAI on the server side with correct telemetry headers.
  // Netlify's AI Gateway injects GEMINI_API_KEY at runtime; no key is set manually.
  const ai = new GoogleGenAI({
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  try {
    const bodyText = await req.text();
    if (!bodyText) {
      return jsonResponse(400, { error: "Missing Request Body" });
    }

    const { prompt } = JSON.parse(bodyText);
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: `Enhance the following prompt for an AI assistant to make it more detailed and professional, but keep its core meaning. Only return the enhanced prompt text: ${prompt}` }] }],
      config: {
        temperature: 0.5,
      }
    });

    return jsonResponse(200, { text: response.text });
  } catch (error: any) {
    console.error("Gemini Netlify Function enhancement error:", error);
    return jsonResponse(500, { error: error.message || "An error occurred during enhancement." });
  }
};
