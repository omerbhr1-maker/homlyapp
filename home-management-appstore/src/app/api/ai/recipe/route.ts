import { NextResponse } from "next/server";
import { extractOutputText, type OpenAIResponsesPayload } from "@/lib/openai";
import { sanitizeItems, splitTranscriptToItems } from "@/lib/item-parsing";
import { checkRateLimit } from "@/lib/rate-limit";

type RecipeQuestionKind = "single" | "multi" | "text";
type RecipeAnswerValue = string | string[];

type RecipeQuestion = {
  id: string;
  title: string;
  kind?: RecipeQuestionKind;
  options?: string[];
  placeholder?: string;
  maxSelections?: number;
};

type RecipeResponse = {
  needs_clarification: boolean;
  questions: RecipeQuestion[];
  items: { name: string; amount?: string }[];
  notes: string;
  source: "ai" | "fallback";
};

type RecipeRequest = {
  recipeText?: string;
  answers?: Record<string, RecipeAnswerValue>;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function getAnswerValues(value: RecipeAnswerValue | undefined) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  const text = String(value || "").trim();
  if (!text) return [];
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasAnswer(answers: Record<string, RecipeAnswerValue>, questionId: string) {
  return getAnswerValues(answers[questionId]).length > 0;
}

function includesAnswer(answers: Record<string, RecipeAnswerValue>, questionId: string, value: string) {
  return getAnswerValues(answers[questionId]).includes(value);
}

function normalizeRecipeQuestions(rawQuestions: RecipeQuestion[]) {
  return rawQuestions
    .map((question) => {
      const id = String(question.id || "").trim();
      const title = String(question.title || "").trim();
      const options = Array.isArray(question.options)
        ? Array.from(
            new Set(
              question.options
                .map((option) => String(option || "").trim())
                .filter(Boolean),
            ),
          ).slice(0, 8)
        : [];
      const kind: RecipeQuestionKind =
        question.kind === "single" || question.kind === "multi" || question.kind === "text"
          ? question.kind
          : options.length > 0
            ? "single"
            : "text";

      if (!id || !title) return null;
      if ((kind === "single" || kind === "multi") && options.length === 0) return null;

      const maxSelections =
        kind === "multi"
          ? Math.max(
              1,
              Math.min(
                options.length || 1,
                Number.isFinite(question.maxSelections)
                  ? Number(question.maxSelections)
                  : options.length || 1,
              ),
            )
          : undefined;

      return {
        id,
        title,
        kind,
        options: kind === "text" ? [] : options,
        placeholder: String(question.placeholder || "").trim() || undefined,
        maxSelections,
      } satisfies RecipeQuestion;
    })
    .filter((question): question is NonNullable<typeof question> => Boolean(question))
    .slice(0, 4);
}

function fallbackRecipe(
  recipeText: string,
  answers: Record<string, RecipeAnswerValue>,
): RecipeResponse {
  const questions: RecipeQuestion[] = [];

  if (!/\d/.test(recipeText) && !hasAnswer(answers, "servings")) {
    questions.push({
      id: "servings",
      title: "לכמה אנשים המתכון?",
      kind: "single",
      options: ["2", "4", "6", "8"],
    });
  }

  if (/פסטה|רוטב|לזניה/.test(recipeText) && !hasAnswer(answers, "sauce")) {
    questions.push({
      id: "sauce",
      title: "איזה רוטב תרצה?",
      kind: "single",
      options: ["עגבניות", "שמנת", "פסטו"],
    });
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
    return {
      needs_clarification: true,
      questions: normalizedQuestions,
      items: [],
      notes: "",
      source: "fallback",
    };
  }

  const guessed = new Set(sanitizeItems(splitTranscriptToItems(recipeText)));
  if (/עוף/.test(recipeText)) {
    guessed.add("חזה עוף");
    guessed.add("שום");
    guessed.add("שמן זית");
  }
  if (/פסטה/.test(recipeText)) {
    guessed.add("פסטה");
    if (includesAnswer(answers, "sauce", "שמנת")) guessed.add("שמנת לבישול");
    if (includesAnswer(answers, "sauce", "עגבניות") || !hasAnswer(answers, "sauce")) {
      guessed.add("רוטב עגבניות");
    }
  }

  getAnswerValues(answers.vegetables).forEach((vegetable) => guessed.add(vegetable));

  return {
    needs_clarification: false,
    questions: [],
    items: Array.from(guessed).map((name) => ({ name })),
    notes: "הרשימה הופקה במצב חכם חלופי.",
    source: "fallback",
  };
}

function jsonWithCors<T>(body: T, init?: ResponseInit) {
  return NextResponse.json<T>(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init?.headers || {}),
    },
  });
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip, 10)) {
    return jsonWithCors<RecipeResponse>({
      needs_clarification: false,
      questions: [],
      items: [],
      notes: "",
      source: "fallback",
    }, { status: 429 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const body = (await request.json().catch(() => ({}))) as RecipeRequest;
  const recipeText = String(body.recipeText || "").trim();
  const answers = body.answers || {};

  if (!recipeText) {
    return jsonWithCors<RecipeResponse>({
      needs_clarification: false,
      questions: [],
      items: [],
      notes: "",
      source: "fallback",
    });
  }

  if (recipeText.length > 20000) {
    return jsonWithCors<RecipeResponse>(fallbackRecipe(recipeText.slice(0, 20000), answers));
  }

  if (!apiKey) {
    return jsonWithCors<RecipeResponse>(fallbackRecipe(recipeText, answers));
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
    const timeout = setTimeout(() => controller.abort(), 25000);
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
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
                        options: {
                          type: "array",
                          items: { type: "string" },
                        },
                      },
                      required: ["id", "title", "kind", "options"],
                      additionalProperties: false,
                    },
                  },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        amount: { type: "string" },
                      },
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
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return jsonWithCors<RecipeResponse>(fallbackRecipe(recipeText, answers));
    }

    const data = (await response.json()) as OpenAIResponsesPayload;
    const rawText = extractOutputText(data);
    const parsed = JSON.parse(rawText || "{}") as RecipeResponse;

    if (
      typeof parsed.needs_clarification !== "boolean" ||
      !Array.isArray(parsed.questions) ||
      !Array.isArray(parsed.items)
    ) {
      return jsonWithCors<RecipeResponse>(fallbackRecipe(recipeText, answers));
    }

    const questions = normalizeRecipeQuestions(parsed.questions);
    if (parsed.needs_clarification) {
      if (questions.length === 0) {
        return jsonWithCors<RecipeResponse>(fallbackRecipe(recipeText, answers));
      }
      return jsonWithCors<RecipeResponse>({
        needs_clarification: true,
        questions,
        items: [],
        notes: "",
        source: "ai",
      });
    }

    const cleanedItems = parsed.items
      .map((item) => ({
        name: String(item.name || "").trim(),
        amount: String(item.amount || "").trim(),
      }))
      .filter((item) => item.name.length > 0);

    const normalizedNames = sanitizeItems(cleanedItems.map((item) => item.name));
    const normalizedSet = new Set(normalizedNames);

    const finalItems = cleanedItems
      .map((item) => ({
        name: normalizeItemName(item.name),
        amount: item.amount,
      }))
      .filter((item) => normalizedSet.has(item.name))
      .filter((item, index, list) => list.findIndex((other) => other.name === item.name) === index);

    if (finalItems.length === 0) {
      return jsonWithCors<RecipeResponse>(fallbackRecipe(recipeText, answers));
    }

    return jsonWithCors<RecipeResponse>({
      needs_clarification: false,
      questions: [],
      items: finalItems,
      notes: parsed.notes || "",
      source: "ai",
    });
  } catch {
    return jsonWithCors<RecipeResponse>(fallbackRecipe(recipeText, answers));
  }
}

function normalizeItemName(value: string) {
  return sanitizeItems([value])[0] || "";
}
