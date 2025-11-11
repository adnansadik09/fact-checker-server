// AI Fact-Checker Server - Railway Compatible
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

// System prompt for fact-checking
const systemPrompt = `You are an EXPERT fact-checking analyst with access to real-time Google Search.

YOUR MISSION:
1. Use Google Search to verify EVERY factual claim
2. Cross-reference multiple authoritative sources
3. Check current dates and context
4. Identify misinformation, fake news, and manipulation

SCORING GUIDE:
- 9-10: Verified TRUE by multiple credible sources (Reuters, AP, WHO, .gov)
- 7-8: Mostly accurate, credible single source
- 5-6: Partially true, missing context, or unverifiable
- 3-4: Misleading or lacks evidence
- 0-2: Proven FALSE by fact-checkers, known hoax

RISK LEVELS:
- "Trustworthy" (7-10): Verified information
- "Medium Risk" (4-6): Unverified or questionable
- "High Risk" (0-3): False information or hoax

OUTPUT (JSON only):
{
  "score": <0-10>,
  "risk": "<High Risk|Medium Risk|Trustworthy>",
  "summary": "<2-3 sentences citing specific sources>",
  "sources": ["<source1>", "<source2>"],
  "claimsChecked": <number>
}

Example: "FALSE. Snopes and Reuters confirm this is a debunked 2019 hoax. No medical sources support this claim."

Always cite what you found. If nothing found, state clearly.`;

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Fact-Checker AI Server',
    status: 'running',
    version: '2.0',
    endpoints: {
      health: 'GET /',
      analyze: 'POST /analyze'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    model: 'gemini-2.0-flash-exp'
  });
});

// Main analysis endpoint
app.post('/analyze', async (req, res) => {
  try {
    const { text } = req.body;

    // Validate input
    if (!text || typeof text !== 'string' || text.length < 50) {
      return res.json({
        score: 5,
        risk: 'Medium Risk',
        summary: 'Post too short for meaningful analysis.',
        sources: [],
        claimsChecked: 0
      });
    }

    // Check API key
    if (!process.env.GEMINI_API_KEY) {
      console.error('Missing GEMINI_API_KEY');
      return res.status(500).json({
        error: 'Server configuration error',
        score: 5,
        risk: 'Medium Risk',
        summary: 'Server not properly configured.',
        sources: [],
        claimsChecked: 0
      });
    }

    // Truncate text
    const truncatedText = text.substring(0, 5000);
    console.log(`📝 Analyzing ${truncatedText.length} chars...`);

    // Call Gemini with Google Search
    const result = await model.generateContent({
      contents: [{
        parts: [{ text: `Fact-check this:\n\n${truncatedText}` }],
        role: 'user'
      }],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
        role: 'system'
      },
      tools: [{ googleSearch: {} }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            score: { type: 'NUMBER' },
            risk: { type: 'STRING' },
            summary: { type: 'STRING' },
            sources: {
              type: 'ARRAY',
              items: { type: 'STRING' }
            },
            claimsChecked: { type: 'NUMBER' }
          },
          required: ['score', 'risk', 'summary', 'sources', 'claimsChecked']
        }
      }
    });

    // Parse response
    const response = result.response;
    let analysis = JSON.parse(response.text());

    // Validate
    analysis.score = Math.min(10, Math.max(0, analysis.score || 5));
    analysis.sources = analysis.sources || [];
    analysis.claimsChecked = analysis.claimsChecked || 0;

    console.log(`✅ ${analysis.risk} (${analysis.score}/10) - ${analysis.sources.length} sources`);

    res.json(analysis);

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      error: 'Analysis failed',
      score: 5,
      risk: 'Medium Risk',
      summary: 'Could not complete fact-check due to server error.',
      sources: [],
      claimsChecked: 0
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🛡️  FACT-CHECKER SERVER ONLINE      ║
╚════════════════════════════════════════╝

📡 Port: ${port}
🔍 Google Search: ENABLED
🤖 Model: gemini-2.0-flash-exp
⚡ Ready!
  `);
});
