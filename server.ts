import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { connectDB, User, Conversation, hashPassword } from "./db";

dotenv.config();

async function startServer() {
  await connectDB();
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
      }
      
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ error: "This email is already registered." });
      }

      const newUser = new User({ email, password });
      await newUser.save();
      
      res.json({ success: true, email: newUser.email });
    } catch (e: any) {
      console.error("Signup error:", e);
      res.status(500).json({ error: e.message || "An error occurred during registration." });
    }
  });

  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
      }

      const lowerEmail = email.toLowerCase();
      // Special check to auto-create default workspace users if they don't exist yet
      if (lowerEmail === "developer@xcode.dev" || lowerEmail === "admin@xcode.dev" || email === "developer") {
        let user = await User.findOne({ email: lowerEmail });
        if (!user) {
          user = new User({ email: lowerEmail, password: password });
          await user.save();
        }
      }

      const user = await User.findOne({ email: lowerEmail });
      if (!user) {
        return res.status(400).json({ error: "Account not found." });
      }

      const isMatch = user.password === hashPassword(password);
      if (!isMatch) {
        return res.status(400).json({ error: "Incorrect password entered." });
      }

      res.json({ success: true, email: user.email });
    } catch (e: any) {
      console.error("Signin error:", e);
      res.status(500).json({ error: e.message || "An error occurred during authentication." });
    }
  });

  app.get("/api/conversations", async (req, res) => {
    try {
      const { email } = req.query;
      if (!email) {
        return res.status(400).json({ error: "User email parameter is required." });
      }

      const conversations = await Conversation.find({ email: (email as string).toLowerCase() })
        .sort({ timestamp: -1 });
      
      res.json(conversations);
    } catch (e: any) {
      console.error("Get conversations error:", e);
      res.status(500).json({ error: e.message || "Failed to retrieve conversations." });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const { email, conversation } = req.body;
      if (!email || !conversation || !conversation.id) {
        return res.status(400).json({ error: "Email and conversation object with ID are required." });
      }

      const lowerEmail = email.toLowerCase();
      
      // Upsert conversation
      const updated = await Conversation.findOneAndUpdate(
        { id: conversation.id, email: lowerEmail },
        {
          id: conversation.id,
          email: lowerEmail,
          title: conversation.title,
          timestamp: conversation.timestamp || Date.now(),
          messages: conversation.messages || []
        },
        { upsert: true, new: true }
      );

      res.json(updated);
    } catch (e: any) {
      console.error("Save conversation error:", e);
      res.status(500).json({ error: e.message || "Failed to save conversation." });
    }
  });

  app.delete("/api/conversations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { email } = req.query;
      if (!email || !id) {
        return res.status(400).json({ error: "Email and conversation ID are required." });
      }

      await Conversation.deleteOne({ id, email: (email as string).toLowerCase() });
      res.json({ success: true });
    } catch (e: any) {
      console.error("Delete conversation error:", e);
      res.status(500).json({ error: e.message || "Failed to delete conversation." });
    }
  });
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, mode, apiKey, model } = req.body;
      const finalApiKey = (apiKey || process.env.GEMINI_API_KEY || "").trim();
      
      if (!finalApiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required or must be provided in the request");
      }

      // Map version descriptor to actual Gemini API model reference
      let geminiModelName = "gemini-2.5-flash"; 
      if (model === "v1.1") {
        geminiModelName = "gemini-2.5-pro";
      } else if (model === "Beta") {
        geminiModelName = "gemini-2.5-flash"; // fall back to standard flash for fast beta responses
      }

      const ai = new GoogleGenAI({ 
        apiKey: finalApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      let systemInstruction = "You are Xcode Agent, an expert AI assistant. Always respond with clear, beautifully structured markdown formatting. Make extensive use of bullet points, lists, code blocks, bold text, and tables where appropriate to present information clearly and aesthetically. Code blocks must always have a language identifier (e.g., ```python, ```typescript, etc.) after the triple backticks so they can be syntax highlighted correctly.";
      if (mode === "plan") {
        systemInstruction += " Focus dynamically on outlining rigorous step-by-step plans, tables, list items, and architectural designs before writing code.";
      } else if (mode === "code") {
        systemInstruction += " Show the code clearly formatted in code blocks and minimize introductory conversational prose.";
      }

      const formattedMessages = messages.map((m: any) => m.content).join("\n\n");

      // Set headers for Server-Sent Events (SSE)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      // Robust exponential backoff retry for transient 503/UNAVAILABLE or 429 errors, plus robust fallbacks
      let retries = 4;
      let delay = 1000;
      let responseStream;
      let hasFallbackNotice = false;
      
      for (let i = 0; i < retries; i++) {
        try {
          responseStream = await ai.models.generateContentStream({
            model: geminiModelName,
            contents: formattedMessages,
            config: {
              systemInstruction,
            }
          });
          break; // success
        } catch (error: any) {
          const errMsg = (error.message || "").toLowerCase();
          
          // Check for 401/403 or unauthenticated or model restriction or quota exceeded errors
          const isModelRestrictedOrExhausted = 
            errMsg.includes("permission") || 
            errMsg.includes("unauthenticated") || 
            errMsg.includes("unauthorized") ||
            errMsg.includes("not allowed") || 
            errMsg.includes("not enabled") || 
            errMsg.includes("credentials") || 
            errMsg.includes("quota") || 
            errMsg.includes("exhausted") || 
            errMsg.includes("limit") || 
            error.status === 403 ||
            error.status === 401 ||
            error.status === 429;

          if (isModelRestrictedOrExhausted && geminiModelName !== "gemini-2.5-flash") {
            console.warn(`Model ${geminiModelName} failed with restriction/quota. Falling back to gemini-2.5-flash.`);
            geminiModelName = "gemini-2.5-flash";
            hasFallbackNotice = true;
            // Retry immediately on the fallback model
            i--; // don't count this as a transient load retry
            continue;
          }

          const isRetryable = 
            errMsg.includes("503") || 
            errMsg.includes("unavailable") || 
            errMsg.includes("overloaded") || 
            errMsg.includes("rate") ||
            errMsg.includes("429") ||
            error.status === 503 ||
            error.status === 429;

          if (isRetryable && i < retries - 1) {
            console.warn(`Gemini API returned retryable error (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 1.5;
          } else {
            throw error;
          }
        }
      }

      if (!responseStream) {
        throw new Error("Failed to initialize stream response.");
      }

      if (hasFallbackNotice) {
        res.write(`data: ${JSON.stringify({ text: "\n\n*[Notice: Falling back to Xcode Agent v1.0 (Gemini 2.5 Flash Engine) because the selected engine required a billing-enabled key or is currently rate-limited/restricted.]*\n\n" })}\n\n`);
      }

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (e: any) {
      console.error("Gemini API Error:", e);
      const is503 = e.message?.includes("503") || e.message?.includes("UNAVAILABLE");
      const errMsg = (e.message || "").toLowerCase();
      let clientMessage = e.message || "An error occurred during content generation.";

      if (errMsg.includes("401") || errMsg.includes("unauthenticated") || errMsg.includes("credentials") || errMsg.includes("api key") || e.status === 401) {
        clientMessage = "Your Gemini API Key is invalid or unauthorized. Please check that you entered a valid key in the bottom-left Settings panel.";
      } else if (errMsg.includes("quota") || errMsg.includes("exhausted") || errMsg.includes("limit") || e.status === 429) {
        clientMessage = "You have exceeded your Gemini API free-tier rate limits or daily quota. Please wait a minute before retrying, or configure your own API Key in the bottom-left Settings panel to get dedicated quota.";
      } else if (is503) {
        clientMessage = "The AI model is currently under heavy load (503 Service Unavailable). Please click 'Send' again in a few moments, or check/re-enter your Gemini API Key in the Settings.";
      }

      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: clientMessage })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: clientMessage });
      }
    }
  });

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
