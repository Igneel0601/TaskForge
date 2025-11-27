"use client";

import React, { useState } from "react";
import { useStorage } from "@/app/liveblocks.config";
import { shallow } from "@liveblocks/core";
import { usePathname } from "next/navigation";

/* ✅ IMPROVED MARKDOWN → HTML FORMATTER */
function formatSummaryToHtml(text: string) {
  let html = text.trim();

  // Remove code blocks if present
  html = html.replace(/```[\s\S]*?```/g, "");
  
  // Section headings (lines ending with :)
  html = html.replace(
    /^([A-Za-z][^:\n]+):$/gm,
    "<h3 class='mt-6 mb-3 text-lg font-bold text-gray-800'>$1</h3>"
  );

  // Bold text (**text**)
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong class='font-semibold text-gray-900'>$1</strong>");

  // Process lists before converting line breaks
  // Bullet points (lines starting with • or *)
  html = html.replace(/^[•\*]\s+(.+)$/gm, "<li class='ml-6 mb-2'>$1</li>");
  
  // Numbered lists (lines starting with digits)
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li class='ml-6 mb-2'>$1</li>");

  // Wrap consecutive <li> elements in lists
  html = html.replace(/(<li[^>]*>.*?<\/li>\s*)+/g, (match) => {
    return `<ul class='list-disc space-y-2 my-3'>${match}</ul>`;
  });

  // Paragraphs (lines that aren't headings or list items)
  html = html.replace(/^(?!<[uh]|<li)(.+)$/gm, "<p class='mb-3 text-gray-700 leading-relaxed'>$1</p>");

  // Special highlighting for "Estimated Total Time"
  html = html.replace(
    /<h3([^>]*)>Estimated Total Time<\/h3>\s*<p[^>]*>([^<]+)<\/p>/,
    "<h3$1>Estimated Total Time</h3><p class='text-lg font-semibold text-purple-600 bg-purple-50 px-4 py-2 rounded-lg inline-block mt-2'>$2</p>"
  );

  return html;
}

function Summary() {
  // ✅ Read from Liveblocks
  const columns = useStorage(
    (root) => root.columns?.map((c: any) => ({ ...c })) || [],
    shallow as any
  );

  const cards = useStorage(
    (root) => root.cards?.map((c: any) => ({ ...c })) || [],
    shallow as any
  );

  const pathname = usePathname();
  const boardId = pathname?.split("/")?.pop() || null;

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  async function generateSummary() {
    setLoading(true);
    setError(null);
    setSummary(null);
    setIsOpen(true);

    try {
      const payload = {
        boardId,
        columns: (columns || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          index: c.index,
        })),
        cards: (cards || []).map((t: any) => ({
          id: t.id,
          title: t.name || t.title || t.id,
          columnId: t.columnId,
          description: t.description || "",
        })),
      };

      const res = await fetch("/api/board-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          `Request failed: ${res.status} ${res.statusText} ${txt}`
        );
      }

      const json = await res.json();
      const rawText = typeof json.summary === "string" ? json.summary : "";

      const formatted = formatSummaryToHtml(rawText);
      setSummary(formatted);
    } catch (err: any) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* ✅ Simple Button */}
      <button
        onClick={generateSummary}
        disabled={loading}
        className="px-4 py-2 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-60 shadow-sm"
      >
        {loading ? "Generating…" : "Generate AI Summary"}
      </button>

      {/* ✅ MODAL */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !loading && setIsOpen(false)}
        >
          <div
            className="bg-white w-full max-w-3xl max-h-[85vh] rounded-xl shadow-xl relative overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <button
                onClick={() => !loading && setIsOpen(false)}
                className="absolute top-4 right-4 text-2xl text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                ×
              </button>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">Board Summary</h2>
              <p className="text-sm text-gray-500">
                Board ID: <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{boardId}</span> • Columns:{" "}
                {columns?.length ?? 0} • Cards: {cards?.length ?? 0}
              </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading && (
                <div className="py-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-200 border-t-purple-600 mb-4"></div>
                  <div className="text-gray-600">✨ AI is analyzing your board…</div>
                </div>
              )}

              {!loading && error && (
                <div className="py-4 px-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <strong className="font-semibold">Error:</strong> {error}
                </div>
              )}

              {!loading && summary && !error && (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: summary }}
                />
              )}

              {!loading && !summary && !error && (
                <div className="py-8 text-center text-gray-500 text-sm">
                  No summary available. Click "Generate summary" to create one.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Summary;