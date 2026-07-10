import { GoogleGenAI } from "@google/genai";
import { Handler } from "@netlify/functions";

// Initialize Google GenAI on the server side with correct telemetry headers
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export const handler: Handler = async (event, context) => {
  // CORS Headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing Request Body" })
      };
    }

    const { prompt } = JSON.parse(event.body);
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: `Enhance the following prompt for an AI assistant to make it more detailed and professional, but keep its core meaning. Only return the enhanced prompt text: ${prompt}` }] }],
      config: {
        temperature: 0.5,
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text: response.text })
    };
  } catch (error: any) {
    console.error("Gemini Netlify Function enhancement error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "An error occurred during enhancement." })
    };
  }
};
