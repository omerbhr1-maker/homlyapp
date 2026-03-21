import type { ImageLoaderProps } from "next/image";
import type {
  SectionKey,
  Section,
  Item,
  CloudUserRow,
  CloudHouseRow,
  CachedHouseMeta,
  HouseMemberUser,
  RecipeQuestion,
  RecipeQuestionKind,
  RecipeAnswerValue,
} from "@/types";
import { initialSections } from "@/lib/constants";

export const passthroughImageLoader = ({ src }: ImageLoaderProps) => src;

export function createInviteToken() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function getAuthEmailFromUsername(username: string) {
  if (username.includes("@")) return username;
  return `${username}@homly.app`;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function getPublicAppOrigin() {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  const normalize = (value: string) => {
    try {
      return new URL(value).origin;
    } catch {
      return "";
    }
  };

  const configuredOrigin = normalize(configured);
  if (configuredOrigin) return configuredOrigin;

  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    const isLocalHost =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!isLocalHost) return origin;
  }

  return "https://home-management-hebrew.pages.dev";
}

export function getAiApiUrl(path: string) {
  if (typeof window === "undefined") return path;
  const protocol = window.location.protocol;
  const isNativeShell =
    protocol === "capacitor:" || protocol === "ionic:" || window.location.origin === "null";
  return isNativeShell ? `${getPublicAppOrigin()}${path}` : path;
}

export function sanitizeCachedImage(value?: string) {
  const nextValue = String(value || "").trim();
  if (!nextValue) return "";
  if (nextValue.startsWith("data:")) return "";
  if (nextValue.length > 2048) return "";
  return nextValue;
}

export function toCachedUser(user: CloudUserRow): CloudUserRow {
  return {
    ...user,
    avatar_url: sanitizeCachedImage(user.avatar_url),
  };
}

export function toCachedHouseMeta(house: CloudHouseRow): CachedHouseMeta {
  return {
    id: house.id,
    name: house.name,
    pin: house.pin || "",
    invite_phone: house.invite_phone || "",
    house_image: sanitizeCachedImage(house.house_image),
    owner_user_id: house.owner_user_id ?? null,
  };
}

export function toCachedHouseMembers(members: HouseMemberUser[]) {
  return members.map((member) => ({
    ...member,
    avatar_url: sanitizeCachedImage(member.avatar_url),
  }));
}

export function formatAddedAt(value?: string) {
  if (!value) return "תאריך לא זמין";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "תאריך לא זמין";
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function normalizeRecipeQuestions(rawQuestions: RecipeQuestion[]) {
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
        question.kind === "multi" || question.kind === "text" || question.kind === "single"
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

export function getRecipeQuestionKind(question: RecipeQuestion): RecipeQuestionKind {
  if (question.kind === "single" || question.kind === "multi" || question.kind === "text") {
    return question.kind;
  }
  return question.options && question.options.length > 0 ? "single" : "text";
}

export function getRecipeAnswerValues(value: RecipeAnswerValue | undefined) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  const text = String(value || "").trim();
  if (!text) return [];
  return text.split(",").map((item) => item.trim()).filter(Boolean);
}

export function isRecipeAnswerMissing(question: RecipeQuestion, value: RecipeAnswerValue | undefined) {
  const kind = getRecipeQuestionKind(question);
  if (kind === "multi") return getRecipeAnswerValues(value).length === 0;
  const text = Array.isArray(value) ? value.join(", ") : String(value || "");
  return text.trim().length === 0;
}

export function getDefaultSectionItems() {
  return {
    homeTasks: [...initialSections.homeTasks.items],
    generalShopping: [...initialSections.generalShopping.items],
    supermarketShopping: [...initialSections.supermarketShopping.items],
  };
}

export function normalizeCloudSections(
  sections: Record<SectionKey, Item[]> | null | undefined,
): Record<SectionKey, Item[]> {
  const fallback = getDefaultSectionItems();
  if (!sections) return fallback;

  const normalizeItems = (items: Item[] | undefined, fallbackItems: Item[]) =>
    (Array.isArray(items) ? items : fallbackItems).map((item, index) => ({
      id: typeof item.id === "number" ? item.id : index + 1,
      text: String(item.text || "").trim(),
      completed: Boolean(item.completed),
      createdByUserId: item.createdByUserId,
      createdByName: item.createdByName || "לא ידוע",
      createdAt:
        typeof item.createdAt === "string" && item.createdAt
          ? item.createdAt
          : new Date().toISOString(),
    }));

  return {
    homeTasks: normalizeItems(sections.homeTasks, fallback.homeTasks),
    generalShopping: normalizeItems(sections.generalShopping, fallback.generalShopping),
    supermarketShopping: normalizeItems(sections.supermarketShopping, fallback.supermarketShopping),
  };
}

export function cloneSections(source: Record<SectionKey, Section>): Record<SectionKey, Section> {
  return {
    homeTasks: {
      ...source.homeTasks,
      items: source.homeTasks.items.map((item) => ({ ...item })),
    },
    generalShopping: {
      ...source.generalShopping,
      items: source.generalShopping.items.map((item) => ({ ...item })),
    },
    supermarketShopping: {
      ...source.supermarketShopping,
      items: source.supermarketShopping.items.map((item) => ({ ...item })),
    },
  };
}
