import { GoogleGenAI, Type } from "@google/genai";
import { Intent, ResponseStyle } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const model = "gemini-3-flash-preview";

export async function analyzeIntent(text: string): Promise<Intent> {
  const response = await ai.models.generateContent({
    model,
    contents: `Analyze the intent of this desk officer query: "${text}". 
    Categorize it into exactly one of: complaint, inquiry, emergency, or general.
    Return only the category name.`,
    config: {
      responseMimeType: "text/plain",
    }
  });

  const intent = response.text?.toLowerCase().trim() as Intent;
  return ['complaint', 'inquiry', 'emergency', 'general'].includes(intent) ? intent : 'general';
}

export async function generateProfessionalResponse(
  query: string, 
  intent: Intent, 
  style: ResponseStyle,
  language: string = 'English'
): Promise<string> {
  const stylePrompt = {
    formal: "professional, respectful, and standard administrative tone",
    concise: "brief, direct, and to the point",
    detailed: "comprehensive, explaining steps or reasons thoroughly"
  }[style];

  const response = await ai.models.generateContent({
    model,
    contents: `You are a professional Desk Officer called DeskGenie.
    User Query: "${query}"
    Detected Intent: ${intent}
    Requested Style: ${stylePrompt}
    Target Language: ${language} (If the language is Yoruba, Igbo, or Hausa, ensure culturally appropriate professional phrasing).

    Generate a professional response.`,
  });

  return response.text || "I apologize, but I am unable to generate a response at the moment.";
}
