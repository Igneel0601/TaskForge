import { NextResponse } from "next/server";

type Column = {
  id?: string;
  name?: string;
};

type Card = {
  id?: string;
  title?: string;
  columnId?: string;
  description?: string;
};

// ✅ Gemini Call (Only Text Output)
async function callGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";

  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const json = await res.json();
  let text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  // Clean up any markdown artifacts
  text = text.replace(/```[\s\S]*?```/g, "");
  text = text.trim();
  
  return text;
}

// ✅ Local summary fallback (NO AI)
function localSummarize(
  columns: Column[],
  cards: Card[],
  boardId: string,
  counts: Record<string, number>
) {
  const total = cards.length;
  const topTasks = cards
    .slice(0, 5)
    .map((c) => c.title || c.id || "Untitled")
    .map((title, i) => `• ${title}`)
    .join("\n");

  return `Board Overview:
This board (${boardId}) currently contains ${total} tasks across ${columns.length} columns. The project is in active development with tasks distributed across multiple workflow stages.

Task Distribution:
${Object.entries(counts)
  .map(([k, v]) => `• ${k}: ${v} tasks`)
  .join("\n")}

Key Focus Tasks:
${topTasks || "• No major tasks identified yet"}

Suggestions:
• Start moving top backlog items into progress
• Review done tasks to ensure closure
• Maintain consistent updates across columns
• Consider prioritizing high-impact items first

Estimated Total Time:
Requires further estimation based on task complexity and team velocity`;
}

// ✅ MAIN ROUTE
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const columns: Column[] = Array.isArray(body.columns) ? body.columns : [];
    const cards: Card[] = Array.isArray(body.cards) ? body.cards : [];
    const boardId = body.boardId || "N/A";

    if (!columns.length && !cards.length) {
      return NextResponse.json(
        { error: "Board data empty" },
        { status: 400 }
      );
    }

    // ✅ Count by column
    const counts: Record<string, number> = {};
    for (const col of columns) {
      counts[col.name || col.id || "Unknown"] = 0;
    }

    for (const card of cards) {
      const key = columns.find((c) => c.id === card.columnId)?.name || "Unassigned";
      counts[key] = (counts[key] || 0) + 1;
    }

    const topCards = cards.slice(0, 15).map(
      (c) =>
        `• ${c.title || c.id}${c.description ? ` — ${c.description}` : ""}`
    );

    const prompt = `You are a professional project manager analyzing a Kanban board.

Board ID: ${boardId}

Columns:
${columns.map((c) => `- ${c.name || c.id}`).join("\n")}

Task Count by Column:
${Object.entries(counts)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

Sample Tasks:
${topCards.join("\n")}

Create a clear, professional summary following this EXACT format:

Board Overview:
[Write 2-3 sentences describing the project's current state, focus, and progress]

Task Distribution:
• [Column name]: [count] tasks
• [Column name]: [count] tasks
[Continue for all columns]

Key Focus Tasks:
• **[Task name]**: [Why this task is important - 1 sentence]
• **[Task name]**: [Why this task is important - 1 sentence]
[List 3-6 most important tasks with brief explanations]

Suggestions:
• [Actionable recommendation for improving workflow]
• [Actionable recommendation for prioritization]
• [Actionable recommendation for task management]
[Provide 3-5 specific, actionable suggestions]

Estimated Total Time:
[Provide a realistic time estimate or note what's needed for estimation]

CRITICAL RULES:
- Use bullet points (•) for all lists
- Use **bold** for emphasis on task names
- Keep each section clearly separated
- Write in natural, professional language
- Do NOT use JSON format
- Do NOT use code blocks or markdown fences
- Keep total length under 300 words
- Be specific and actionable`;

    // ✅ If Gemini available → use AI
    if (process.env.GEMINI_API_KEY) {
      const text = await callGemini(prompt);
      return NextResponse.json({ summary: text });
    }

    // ✅ Fallback when API key missing
    const local = localSummarize(columns, cards, boardId, counts);
    return NextResponse.json({ summary: local });
    
  } catch (err: any) {
    console.error("SUMMARY ERROR:", err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";