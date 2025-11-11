// UPGRADED AI "Brain" with multi-source verification - RENDER COMPATIBLE
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Gemini AI Setup ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

// --- UPGRADED PROFESSIONAL FACT-CHECKING PROMPT ---
const systemPrompt = `
You are an EXPERT fact-checking analyst. Your job is to verify claims with REAL-TIME SEARCH.

CRITICAL INSTRUCTIONS:
1. **ALWAYS USE SEARCH TOOLS** - You MUST search for every significant claim
2. **VERIFY WITH MULTIPLE SOURCES** - Cross-reference at least 2-3 credible sources
3. **CHECK DATES** - Ensure information is current (today is ${new Date().toLocaleDateString()})
4. **IDENTIFY MANIPULATION** - Look for altered images, fake quotes, misleading context
5. **BE SPECIFIC** - Name the sources you found (e.g., "Reuters", "AP News", "CDC")

ANALYSIS PROCESS:
Step 1: Extract all factual claims from the text
Step 2: Search for EACH claim using your search tools
Step 3: Compare claims against search results from credible sources
Step 4: Determine verdict based on evidence found

SCORING CRITERIA:
- **9-10**: Verified TRUE by multiple authoritative sources (WHO, Reuters, AP, .gov sites)
- **7-8**: Mostly accurate with minor issues or from credible but single source
- **5-6**: Partially true but missing context, or unverifiable claims
- **3-4**: Misleading, lacks evidence, or mixes truth with falsehoods
- **0-2**: Proven FALSE by authoritative sources, known hoax, or manipulated content

RISK CATEGORIES:
- "Trustworthy" (7-10): Claims verified by credible sources
- "Medium Risk" (4-6): Unverified, lacks sources, or questionable claims
- "High Risk" (0-3): False information, hoax, or debunked by fact-checkers

OUTPUT FORMAT (JSON only, no markdown):
{
  "score": <number 0-10>,
  "risk": "<High Risk|Medium Risk|Trustworthy>",
  "summary": "<2-3 sentence explanation citing specific sources found>",
  "sources": ["<source1>", "<source2>"],
  "claimsChecked": <number of claims verified>
}

Example good summary: "FALSE. Search results from Snopes and Reuters confirm this is a debunked hoax from 2019. No credible medical sources support this claim."

Example bad summary: "This seems false." (too vague, no sources cited)

ALWAYS cite what you found in your search. If you found nothing, state that clearly.
`;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0',
    aiModel: 'gemini-2.0-flash-exp'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Fact-Checker AI Server Running',
    endpoints: {
      health: '/health',
      analyze: '/analyze (POST)'
    }
  });
});

// --- Enhanced API Endpoint with Better Error Handling ---
app.post('/analyze', async (req, res) => {
  try {
    const { text } = req.body;

    // Validation
    if (!text || text.length < 50) {
      return res.json({ 
        error: 'Post too short',
        score: 5,
        risk: 'Medium Risk',
        summary: 'Post too short for meaningful fact-check.',
        sources: [],
        claimsChecked: 0
      });
    }

    // Check API key
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not found in environment variables');
      return res.status(500).json({
        error: 'API key not configured',
        score: 5,
        risk: 'Medium Risk',
        summary: 'Server configuration error. Contact administrator.',
        sources: [],
        claimsChecked: 0
      });
    }

    // Limit text but keep important context
    const truncatedText = text.substring(0, 5000);

    console.log('📝 Analyzing post (length:', truncatedText.length, 'chars)');

    // --- UPGRADED API CALL ---
    const result = await model.generateContent({
      contents: [{
        parts: [{ text: `Fact-check this post:\n\n${truncatedText}` }],
        role: "user"
      }],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
        role: "system"
      },
      // Enable Google Search
      tools: [{
        googleSearch: {}
      }],
      // Force JSON output with strict schema
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            "score": { "type": "NUMBER" },
            "risk": { "type": "STRING" },
            "summary": { "type": "STRING" },
            "sources": { 
              "type": "ARRAY",
              "items": { "type": "STRING" }
            },
            "claimsChecked": { "type": "NUMBER" }
          },
          required: ["score", "risk", "summary", "sources", "claimsChecked"]
        }
      }
    });

    const response = result.response;
    let jsonResponse = JSON.parse(response.text());

    // Validation and defaults
    jsonResponse.score = Math.min(10, Math.max(0, jsonResponse.score || 5));
    jsonResponse.sources = jsonResponse.sources || [];
    jsonResponse.claimsChecked = jsonResponse.claimsChecked || 0;

    // Log for debugging
    console.log(`✅ Analysis: ${jsonResponse.risk} (${jsonResponse.score}/10)`);
    if (jsonResponse.sources.length > 0) {
      console.log(`📚 Sources: ${jsonResponse.sources.join(', ')}`);
    }

    res.json(jsonResponse);

  } catch (error) {
    console.error('❌ Error processing request:', error.message);
    res.status(500).json({ 
      error: 'Analysis failed',
      score: 5,
      risk: 'Medium Risk',
      summary: 'Could not complete fact-check. Server error occurred.',
      sources: [],
      claimsChecked: 0
    });
  }
});

app.listen(port, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🛡️  FACT-CHECKER SERVER RUNNING     ║
╚════════════════════════════════════════╝

📡 Port: ${port}
🔍 Google Search: ENABLED
🤖 Model: gemini-2.0-flash-exp
⚡ Ready for requests!

Test endpoints:
- GET  ${process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + port}/health
- POST ${process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + port}/analyze
  `);
});