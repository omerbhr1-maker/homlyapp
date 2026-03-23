// Cloudflare Pages Function: POST /api/ai/parse-recording
// Runs as a Cloudflare Worker alongside the static Next.js export.
// Requires OPENAI_API_KEY set in Cloudflare Pages → Settings → Environment variables.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ---- item-parsing helpers (inlined from src/lib/item-parsing.ts) ----

const fillerWordPattern =
  /\b(אממ+|אה+|כאילו|טוב|רגע|שנייה|בעצם|פשוט|יאללה|נו|אוקיי|אוקי)\b/g;
const splitWordPattern = /\b(פסיק|נקודה|שורה חדשה|וגם|ואז|אחר כך|בנוסף)\b/g;
const connectorPattern = /\s+(?:וגם|ואז|אחרי זה|בנוסף|ו)\s+/;
const dropTokens = new Set([
  "ו", "עם", "של", "אל", "את", "זה", "זאת", "הזה", "הזאת",
  "דברים", "מוצר", "מוצרים", "פריט", "פריטים",
]);

function normalizeSpaces(value) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanSingleItem(value) {
  const cleaned = normalizeSpaces(
    value
      .replace(fillerWordPattern, " ")
      .replace(/[;،]/g, ",")
      .replace(/[|]+/g, " ")
      .replace(/^[,.\-–—\s]+|[,.\-–—\s]+$/g, ""),
  );
  if (!cleaned || cleaned.length < 2 || dropTokens.has(cleaned)) return "";
  return cleaned;
}

function splitTranscriptToItems(text) {
  const normalized = normalizeSpaces(
    text.replace(fillerWordPattern, " ").replace(splitWordPattern, ","),
  );
  if (!normalized) return [];
  const byDelimiters = normalized
    .replace(/[;،]/g, ",")
    .split(/,|\n/)
    .map(cleanSingleItem)
    .filter(Boolean);
  if (byDelimiters.length > 1) return byDelimiters;
  const byConjunction = normalized.split(connectorPattern).map(cleanSingleItem).filter(Boolean);
  if (byConjunction.length > 1) return byConjunction;
  const fallback = cleanSingleItem(normalized);
  return fallback ? [fallback] : [];
}

function sanitizeItems(rawItems) {
  const expanded = rawItems.flatMap((item) => splitTranscriptToItems(item));
  return Array.from(
    new Set(
      expanded
        .map(cleanSingleItem)
        .filter(Boolean)
        .map((item) => item.replace(/\s+-\s+/g, " - ")),
    ),
  );
}

function extractOutputText(data) {
  return (
    data.output_text ||
    data.output
      ?.flatMap((item) => item.content || [])
      .find((part) => part.type === "output_text" || part.type === "text")
      ?.text ||
    ""
  );
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---- Cloudflare Pages Function handlers ----

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const apiKey = context.env.OPENAI_API_KEY;

  let body = {};
  try { body = await context.request.json(); } catch {}

  const text = String(body.text || "").trim();
  const rawSectionKey = body.sectionKey;
  const sectionKey =
    rawSectionKey === "homeTasks" ||
    rawSectionKey === "generalShopping" ||
    rawSectionKey === "supermarketShopping"
      ? rawSectionKey
      : "supermarketShopping";

  const sectionTitles = {
    homeTasks: "משימות בית",
    generalShopping: "רשימת קניות כללית",
    supermarketShopping: "רשימת קניות לסופר",
  };

  if (!text) {
    return jsonResponse({ items: [], source: "fallback" });
  }

  if (!apiKey) {
    return jsonResponse({ items: sanitizeItems(splitTranscriptToItems(text)), source: "fallback" });
  }

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

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4.1",
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "recording_item_parser",
            strict: true,
            schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { name: { type: "string" } },
                    required: ["name"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return jsonResponse({ items: sanitizeItems(splitTranscriptToItems(text)), source: "fallback" });
    }

    const data = await response.json();
    const rawText = extractOutputText(data);
    const parsed = JSON.parse(rawText || '{"items":[]}');

    const items = sanitizeItems(
      Array.isArray(parsed.items) ? parsed.items.map((entry) => String(entry.name || "")) : [],
    );

    if (items.length === 0) {
      return jsonResponse({ items: sanitizeItems(splitTranscriptToItems(text)), source: "fallback" });
    }

    return jsonResponse({ items, source: "ai" });
  } catch {
    return jsonResponse({ items: sanitizeItems(splitTranscriptToItems(text)), source: "fallback" });
  }
}
