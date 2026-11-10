import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";

// Primary: Gemini (Prone to free-tier exhaustion)
const gemini = new ChatGoogleGenerativeAI({
  modelName: "gemini-1.5-flash",
  maxRetries: 1,
});

// Fallback: Groq (Llama 3 for deterministic, fast fallback)
const groq = new ChatGroq({
  modelName: "llama3-8b-8192",
  maxRetries: 1,
});

// Export robust chain: Automatically drops to Groq if Gemini fails
export const getRobustLLM = () => gemini.withFallbacks({ fallbacks: [groq] });
