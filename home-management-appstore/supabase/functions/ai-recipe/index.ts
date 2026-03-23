// Supabase Edge Function: ai-recipe
// POST /functions/v1/ai-recipe
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
function normalizeItemName(v: string) { return sanitizeItems([v])[0] || ""; }
function extractOutputText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string") return data.output_text;
  const output = Array.isArray(data.output) ? data.output as Array<{content?: Array<{type?: string; text?: string}>}> : [];
  return output.flatMap(i => i.content || []).find(p => p.type === "output_text" || p.type === "text")?.text || "";
}

// ---- recipe helpers ----

type RecipeAnswerValue = string | string[];
type RecipeQuestion = { id: string; title: string; kind?: string; options?: string[]; placeholder?: string; maxSelections?: number };

function getAnswerValues(value: RecipeAnswerValue | undefined): string[] {
  if (Array.isArray(value)) return value.map(v => v.trim()).filter(Boolean);
  const t = String(value || "").trim();
  return t ? t.split(",").map(v => v.trim()).filter(Boolean) : [];
}
function hasAnswer(answers: Record<string, RecipeAnswerValue>, id: string) { return getAnswerValues(answers[id]).length > 0; }
function includesAnswer(answers: Record<string, RecipeAnswerValue>, id: string, value: string) { return getAnswerValues(answers[id]).includes(value); }

function normalizeRecipeQuestions(raw: RecipeQuestion[]) {
  return raw.map(q => {
    const id = String(q.id || "").trim();
    const title = String(q.title || "").trim();
    const options = Array.isArray(q.options) ? Array.from(new Set(q.options.map(o => String(o || "").trim()).filter(Boolean))).slice(0, 8) : [];
    const kind = q.kind === "single" || q.kind === "multi" || q.kind === "text" ? q.kind : options.length > 0 ? "single" : "text";
    if (!id || !title) return null;
    if ((kind === "single" || kind === "multi") && options.length === 0) return null;
    const maxSelections = kind === "multi" ? Math.max(1, Math.min(options.length || 1, Number.isFinite(q.maxSelections) ? Number(q.maxSelections) : options.length || 1)) : undefined;
    return { id, title, kind, options: kind === "text" ? [] : options, placeholder: String(q.placeholder || "").trim() || undefined, maxSelections };
  }).filter(Boolean).slice(0, 4);
}

function fallbackRecipe(recipeText: string, answers: Record<string, RecipeAnswerValue>) {
  const questions: RecipeQuestion[] = [];
  if (!/\d/.test(recipeText) && !hasAnswer(answers, "servings"))
    questions.push({ id: "servings", title: "לכמה אנשים המתכון?", kind: "single", options: ["2", "4", "6", "8"] });
  if (/פסטה|רוטב|לזניה/.test(recipeText) && !hasAnswer(answers, "sauce"))
    questions.push({ id: "sauce", title: "איזה רוטב תרצה?", kind: "single", options: ["עגבניות", "שמנת", "פסטו"] });
  if (/ירקות|סלט|מוקפץ|מרק ירקות/.test(recipeText) && !hasAnswer(answers, "vegetables"))
    questions.push({ id: "vegetables", title: "איזה ירקות להוסיף? (אפשר לבחור כמה)", kind: "multi", options: ["עגבנייה", "מלפפון", "גזר", "פלפל", "בצל", "קישוא", "פטריות", "ברוקולי"], maxSelections: 6 });
  const nq = normalizeRecipeQuestions(questions);
  if (nq.length > 0) return { needs_clarification: true, questions: nq, items: [], notes: "", source: "fallback" };
  const guessed = new Set(sanitizeItems(splitTranscriptToItems(recipeText)));
  if (/עוף/.test(recipeText)) { guessed.add("חזה עוף"); guessed.add("שום"); guessed.add("שמן זית"); }
  if (/פסטה/.test(recipeText)) {
    guessed.add("פסטה");
    if (includesAnswer(answers, "sauce", "שמנת")) guessed.add("שמנת לבישול");
    if (includesAnswer(answers, "sauce", "עגבניות") || !hasAnswer(answers, "sauce")) guessed.add("רוטב עגבניות");
  }
  getAnswerValues(answers.vegetables).forEach(v => guessed.add(v));
  return { needs_clarification: false, questions: [], items: Array.from(guessed).map(name => ({ name })), notes: "הרשימה הופקה במצב חכם חלופי.", source: "fallback" };
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ---- handler ----

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  let body: { recipeText?: string; answers?: Record<string, RecipeAnswerValue> } = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const recipeText = String(body.recipeText || "").trim();
  const answers = body.answers || {};

  if (!recipeText) return json({ needs_clarification: false, questions: [], items: [], notes: "", source: "fallback" });
  if (!apiKey) return json(fallbackRecipe(recipeText, answers));

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
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4.1", input: prompt,
        text: { format: { type: "json_schema", name: "recipe_to_shopping_list", strict: true, schema: {
          type: "object",
          properties: {
            needs_clarification: { type: "boolean" }, notes: { type: "string" },
            questions: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, kind: { type: "string", enum: ["single","multi","text"] }, options: { type: "array", items: { type: "string" } } }, required: ["id","title","kind","options"], additionalProperties: false } },
            items: { type: "array", items: { type: "object", properties: { name: { type: "string" }, amount: { type: "string" } }, required: ["name","amount"], additionalProperties: false } },
          },
          required: ["needs_clarification","questions","items","notes"], additionalProperties: false,
        }}},
      }),
    });
    clearTimeout(timeoutId);
    if (!res.ok) return json(fallbackRecipe(recipeText, answers));

    const data = await res.json() as Record<string, unknown>;
    const parsed = JSON.parse(extractOutputText(data) || "{}") as { needs_clarification?: boolean; questions?: RecipeQuestion[]; items?: {name: string; amount: string}[]; notes?: string };
    if (typeof parsed.needs_clarification !== "boolean" || !Array.isArray(parsed.questions) || !Array.isArray(parsed.items)) return json(fallbackRecipe(recipeText, answers));

    const questions = normalizeRecipeQuestions(parsed.questions);
    if (parsed.needs_clarification) {
      if (questions.length === 0) return json(fallbackRecipe(recipeText, answers));
      return json({ needs_clarification: true, questions, items: [], notes: "", source: "ai" });
    }
    const cleanedItems = parsed.items.map(i => ({ name: String(i.name || "").trim(), amount: String(i.amount || "").trim() })).filter(i => i.name.length > 0);
    const normalizedNames = sanitizeItems(cleanedItems.map(i => i.name));
    const normalizedSet = new Set(normalizedNames);
    const finalItems = cleanedItems.map(i => ({ name: normalizeItemName(i.name), amount: i.amount })).filter(i => normalizedSet.has(i.name)).filter((i, idx, list) => list.findIndex(o => o.name === i.name) === idx);
    if (finalItems.length === 0) return json(fallbackRecipe(recipeText, answers));
    return json({ needs_clarification: false, questions: [], items: finalItems, notes: parsed.notes || "", source: "ai" });
  } catch {
    return json(fallbackRecipe(recipeText, answers));
  }
});
