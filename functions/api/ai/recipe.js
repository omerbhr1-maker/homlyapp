// Cloudflare Pages Function: POST /api/ai/recipe
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

function normalizeItemName(value) {
  return sanitizeItems([value])[0] || "";
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

// ---- recipe helpers ----

function getAnswerValues(value) {
  if (Array.isArray(value)) return value.map((v) => v.trim()).filter(Boolean);
  const text = String(value || "").trim();
  if (!text) return [];
  return text.split(",").map((v) => v.trim()).filter(Boolean);
}

function hasAnswer(answers, id) {
  return getAnswerValues(answers[id]).length > 0;
}

function includesAnswer(answers, id, value) {
  return getAnswerValues(answers[id]).includes(value);
}

function normalizeRecipeQuestions(rawQuestions) {
  return rawQuestions
    .map((q) => {
      const id = String(q.id || "").trim();
      const title = String(q.title || "").trim();
      const options = Array.isArray(q.options)
        ? Array.from(new Set(q.options.map((o) => String(o || "").trim()).filter(Boolean))).slice(0, 8)
        : [];
      const kind =
        q.kind === "single" || q.kind === "multi" || q.kind === "text"
          ? q.kind
          : options.length > 0 ? "single" : "text";
      if (!id || !title) return null;
      if ((kind === "single" || kind === "multi") && options.length === 0) return null;
      const maxSelections =
        kind === "multi"
          ? Math.max(1, Math.min(options.length || 1, Number.isFinite(q.maxSelections) ? Number(q.maxSelections) : options.length || 1))
          : undefined;
      return {
        id,
        title,
        kind,
        options: kind === "text" ? [] : options,
        placeholder: String(q.placeholder || "").trim() || undefined,
        maxSelections,
      };
    })
    .filter(Boolean)
    .slice(0, 4);
}

function fallbackRecipe(recipeText, answers) {
  const questions = [];
  if (!/\d/.test(recipeText) && !hasAnswer(answers, "servings")) {
    questions.push({ id: "servings", title: "לכמה אנשים המתכון?", kind: "single", options: ["2", "4", "6", "8"] });
  }
  if (/פסטה|רוטב|לזניה/.test(recipeText) && !hasAnswer(answers, "sauce")) {
    questions.push({ id: "sauce", title: "איזה רוטב תרצה?", kind: "single", options: ["עגבניות", "שמנת", "פסטו"] });
  }
  if (/ירקות|סלט|מוקפץ|מרק ירקות/.test(recipeText) && !hasAnswer(answers, "vegetables")) {
    questions.push({
      id: "vegetables",
      title: "איזה ירקות להוסיף? (אפשר לבחור כמה)",
      kind: "multi",
      options: ["עגבנייה", "מלפפון", "גזר", "פלפל", "בצל", "קישוא", "פטריות", "ברוקולי"],
      maxSelections: 6,
    });
  }
  const normalizedQuestions = normalizeRecipeQuestions(questions);
  if (normalizedQuestions.length > 0) {
    return { needs_clarification: true, questions: normalizedQuestions, items: [], notes: "", source: "fallback" };
  }
  const guessed = new Set(sanitizeItems(splitTranscriptToItems(recipeText)));
  if (/עוף/.test(recipeText)) { guessed.add("חזה עוף"); guessed.add("שום"); guessed.add("שמן זית"); }
  if (/פסטה/.test(recipeText)) {
    guessed.add("פסטה");
    if (includesAnswer(answers, "sauce", "שמנת")) guessed.add("שמנת לבישול");
    if (includesAnswer(answers, "sauce", "עגבניות") || !hasAnswer(answers, "sauce")) guessed.add("רוטב עגבניות");
  }
  getAnswerValues(answers.vegetables).forEach((v) => guessed.add(v));
  return {
    needs_clarification: false,
    questions: [],
    items: Array.from(guessed).map((name) => ({ name })),
    notes: "הרשימה הופקה במצב חכם חלופי.",
    source: "fallback",
  };
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

  const recipeText = String(body.recipeText || "").trim();
  const answers = body.answers || {};

  if (!recipeText) {
    return jsonResponse({ needs_clarification: false, questions: [], items: [], notes: "", source: "fallback" });
  }

  if (!apiKey) {
    return jsonResponse(fallbackRecipe(recipeText, answers));
  }

  try {
    const prompt = [
      "אתה שף ועוזר קניות ישראלי.",
      "עליך להפיק רשימת רכיבי קנייה מדויקת לפי מתכון בעברית.",
      "כללים קשיחים:",
      "1) החזר רק JSON לפי הסכימה.",
      "2) אסור להחזיר מנות מוכנות, רק רכיבים שניתן לקנות.",
      "3) אל תוסיף רכיבים לא קשורים.",
      "4) אם חסר מידע מהותי, החזר needs_clarification=true ו-items=[].",
      "5) שאל עד 4 שאלות קצרות וממוקדות בלבד.",
      "6) לכל שאלה הגדר kind: single | multi | text.",
      "7) kind=multi מיועד למקרים עם כמה בחירות (למשל כמה ירקות).",
      "8) notes מיועד לסיכום קצר בלבד, לא לשאלות.",
      "9) אם יש מספיק מידע: needs_clarification=false ו-questions=[].",
      "10) שמור כמויות כשיש בטקסט; כשאין, השאר amount ריק.",
      "",
      `מתכון: ${recipeText}`,
      `תשובות משתמש: ${JSON.stringify(answers)}`,
    ].join("\n");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

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
            name: "recipe_to_shopping_list",
            strict: true,
            schema: {
              type: "object",
              properties: {
                needs_clarification: { type: "boolean" },
                notes: { type: "string" },
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      kind: { type: "string", enum: ["single", "multi", "text"] },
                      options: { type: "array", items: { type: "string" } },
                    },
                    required: ["id", "title", "kind", "options"],
                    additionalProperties: false,
                  },
                },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { name: { type: "string" }, amount: { type: "string" } },
                    required: ["name", "amount"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["needs_clarification", "questions", "items", "notes"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    clearTimeout(timeoutId);

    if (!response.ok) return jsonResponse(fallbackRecipe(recipeText, answers));

    const data = await response.json();
    const rawText = extractOutputText(data);
    const parsed = JSON.parse(rawText || "{}");

    if (
      typeof parsed.needs_clarification !== "boolean" ||
      !Array.isArray(parsed.questions) ||
      !Array.isArray(parsed.items)
    ) {
      return jsonResponse(fallbackRecipe(recipeText, answers));
    }

    const questions = normalizeRecipeQuestions(parsed.questions);
    if (parsed.needs_clarification) {
      if (questions.length === 0) return jsonResponse(fallbackRecipe(recipeText, answers));
      return jsonResponse({ needs_clarification: true, questions, items: [], notes: "", source: "ai" });
    }

    const cleanedItems = parsed.items
      .map((item) => ({ name: String(item.name || "").trim(), amount: String(item.amount || "").trim() }))
      .filter((item) => item.name.length > 0);

    const normalizedNames = sanitizeItems(cleanedItems.map((item) => item.name));
    const normalizedSet = new Set(normalizedNames);

    const finalItems = cleanedItems
      .map((item) => ({ name: normalizeItemName(item.name), amount: item.amount }))
      .filter((item) => normalizedSet.has(item.name))
      .filter((item, index, list) => list.findIndex((other) => other.name === item.name) === index);

    if (finalItems.length === 0) return jsonResponse(fallbackRecipe(recipeText, answers));

    return jsonResponse({ needs_clarification: false, questions: [], items: finalItems, notes: parsed.notes || "", source: "ai" });
  } catch {
    return jsonResponse(fallbackRecipe(recipeText, answers));
  }
}
