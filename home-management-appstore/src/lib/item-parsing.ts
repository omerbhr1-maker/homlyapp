export const fillerWordPattern =
  /\b(אממ+|אה+|כאילו|טוב|רגע|שנייה|בעצם|פשוט|יאללה|נו|אוקיי|אוקי)\b/g;

const splitWordPattern = /\b(פסיק|נקודה|שורה חדשה|וגם|ואז|אחר כך|בנוסף)\b/g;

const connectorPattern = /\s+(?:וגם|ואז|אחרי זה|בנוסף|ו)\s+/;

const dropTokens = new Set([
  "ו",
  "עם",
  "של",
  "אל",
  "את",
  "זה",
  "זאת",
  "הזה",
  "הזאת",
  "דברים",
  "מוצר",
  "מוצרים",
  "פריט",
  "פריטים",
]);

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanSingleItem(value: string) {
  const cleaned = normalizeSpaces(
    value
      .replace(fillerWordPattern, " ")
      .replace(/[;،]/g, ",")
      .replace(/[|]+/g, " ")
      .replace(/^[,.\-–—\s]+|[,.\-–—\s]+$/g, ""),
  );
  if (!cleaned) return "";
  if (cleaned.length < 2) return "";
  if (dropTokens.has(cleaned)) return "";
  return cleaned;
}

export function splitTranscriptToItems(text: string) {
  const normalized = normalizeSpaces(
    text
      .replace(fillerWordPattern, " ")
      .replace(splitWordPattern, ","),
  );

  if (!normalized) return [];

  const byDelimiters = normalized
    .replace(/[;،]/g, ",")
    .split(/,|\n/)
    .map((item) => cleanSingleItem(item))
    .filter(Boolean);
  if (byDelimiters.length > 1) return byDelimiters;

  const byConjunction = normalized
    .split(connectorPattern)
    .map((item) => cleanSingleItem(item))
    .filter(Boolean);
  if (byConjunction.length > 1) return byConjunction;

  const fallback = cleanSingleItem(normalized);
  return fallback ? [fallback] : [];
}

export function sanitizeItems(rawItems: string[]) {
  const expanded = rawItems.flatMap((item) => splitTranscriptToItems(item));
  return Array.from(
    new Set(
      expanded
        .map((item) => cleanSingleItem(item))
        .filter(Boolean)
        .map((item) => item.replace(/\s+-\s+/g, " - ")),
    ),
  );
}
