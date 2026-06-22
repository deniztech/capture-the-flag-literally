import { GoogleGenAI } from "@google/genai";
import { Country } from "../types";

// Initialize the API client safely
const apiKey = process.env.API_KEY || '';
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const generateClue = async (country: Country): Promise<string> => {
  const fallbackClue = `Hint: It is located in ${country.continent} and its capital starts with ${country.capital.charAt(0)}.`;

  if (!ai) {
    return fallbackClue;
  }

  try {
    const model = 'gemini-2.5-flash';
    const prompt = `You are a Geography Quiz Master. Give a specific, clever, but solvable 1-sentence clue for the country "${country.name}". Do NOT mention the name of the country. Do NOT mention the capital city name directly. Focus on geography, bordering seas/countries, or famous landmarks. Keep it under 20 words.`;
    
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    
    return response.text.trim() || fallbackClue;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return fallbackClue;
  }
};

export const generateReaction = async (type: 'VERNUM' | 'FALSUM' | 'TIMEOUT', country: Country): Promise<string> => {
  const fallback = type === 'VERNUM' ? "Correct!" : `The answer was ${country.name}.`;

  if (!ai) {
    switch (type) {
      case 'VERNUM': return "Splendid work! You nailed it!";
      case 'FALSUM': return `Not quite! That was ${country.name}.`;
      case 'TIMEOUT': return `Time flies! That was ${country.name}.`;
    }
  }

  try {
    const model = 'gemini-2.5-flash';
    let prompt = "";
    
    if (type === 'VERNUM') {
      prompt = `Generate a short, enthusiastic, 1-sentence celebration for correctly guessing ${country.name}. Use words like "Sensational", "Brilliant", "Magnificent".`;
    } else if (type === 'FALSUM') {
      prompt = `Generate a short, gentle, encouraging 1-sentence correction. The correct answer was ${country.name}. Don't be mean.`;
    } else {
      prompt = `Generate a short, fun, 1-sentence message about running out of time. The answer was ${country.name}.`;
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    
    return response.text.trim() || fallback;
  } catch (error) {
    return fallback;
  }
};