import { NextResponse } from "next/server";
import { extractOutputText, type OpenAIResponsesPayload } from "@/lib/openai";
import { sanitizeItems, splitTranscriptToItems } from "@/lib/item-parsing";

type SectionKey = "homeTasks" | "generalShopping" | "supermarketShopping";

type ParseRequest = {
  sectionKey?: SectionKey;
  text?: string;
};

type ParseResponse = {
  items: string[];
  source: "ai" | "fallback";
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const sectionTitles: Record<SectionKey, string> = {
  homeTasks: "משימות בית",
  generalShopping: "רשימת קניות כללית",
  supermarketShopping: "רשימת קניות לסופר",
};

function fallbackItems(text: string): ParseResponse {
  return {
    items: sanitizeItems(splitTranscriptToItems(text)),
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
  const apiKey = process.env.OPENAI_API_KEY;
  const body = (await request.json().catch(() => ({}))) as ParseRequest;
  const text = String(body.text || "").trim();
  const rawSectionKey = body.sectionKey;
  const sectionKey: SectionKey =
    rawSectionKey === "homeTasks" ||
    rawSectionKey === "generalShopping" ||
    rawSectionKey === "supermarketShopping"
      ? rawSectionKey
      : "supermarketShopping";

  if (!text) {
    return jsonWithCors<ParseResponse>({ items: [], source: "fallback" });
  }

  if (!apiKey) {
    return jsonWithCors<ParseResponse>(fallbackItems(text));
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
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch("https://api.openai.com/v1/responses", {
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
            name: "recording_item_parser",
            strict: true,
            schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                    },
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
    clearTimeout(timeout);

    if (!response.ok) {
      return jsonWithCors<ParseResponse>(fallbackItems(text));
    }

    const data = (await response.json()) as OpenAIResponsesPayload;
    const rawText = extractOutputText(data);
    const parsed = JSON.parse(rawText || "{\"items\":[]}") as {
      items?: Array<{ name?: string }>;
    };

    const items = sanitizeItems(
      Array.isArray(parsed.items)
        ? parsed.items.map((entry) => String(entry.name || ""))
        : [],
    );

    if (items.length === 0) {
      return jsonWithCors<ParseResponse>(fallbackItems(text));
    }

    return jsonWithCors<ParseResponse>({ items, source: "ai" });
  } catch {
    return jsonWithCors<ParseResponse>(fallbackItems(text));
  }
}
