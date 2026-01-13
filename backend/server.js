const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');
const Log = require('./models/Log');

const app = express();

// --- 1. CRITICAL: INCREASE UPLOAD LIMIT FOR AUDIO ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// --- CONFIGURATION ---
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// UPDATED MODEL STRATEGY (Based on your available quotas)
// We cycle through every available model to maximize your free daily requests.
const modelsToTry = [
    "gemini-2.5-flash-lite", // 🚀 Active (Usage: 1/20) - Fast & cheap
    "gemini-3-flash",        // 🆕 Active (Usage: 0/20) - Balanced 3.0 model
    "gemini-2.5-flash",      // ⚡ Active (Usage: 0/20) - Standard fast model
    "gemma-3-27b",           // 🧠 Gemma 3 (Large) - High intelligence backup
    "gemma-3-12b",           // 🛡️ Gemma 3 (Medium) - Good balance
    "gemma-3-4b",            // 🏎️ Gemma 3 (Small) - Fast
    "gemma-3-2b",            // 🏎️ Gemma 3 (Tiny) - Very Fast
    "gemma-3-1b"             // 🏎️ Gemma 3 (Nano) - Ultra Fast
];

const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index('yoga-gemini');

mongoose.connect(process.env.MONGO_URI).then(() => console.log("🍃 MongoDB Connected"));

const UNSAFE_KEYWORDS = ["pregnant", "trimester", "surgery", "hernia", "glaucoma", "blood pressure", "fracture", "pain", "injury"];

// --- HELPER: SMART FALLBACK (TEXT + AUDIO SUPPORT) ---
async function generateWithFallback(systemInstruction, chatHistory, currentQuery, audioBase64 = null) {
  
  let userContent = [];
  
  // A. Handle Audio Payload
  if (audioBase64) {
      userContent.push({
          inlineData: {
              mimeType: "audio/m4a",
              data: audioBase64
          }
      });
      userContent.push({ text: "Listen to this audio request. " + systemInstruction });
  } else {
      // B. Handle Text Payload
      let fullConversation = systemInstruction + "\n\n";
      
      // Add Chat History (Safely)
      if (Array.isArray(chatHistory) && chatHistory.length > 0) {
          chatHistory.slice(-3).forEach(msg => {
              if (msg.role && msg.text) {
                  fullConversation += `${msg.role === 'user' ? 'User' : 'YogiAI'}: ${msg.text}\n`;
              }
          });
      }
      
      // Ensure query is never empty (Prevents "User content must not be empty" error)
      const safeQuery = currentQuery || "Hello";
      fullConversation += `User: ${safeQuery}\nYogiAI:`;
      userContent.push({ text: fullConversation });
  }

  // C. Try Models Loop
  for (const modelName of modelsToTry) {
    try {
      // console.log(`🤖 Requesting via: ${modelName}...`); 
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        safetySettings: [
             { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ]
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: userContent }]
      });
      
      return result.response.text(); 
      
    } catch (error) {
      console.warn(`⚠️ ${modelName} failed: ${error.message}`);
      // If it's the last model and it failed, throw error to stop loop
      if (modelName === modelsToTry[modelsToTry.length - 1]) throw error;
    }
  }
}

app.post('/ask', async (req, res) => {
  // DEBUG LOGS
  console.log("📩 Request received!");
  if (req.body.audio) console.log("🎤 Audio data present (Size: " + req.body.audio.length + ")");
  if (req.body.query) console.log("📝 Text Query:", req.body.query);

  try {
    const { query, history, audio } = req.body; 
    let isUnsafe = false;
    let safetyFlags = [];
    let textToAnalyze = query || "";
    let context = "";
    let sources = [];

    // 1. Keyword Safety Check (Skip if pure audio)
    if (textToAnalyze && textToAnalyze !== "🎤 Voice Query") {
        const lowerQuery = textToAnalyze.toLowerCase();
        UNSAFE_KEYWORDS.forEach(word => {
          if (lowerQuery.includes(word)) {
            isUnsafe = true;
            safetyFlags.push(word);
          }
        });
    }

    // 2. RAG Retrieval (PROTECTED BLOCK)
    // Wrapped in try/catch so Vector DB issues don't crash the whole app
    if (textToAnalyze && textToAnalyze !== "🎤 Voice Query") {
        try {
            const result = await embeddingModel.embedContent(textToAnalyze);
            const vector = result.embedding.values;
            const queryResponse = await index.query({ vector: vector, topK: 2, includeMetadata: true });
            
            if (queryResponse && queryResponse.matches) {
                context = queryResponse.matches.map(m => m.metadata.text).join("\n\n");
                sources = queryResponse.matches.map(m => ({ title: m.metadata.title, id: m.id }));
            }
        } catch (ragError) {
            console.error("⚠️ Retrieval Error (Ignoring):", ragError.message);
        }
    }

    // 3. System Prompt
    let systemInstruction = `You are "YogiAI".
    RULES:
    1. **Language**: Detect language. Reply in same.
    2. **Yoga Flows**: If asked for a routine, format as **Step 1:**, **Step 2:**...
    3. **Brevity**: Under 150 words.
    4. **Context**: Use this context if available: ${context}`;

    if (isUnsafe) {
      systemInstruction += `\n\n🚨 CRITICAL SAFETY: User mentioned risky terms. Suggest ONLY gentle breathing.`;
    }

    // 4. Generate Answer
    const answer = await generateWithFallback(systemInstruction, history, query, audio);

    // 5. Log to DB (Protected)
    try {
        await Log.create({ 
            userQuery: query || "[Audio Request]", 
            aiResponse: answer, 
            retrievedContext: sources, 
            isUnsafe, 
            safetyFlags 
        });
    } catch (logError) {
        console.error("⚠️ Logging Error:", logError.message);
    }

    res.json({ answer, sources, isUnsafe, safetyFlags });

  } catch (error) {
    console.error("❌ CRITICAL SERVER ERROR:", error);
    // Send a real error message back so frontend knows what happened
    res.status(500).json({ error: "YogiAI is taking a deep breath (Server Busy). Please try again." });
  }
});

app.listen(5000, () => console.log("🚀 Server running on port 5000"));