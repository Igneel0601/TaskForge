import { NextResponse } from 'next/server';

type AssistRequest = {
  cardId?: string;
  cardName?: string;  // ✅ ADD THIS
  content?: string;
  columns?: any[];
  cards?: any[];
};

// ✅ Safe JSON parser (never crashes)
function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

// ✅ Stable Gemini call
async function callGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  // ✅ LOCKED TO STABLE MODEL
  const model = 'gemini-2.5-flash';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: prompt }] }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,  // ✅ Increased for longer responses
        responseModalities: ["TEXT"]  // ✅ Force text-only output
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini API Error: ${await res.text()}`);
  }

  const json = await res.json();
  
  // ✅ Better error logging
  if (!json?.candidates?.[0]?.content?.parts?.[0]?.text) {
    console.error('FULL GEMINI RESPONSE:', JSON.stringify(json, null, 2));
    
    // Check if it hit MAX_TOKENS
    if (json?.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      throw new Error('Gemini response exceeded token limit. Try a shorter task description.');
    }
    
    throw new Error(`Empty Gemini response: ${json?.candidates?.[0]?.finishReason || 'Unknown reason'}`);
  }

  const text = json.candidates[0].content.parts[0].text;
  return text;
}

// ✅ Main API route
export async function POST(req: Request) {
  try {
    const { cardId, cardName, content, columns, cards } =
      (await req.json()) as AssistRequest;

    // allow empty content: AI should create a description when none exists
    const hasContent = typeof content === 'string' && content.trim().length > 0;

    // ✅ FALLBACK: Use cardName from payload OR find from cards array
    const targetCard =
      (cards || []).find((c) => c.id === cardId) || null;

    const finalCardName = cardName || targetCard?.name || 'Unknown Task';

    const targetColumn = targetCard
      ? (columns || []).find((col) => col.id === targetCard.columnId)
      : null;

    // ✅ OPTIMIZED PROMPT - Strict limits
    const prompt = `
You are a technical project assistant. Return ONLY valid JSON, no markdown.

Task Name: "${finalCardName}"
Status: "${targetColumn?.name || 'Unknown'}"

${hasContent ? `Current Description:\n${content}\n\nTask: Improve and condense this description to 250 words maximum.` : 'Task: Create a comprehensive, actionable description.'}

CRITICAL REQUIREMENTS:
- "improved": HTML description with MAXIMUM 250 words (count strictly enforced). Be concise yet informative.
- "checklist": EXACTLY 2 actionable checklist items (bullet points)
- "tests": EXACTLY 2 specific test cases (bullet points)
- "estimate": Realistic time estimate (e.g., "2-4 hours", "1-2 days")

LIMITS ENFORCED:
- Description: MAX 250 words
- Checklist: EXACTLY 2 items
- Tests: EXACTLY 2 items

Return JSON format:
{
  "improved": "<p>concise description (max 250 words)...</p>",
  "checklist": ["item 1", "item 2"],
  "tests": ["test 1", "test 2"],
  "estimate": "X hours/days"
}
    `.trim();

    let assistantOutput: string;

    try {
      assistantOutput = await callGemini(prompt);
    } catch (err) {
      console.error('Gemini call failed:', err);
      assistantOutput = JSON.stringify({
        improved: content || `<p>Task: ${finalCardName}</p>`,
        checklist: [],
        tests: [],
        estimate: ''
      });
    }

    // ✅ SAFE PARSE (NEVER CRASHES)
    const parsed =
      safeJsonParse(assistantOutput) || {
        improved: content || `<p>Task: ${finalCardName}</p>`,
        checklist: [],
        tests: [],
        estimate: ''
      };

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}