// Supabase Edge Function: ai-parse-recording
// POST /functions/v1/ai-parse-recording
// Requires OPENAI_API_KEY in Supabase → Edge Functions → Secrets

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

// ---- item-parsing helpers ----

const fillerWordPattern =
  /\b(אממ+|אה+|כאילו|טוב|רגע|שנייה|בעצם|פשוט|יאללה|נו|אוקיי|אוקי)\b/g;
const splitWordPattern = /\b(פסיק|נקודה|שורה חדשה|וגם|ואז|אחר כך|בנוסף)\b/g;
const connectorPattern = /\s+(?:וגם|ואז|אחרי זה|בנוסף|ו)\s+/;
const dropTokens = new Set([
  "ו", "עם", "של", "אל", "את", "זה", "זאת", "הזה", "הזאת",
  "דברים", "מוצר", "מוצרים", "פריט", "פריטים",
]);

function normalizeSpaces(v: string) { return v.replace(/\s+/g, " ").trim(); }
function cleanSingleItem(v: string) {
  const c = normalizeSpaces(v.replace(fillerWordPattern, " ").replace(/[;،]/g, ",").replace(/[|]+/g, " ").replace(/^[,.\-–—\s]+|[,.\-–—\s]+$/g, ""));
  if (!c || c.length < 2 || dropTokens.has(c)) return "";
  return c;
}
function splitTranscriptToItems(text: string): string[] {
  const n = normalizeSpaces(text.replace(fillerWordPattern, " ").replace(splitWordPattern, ","));
  if (!n) return [];
  const d = n.replace(/[;،]/g, ",").split(/,|\n/).map(cleanSingleItem).filter(Boolean);
  if (d.length > 1) return d;
  const c = n.split(connectorPattern).map(cleanSingleItem).filter(Boolean);
  if (c.length > 1) return c;
  const f = cleanSingleItem(n);
  return f ? [f] : [];
}
function sanitizeItems(raw: string[]): string[] {
  return Array.from(new Set(raw.flatMap(splitTranscriptToItems).map(cleanSingleItem).filter(Boolean).map(i => i.replace(/\s+-\s+/g, " - "))));
}
function extractOutputText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string") return data.output_text;
  const output = Array.isArray(data.output) ? data.output as Array<{content?: Array<{type?: string; text?: string}>}> : [];
  return output.flatMap(i => i.content || []).find(p => p.type === "output_text" || p.type === "text")?.text || "";
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ---- handler ----

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  let body: { text?: string; sectionKey?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const text = String(body.text || "").trim();
  const rawSectionKey = body.sectionKey;
  const sectionKey = rawSectionKey === "homeTasks" || rawSectionKey === "generalShopping" || rawSectionKey === "supermarketShopping" ? rawSectionKey : "supermarketShopping";
  const sectionTitles: Record<string, string> = { homeTasks: "משימות בית", generalShopping: "רשימת קניות כללית", supermarketShopping: "רשימת קניות לסופר" };

  if (!text) return json({ items: [], source: "fallback" });
  if (!apiKey) return json({ items: sanitizeItems(splitTranscriptToItems(text)), source: "fallback" });

  try {
    const prompt = [
      "אתה מנתח תמלול דיבור בעברית לרשימת פריטים בלבד.",
      `סוג הרשימה: ${sectionTitles[sectionKey]}.`,
      "הנחיות קשיחות:",
      "1) החזר רק פריטים אמיתיים שהמשתמש התכוון אליהם.",
      "2) שמור שמות מרובי מילים כיחידה אחת (למשל: חזה עוף, רוטב עגבניות).",
      "3) אל תחלק מילים סתם ואל תייצר פריטים שלא נאמרו.",
      "4) הסר מילות מילוי ורעשי דיבור.",
      "5) אם הטקסט לא ברור, החזר מעט פריטים סבירים במקום הרבה פריטים שגויים.",
      "",
      `תמלול: ${text}`,
    ].join("\n");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4.1", input: prompt,
        text: { format: { type: "json_schema", name: "recording_item_parser", strict: true, schema: {
          type: "object",
          properties: { items: { type: "array", items: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false } } },
          required: ["items"], additionalProperties: false,
        }}},
      }),
    });
    clearTimeout(timeoutId);
    if (!res.ok) return json({ items: sanitizeItems(splitTranscriptToItems(text)), source: "fallback" });

    const data = await res.json() as Record<string, unknown>;
    const parsed = JSON.parse(extractOutputText(data) || '{"items":[]}') as { items?: Array<{name?: string}> };
    const items = sanitizeItems(Array.isArray(parsed.items) ? parsed.items.map(e => String(e.name || "")) : []);
    if (items.length === 0) return json({ items: sanitizeItems(splitTranscriptToItems(text)), source: "fallback" });
    return json({ items, source: "ai" });
  } catch {
    return json({ items: sanitizeItems(splitTranscriptToItems(text)), source: "fallback" });
  }
});
