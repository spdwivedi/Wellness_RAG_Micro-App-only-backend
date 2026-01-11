const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');
const Log = require('./models/Log');

const app = express();
app.use(express.json());
app.use(cors());

// --- CONFIGURATION ---
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// 1. MODEL STRATEGY: "Cutting Edge -> High Speed -> Reliable Stable"
// The code will try these in order. If one fails/timeouts, it moves to the next.
const modelsToTry = [
    "gemini-2.5-flash",      // 🌟 PRIMARY: The newest model you see in AI Studio
    "gemini-2.0-flash-exp",  // 🚀 BACKUP 1: High-speed experimental
    "gemini-1.5-flash"       // 🛡️ BACKUP 2: Rock-solid stability
];

const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index('yoga-gemini');

mongoose.connect(process.env.MONGO_URI).then(() => console.log("🍃 MongoDB Connected"));

// --- CUSTOM SAFETY KEYWORDS ---
const UNSAFE_KEYWORDS = ["pregnant", "trimester", "surgery", "hernia", "glaucoma", "blood pressure", "fracture", "pain", "injury"];

// --- HELPER FUNCTION: SMART FALLBACK ---
async function generateWithFallback(systemInstruction, fullPrompt) {
  for (const modelName of modelsToTry) {
    try {
      console.log(`🤖 Requesting via: ${modelName}...`);
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        safetySettings: [
             { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
             { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
        ]
      });

      const result = await model.generateContent([
        { role: "user", parts: [{ text: systemInstruction + "\n\n" + fullPrompt }] }
      ]);
      
      return result.response.text(); // Success! Return immediately.
      
    } catch (error) {
      console.warn(`⚠️ ${modelName} failed or is meditating. Error: ${error.message}`);
      console.warn(`🔄 Switching to next backup model...`);
      // Loop continues to the next model automatically
    }
  }
  throw new Error("All AI Gurus (2.5, 2.0, and 1.5) are currently meditating. Please try again later.");
}

app.post('/ask', async (req, res) => {
  try {
    const { query } = req.body;
    let isUnsafe = false;
    let safetyFlags = [];

    // 1. Keyword Safety Check
    const lowerQuery = query.toLowerCase();
    UNSAFE_KEYWORDS.forEach(word => {
      if (lowerQuery.includes(word)) {
        isUnsafe = true;
        safetyFlags.push(word);
      }
    });

    // 2. Embed User Query (Gemini)
    const result = await embeddingModel.embedContent(query);
    const vector = result.embedding.values;

    // 3. Search Vector DB
    const queryResponse = await index.query({
      vector: vector,
      topK: 3,
      includeMetadata: true,
    });

    const context = queryResponse.matches.map(m => m.metadata.text).join("\n\n");
    const sources = queryResponse.matches.map(m => ({ title: m.metadata.title, id: m.id }));

    // 4. Construct Prompt
    let systemInstruction = `You are "YogiAI", an empathetic, professional yoga therapist. 
    Use the following context to answer the user's question.
    Tone: Calm, encouraging, and clear.
    Structure: Use bullet points for steps.
    Safety: If the context mentions contraindications, you MUST state them clearly.`;

    if (isUnsafe) {
      systemInstruction += `\n\n🚨 CRITICAL SAFETY MODE: The user mentioned high-risk keywords (${safetyFlags.join(", ")}). 
      1. Start with a bold disclaimer: "Please consult a doctor before proceeding."
      2. Do NOT recommend inversions or intense heat.
      3. Suggest ONLY gentle breathing or restorative poses.`;
    }

    const fullPrompt = `Context:\n${context}\n\nUser Question:\n${query}`;

    // 5. Generate Answer (Using The 3-Model Fallback)
    const answer = await generateWithFallback(systemInstruction, fullPrompt);

    // 6. Log to MongoDB
    await Log.create({ userQuery: query, aiResponse: answer, retrievedContext: sources, isUnsafe, safetyFlags });

    res.json({ answer, sources, isUnsafe, safetyFlags });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: "Mental Block! (Server Error)" });
  }
});

app.listen(5000, () => console.log("🚀 Server running on port 5000"));
