const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  // 1. The core interaction
  userQuery: { 
    type: String, 
    required: true,
    trim: true 
  },
  aiResponse: { 
    type: String, 
    required: true 
  },

  // 2. RAG Specific: Store the "Evidence"
  // This saves the titles/IDs of the poses Pinecone found
  retrievedContext: [
    {
      poseId: { type: String },
      title: { type: String }
    }
  ],

  // 3. Safety Monitoring
  // Tracks if the query triggered your yoga safety keywords
  isUnsafe: { 
    type: Boolean, 
    default: false 
  },
  safetyFlags: [
    { type: String } // e.g., ["pregnant", "glaucoma"]
  ],

  // 4. Metadata
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  // Automatically adds createdAt and updatedAt fields
  timestamps: true 
});

// Export the model so server.js can use it
module.exports = mongoose.model('Log', LogSchema);