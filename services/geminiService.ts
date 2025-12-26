
import { GoogleGenAI, Type } from "@google/genai";
import { M3UItem } from "../types";

// Helper to clean titles using AI
export const cleanTitlesWithAI = async (items: M3UItem[]): Promise<{ id: string, name: string }[]> => {
  // Always initialize right before use to ensure correct API key usage
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const sampleNames = items.slice(0, 50).map(item => ({ id: item.id, name: item.name }));
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Clean these channel names by removing numbers, extra spaces, and technical codes (like "FHD", "4K", "HEVC"). Return a JSON array of objects with 'id' and 'name'. Data: ${JSON.stringify(sampleNames)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING }
          },
          required: ["id", "name"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("AI parse error", e);
    return [];
  }
};

// Helper to categorize items using AI
export const categorizeWithAI = async (items: M3UItem[]): Promise<{ id: string, group: string }[]> => {
  // Always initialize right before use to ensure correct API key usage
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const sampleData = items.slice(0, 50).map(item => ({ id: item.id, name: item.name }));
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Categorize these channels into standard groups like "Movies", "Sports", "News", "Kids", "Entertainment", "Music". Return a JSON array of objects with 'id' and 'group'. Data: ${JSON.stringify(sampleData)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            group: { type: Type.STRING }
          },
          required: ["id", "group"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("AI parse error", e);
    return [];
  }
};
