// server/controllers/chatboat.controller.js
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

let conversationHistory = [
  { role: "system", content: "Give short, concise answers" }
];

export const chatboat = async (req, res) => {
  const userMessage = req.body?.message;

  if (!userMessage || typeof userMessage !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'message' in request body" });
  }

  conversationHistory.push({ role: "user", content: userMessage });

  try {
    // Read API key from env (do NOT hardcode)
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GEMINIAI_API ||
      process.env.GENAI_API_KEY ||
      global?.GEMINIAI_API; // last-resort fallback (not recommended)

    if (!apiKey) {
      console.error("GEMINI API key not found in environment variables.");
      return res.status(500).json({ error: "Server missing GEMINI API key (set GEMINI_API_KEY)" });
    }

    // Initialize client (try both common shapes)
    let genAI;
    try {
      genAI = new GoogleGenerativeAI({ apiKey });
    } catch (e1) {
      try {
        genAI = new GoogleGenerativeAI(apiKey);
      } catch (e2) {
        console.error("Failed to initialize GoogleGenerativeAI client", e1, e2);
        return res.status(500).json({ error: "Failed to initialize generative AI client" });
      }
    }

    // Pick model name (change if your account requires a different model id)
    const modelName = "gemini-pro";
    const model = genAI.getGenerativeModel({ model: modelName });

    // Prompt with explicit brevity instruction
    const prompt = `Respond very briefly (1-2 lines): ${userMessage}`;

    // Call generateContent; try robust payload shapes
    let result;
    try {
      result = await model.generateContent({
        contents: [{ type: "text", text: prompt }]
      });
    } catch (err1) {
      try {
        result = await model.generateContent(prompt);
      } catch (err2) {
        console.error("generateContent failed for both payload shapes:", err1, err2);
        throw err2;
      }
    }

    // Debug: log raw result shape (server console)
    console.log("raw generateContent result:", JSON.stringify(result, null, 2));

    // Extract text from several possible SDK response shapes
    let botText = "";

    if (typeof result === "string") {
      botText = result;
    } else if (typeof result?.text === "string") {
      botText = result.text;
    } else if (Array.isArray(result?.output) && result.output[0]?.content?.[0]?.text) {
      botText = result.output[0].content[0].text;
    } else if (Array.isArray(result?.responses) && result.responses[0]?.text) {
      botText = result.responses[0].text;
    } else if (Array.isArray(result?.candidates) && typeof result.candidates[0]?.content === "string") {
      botText = result.candidates[0].content;
    } else if (Array.isArray(result?.outputs) && result.outputs[0]?.text) {
      botText = result.outputs[0].text;
    } else if (result?.response?.text) {
      botText = result.response.text;
    } else if (result?.response && typeof result.response === "string") {
      botText = result.response;
    } else if (typeof result === "object") {
      // Last-resort fallback: stringify a portion for debugging
      const str = JSON.stringify(result);
      botText = str.length > 2000 ? str.slice(0, 2000) : str;
    } else {
      botText = String(result || "");
    }

    const formattedBotResponse = formatResponse(botText);

    conversationHistory.push({ role: "assistant", content: formattedBotResponse });

    return res.status(200).json({ message: formattedBotResponse });
  } catch (error) {
    console.error("chatboat error:", error);
    const detail =
      (error?.response && (error.response.data || error.response)) ||
      error?.message ||
      "Unknown server error";
    return res.status(500).json({ error: "Failed to generate response", detail });
  }
};

function formatResponse(response) {
  if (!response || typeof response !== "string") return "";
  return response.replace(/\*(.*?)\*/g, "$1").trim();
}
