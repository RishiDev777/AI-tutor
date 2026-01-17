import { GoogleGenAI, Chat, GenerateContentResponse, Content } from "@google/genai";
import { CORE_SYSTEM_PROMPT } from "../constants";
import { SessionConfig } from "../types";

let client: GoogleGenAI | null = null;
let chatSession: Chat | null = null;
let currentModel: string = 'gemini-3-flash-preview';
let currentSystemInstruction: string = '';
let lastUsedMode: 'standard' | 'fast' | 'thinking' | 'image-forced' | null = null;

const getClient = (): GoogleGenAI => {
  if (!client) {
    if (!process.env.API_KEY) {
      throw new Error("API Key is missing.");
    }
    client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return client;
};

export const initializeChat = async (config: SessionConfig): Promise<void> => {
  const ai = getClient();
  
  // Construct a specific system prompt based on user config
  currentSystemInstruction = `
${CORE_SYSTEM_PROMPT}

CURRENT STUDENT PROFILE:
Grade: ${config.grade}
Subject: ${config.subject}
Chapter: ${config.chapter}
Current Mode: ${config.mode}
  `;

  currentModel = 'gemini-3-flash-preview';
  lastUsedMode = 'standard';

  chatSession = ai.chats.create({
    model: currentModel,
    config: {
      systemInstruction: currentSystemInstruction,
      temperature: 0.7,
    },
  });
};

interface SendMessageOptions {
  image?: string; // Base64
  mode?: 'fast' | 'thinking' | 'standard';
}

export const streamMessageToAI = async function* (message: string, options: SendMessageOptions = {}) {
  if (!chatSession) {
    throw new Error("Chat session not initialized");
  }

  const ai = getClient();

  // Determine Target Model and Base Config
  let targetModel = 'gemini-3-flash-preview';
  
  // Always start with the base instruction
  let finalSystemInstruction = currentSystemInstruction;
  let temperature = 0.7;
  let thinkingConfig = undefined;
  
  // Effective mode calculation to track state changes
  let effectiveMode: 'standard' | 'fast' | 'thinking' | 'image-forced' = options.mode || 'standard';

  // Priority 1: Image (Must use Pro)
  if (options.image) {
    targetModel = 'gemini-3-pro-preview';
    effectiveMode = 'image-forced';
  } 
  // Priority 2: Thinking Mode
  else if (options.mode === 'thinking') {
    targetModel = 'gemini-3-pro-preview';
    thinkingConfig = { thinkingBudget: 32768 };
    
    // INJECT STRICT CONCISE INSTRUCTION FOR THINKING MODE
    finalSystemInstruction += `
    
    IMPORTANT OVERRIDE FOR THINKING MODE:
    You are in a deep-reasoning mode. Use your thinking capacity to ensure accuracy, but your FINAL OUTPUT must be:
    - CONCISE and COMPRESSED.
    - STRIPPED of fluff, filler, and long preambles.
    - Focused purely on the core solution/explanation.
    - Do NOT summarize your thinking process; just give the result.
    `;
  } 
  // Priority 3: Fast Mode
  else if (options.mode === 'fast') {
    targetModel = 'gemini-2.5-flash-lite';
  }

  const newConfig: any = {
    systemInstruction: finalSystemInstruction,
    temperature: temperature,
  };
  
  if (thinkingConfig) {
      newConfig.thinkingConfig = thinkingConfig;
  }

  // Check if we need to recreate session
  // We recreate if the effective mode has changed, which implies model or config changes
  const shouldRecreate = effectiveMode !== lastUsedMode;

  if (shouldRecreate) {
    try {
      const history = await chatSession.getHistory();
      chatSession = ai.chats.create({
        model: targetModel,
        config: newConfig,
        history: history
      });
      currentModel = targetModel;
      lastUsedMode = effectiveMode;
    } catch (e) {
      console.error("Failed to switch model/config", e);
    }
  }

  try {
    let result;
    if (options.image) {
        // Multipart message
        const parts: any[] = [{ text: message }];
        let cleanBase64 = options.image;
        let mimeType = 'image/jpeg';
        if (options.image.includes(';base64,')) {
            const split = options.image.split(';base64,');
            mimeType = split[0].replace('data:', '');
            cleanBase64 = split[1];
        }

        parts.push({
            inlineData: {
                data: cleanBase64,
                mimeType: mimeType
            }
        });

        result = await chatSession.sendMessageStream({ message: parts as any }); 
    } else {
        result = await chatSession.sendMessageStream({ message });
    }

    for await (const chunk of result) {
      const c = chunk as GenerateContentResponse;
      if (c.text) {
        yield c.text;
      }
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const streamInitialConversation = async function* (config: SessionConfig) {
    if (!chatSession) {
        throw new Error("Chat session not initialized");
    }

    let startMessage = "";
    if (config.mode === 'learn') {
        startMessage = `I am starting the chapter "${config.chapter}".
        
        Act as the NCERT Master Tutor.
        Step 1: Provide the 1️⃣ CHAPTER OVERVIEW (Hook & Goal) and the 2️⃣ CONCEPT DEPENDENCY TREE (Levels 0-4).
        Step 2: Pause and ask me if I am ready to start Level 0.
        
        Do not teach any concepts yet. Just set the stage.`;
    } else if (config.mode === 'revise') {
        startMessage = `I want to revise "${config.chapter}". Start REVISION MODE. Ask me which concepts are weak, or offer a rapid-fire quiz to find my gaps.`;
    } else {
        startMessage = `I have a doubt in "${config.chapter}". Start DOUBT SOLVER MODE. Ask me specifically what part of the chapter is confusing me.`;
    }

    try {
        const result = await chatSession.sendMessageStream({ message: startMessage });
        for await (const chunk of result) {
            const c = chunk as GenerateContentResponse;
            if (c.text) {
              yield c.text;
            }
        }
    } catch (error) {
         console.error("Gemini Initial Error:", error);
         throw error;
    }
}