"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import Image, { type ImageLoaderProps } from "next/image";
import { hapticLight, hapticHeavy, hapticNotificationSuccess, nativeShare } from "@/lib/capacitor";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { User } from "@supabase/supabase-js";
import { CSS } from "@dnd-kit/utilities";
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { appCacheStorage, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { sanitizeItems, splitTranscriptToItems } from "@/lib/item-parsing";

const RecipeModal = lazy(() => import("@/components/RecipeModal").then((m) => ({ default: m.RecipeModal })));
const InviteModal = lazy(() => import("@/components/InviteModal").then((m) => ({ default: m.InviteModal })));
const SettingsModal = lazy(() => import("@/components/SettingsModal").then((m) => ({ default: m.SettingsModal })));

type SectionKey = "homeTasks" | "generalShopping" | "supermarketShopping";

type Item = {
  id: number;
  text: string;
  completed: boolean;
  createdByUserId?: string;
  createdByName?: string;
  createdAt?: string;
};

type Section = {
  title: string;
  placeholder: string;
  items: Item[];
};

type UndoState = {
  label: string;
  sections: Record<SectionKey, Section>;
};

type CloudHouseRow = {
  id: string;
  name: string;
  pin?: string;
  sections: Record<SectionKey, Item[]>;
  invite_phone: string;
  house_image?: string;
  owner_user_id?: string | null;
  updated_at?: string;
};

type CloudUserRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  auth_user_id?: string | null;
};

type InviteLookupByEmail = {
  app_user_id: string;
};

type HouseMemberUser = {
  id: string;
  display_name: string;
  avatar_url: string;
  role: "owner" | "member";
};

type CachedHouseMeta = {
  id: string;
  name: string;
  pin?: string;
  invite_phone: string;
  house_image?: string;
  owner_user_id?: string | null;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

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

type RecipeAiResponse = {
  needs_clarification: boolean;
  questions: RecipeQuestion[];
  items: { name: string; amount?: string }[];
  notes?: string;
  source?: "ai" | "fallback";
};

const sectionOrder: SectionKey[] = [
  "supermarketShopping",
  "homeTasks",
  "generalShopping",
];

const sectionAnchors: Record<SectionKey, string> = {
  homeTasks: "tasks",
  generalShopping: "general",
  supermarketShopping: "supermarket",
};

const defaultCreatedAt = new Date().toISOString();

const initialSections: Record<SectionKey, Section> = {
  homeTasks: {
    title: "משימות בית",
    placeholder: "הוספת משימה חדשה",
    items: [
      {
        id: 1,
        text: "לקפל כביסה",
        completed: false,
        createdByName: "Homly",
        createdAt: defaultCreatedAt,
      },
      {
        id: 2,
        text: "לשטוף כלים",
        completed: true,
        createdByName: "Homly",
        createdAt: defaultCreatedAt,
      },
      {
        id: 3,
        text: "להוציא אשפה",
        completed: false,
        createdByName: "Homly",
        createdAt: defaultCreatedAt,
      },
    ],
  },
  generalShopping: {
    title: "רשימת קניות כללית",
    placeholder: "הוספת פריט לרשימה",
    items: [
      {
        id: 1,
        text: "סבון ידיים",
        completed: false,
        createdByName: "Homly",
        createdAt: defaultCreatedAt,
      },
      {
        id: 2,
        text: "נייר אפייה",
        completed: false,
        createdByName: "Homly",
        createdAt: defaultCreatedAt,
      },
      {
        id: 3,
        text: "שקיות זבל",
        completed: true,
        createdByName: "Homly",
        createdAt: defaultCreatedAt,
      },
    ],
  },
  supermarketShopping: {
    title: "רשימת קניות לסופר",
    placeholder: "הוספת מוצר לסופר",
    items: [
      {
        id: 1,
        text: "חלב",
        completed: false,
        createdByName: "Homly",
        createdAt: defaultCreatedAt,
      },
      {
        id: 2,
        text: "לחם",
        completed: true,
        createdByName: "Homly",
        createdAt: defaultCreatedAt,
      },
      {
        id: 3,
        text: "ביצים",
        completed: false,
        createdByName: "Homly",
        createdAt: defaultCreatedAt,
      },
    ],
  },
};

const passthroughImageLoader = ({ src }: ImageLoaderProps) => src;

function createInviteToken() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function getAuthEmailFromUsername(username: string) {
  if (username.includes("@")) return username;
  return `${username}@homly.app`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getPublicAppOrigin() {
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


function sanitizeCachedImage(value?: string) {
  const nextValue = String(value || "").trim();
  if (!nextValue) return "";
  if (nextValue.startsWith("data:")) return "";
  if (nextValue.length > 2048) return "";
  return nextValue;
}

function toCachedUser(user: CloudUserRow): CloudUserRow {
  return {
    ...user,
    avatar_url: sanitizeCachedImage(user.avatar_url),
  };
}

function toCachedHouseMeta(house: CloudHouseRow): CachedHouseMeta {
  return {
    id: house.id,
    name: house.name,
    pin: house.pin || "",
    invite_phone: house.invite_phone || "",
    house_image: sanitizeCachedImage(house.house_image),
    owner_user_id: house.owner_user_id ?? null,
  };
}

function toCachedHouseMembers(members: HouseMemberUser[]) {
  return members.map((member) => ({
    ...member,
    avatar_url: sanitizeCachedImage(member.avatar_url),
  }));
}

function formatAddedAt(value?: string) {
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
                Number.isFinite(question.maxSelections) ? Number(question.maxSelections) : options.length || 1,
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

function getRecipeQuestionKind(question: RecipeQuestion): RecipeQuestionKind {
  if (question.kind === "single" || question.kind === "multi" || question.kind === "text") {
    return question.kind;
  }
  return question.options && question.options.length > 0 ? "single" : "text";
}

function getRecipeAnswerValues(value: RecipeAnswerValue | undefined) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  const text = String(value || "").trim();
  if (!text) return [];
  return text.split(",").map((item) => item.trim()).filter(Boolean);
}

function isRecipeAnswerMissing(question: RecipeQuestion, value: RecipeAnswerValue | undefined) {
  const kind = getRecipeQuestionKind(question);
  if (kind === "multi") return getRecipeAnswerValues(value).length === 0;
  const text = Array.isArray(value) ? value.join(", ") : String(value || "");
  return text.trim().length === 0;
}

function SafeImage({
  src,
  alt,
  width,
  height,
  className,
  fallback,
}: {
  src?: string;
  alt: string;
  width: number;
  height: number;
  className: string;
  fallback: React.ReactNode;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
}

function HomeLogo({ houseName, houseImage }: { houseName?: string; houseImage?: string }) {
  return (
    <div className="flex items-center gap-3">
      <SafeImage
        src={houseImage}
        alt="תמונת בית"
        width={44}
        height={44}
        className="h-11 w-11 rounded-2xl border border-slate-200 object-cover shadow-lg shadow-slate-200"
        fallback={
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-500 to-sky-500 text-white shadow-lg shadow-teal-200">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 10.6 12 4l8 6.6V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
              <path d="M9 20v-6.2" />
              <path d="M15 20v-6.2" />
              <path d="M9 14h6" />
              <path d="M16.8 6.1V4.6" />
              <path d="M18.4 3.2v2.1" />
              <path d="M17.35 4.25h2.1" />
            </svg>
          </span>
        }
      />
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{houseName || "Homly"}</h1>
        <p className="text-sm text-slate-500 sm:text-base">
          {houseName ? "Homly" : "ניהול בית חכם, מהיר ונוח"}
        </p>
      </div>
    </div>
  );
}

function LoadingBar({ done }: { done?: boolean }) {
  const [pct, setPct] = useState(0);
  const pctRef = useRef(0);

  useEffect(() => {
    pctRef.current = 0;
    setPct(0);
    const timer = setInterval(() => {
      const cur = pctRef.current;
      if (cur >= 90) { clearInterval(timer); return; }
      const step = cur < 30 ? 9 : cur < 60 ? 6 : cur < 80 ? 3 : 1;
      pctRef.current = Math.min(90, cur + step);
      setPct(Math.round(pctRef.current));
    }, 130);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (done) setPct(100);
  }, [done]);

  return (
    <div className="mt-5">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-l from-teal-500 to-cyan-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs font-bold text-teal-600">{pct}%</p>
    </div>
  );
}

function AudioWaveIcon() {
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "flex-end", gap: "2px", width: "18px", height: "16px" }}>
      {(["6px","11px","14px","11px"] as const).map((h, i) => (
        <span key={i} style={{ display: "block", width: "3px", height: h, borderRadius: "2px", backgroundColor: "currentColor", transformOrigin: "bottom", animation: "audioWaveBar 0.7s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function RecipeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h16" />
      <path d="M7 3v6" />
      <path d="M17 3v6" />
      <rect x="4" y="6" width="16" height="15" rx="2" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  );
}

function getDefaultSectionItems() {
  return {
    homeTasks: [...initialSections.homeTasks.items],
    generalShopping: [...initialSections.generalShopping.items],
    supermarketShopping: [...initialSections.supermarketShopping.items],
  };
}

function normalizeCloudSections(
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
    supermarketShopping: normalizeItems(
      sections.supermarketShopping,
      fallback.supermarketShopping,
    ),
  };
}

function cloneSections(source: Record<SectionKey, Section>): Record<SectionKey, Section> {
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

const SORTABLE_SEP = "::";
const PENDING_JOIN_CODE_KEY = "homly_pending_join_code";
const PENDING_JOIN_HOUSE_KEY = "homly_pending_join_house";
const SELECTED_HOUSE_KEY_PREFIX = "homly_selected_house_";
const CACHED_USER_KEY = "homly_cached_user";
const CACHED_HOUSE_META_KEY_PREFIX = "homly_cached_house_meta_";
const CACHED_HOUSE_MEMBERS_KEY_PREFIX = "homly_cached_house_members_";
const CACHED_HOUSE_SECTIONS_KEY_PREFIX = "homly_cached_sections_";

function getSelectedHouseStorageKey(userId: string) {
  return `${SELECTED_HOUSE_KEY_PREFIX}${userId}`;
}

function getCachedHouseMetaStorageKey(userId: string) {
  return `${CACHED_HOUSE_META_KEY_PREFIX}${userId}`;
}

function getCachedHouseMembersStorageKey(houseId: string) {
  return `${CACHED_HOUSE_MEMBERS_KEY_PREFIX}${houseId}`;
}

function getCachedHouseSectionsStorageKey(houseId: string) {
  return `${CACHED_HOUSE_SECTIONS_KEY_PREFIX}${houseId}`;
}

async function setPersistentCacheValue(key: string, value: string) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, value);
    }
  } catch {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore cleanup failures.
      }
    }
  }
  try {
    await appCacheStorage.setItem(key, value);
  } catch {
    try {
      await appCacheStorage.removeItem(key);
    } catch {
      // Ignore cleanup failures.
    }
  }
}

async function removePersistentCacheValue(key: string) {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(key);
  }
  await appCacheStorage.removeItem(key);
}

function toSortableId(sectionKey: SectionKey, itemId: number) {
  return `${sectionKey}${SORTABLE_SEP}${itemId}`;
}

function fromSortableId(value: string): { sectionKey: SectionKey; itemId: number } | null {
  const [rawSectionKey, rawItemId] = value.split(SORTABLE_SEP);
  if (!rawSectionKey || !rawItemId) return null;
  if (!sectionOrder.includes(rawSectionKey as SectionKey)) return null;
  const itemId = Number(rawItemId);
  if (!Number.isFinite(itemId)) return null;
  return { sectionKey: rawSectionKey as SectionKey, itemId };
}

function SortableListItem({
  sortableId,
  item,
  createdByAvatarUrl,
  addedAtLabel,
  onToggle,
  onEdit,
  onDelete,
}: {
  sortableId: string;
  item: Item;
  createdByAvatarUrl?: string;
  addedAtLabel: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({
      id: sortableId,
    });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-white px-3 py-2 ${
        isDragging ? "z-20 opacity-40 shadow-lg" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex h-9 w-9 shrink-0 touch-none cursor-grab items-center justify-center rounded-xl border border-slate-200 text-slate-500 active:cursor-grabbing"
        title="גרור לשינוי סדר"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="6" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="18" r="1" />
          <circle cx="15" cy="6" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="18" r="1" />
        </svg>
      </button>
      <button type="button" onClick={onToggle} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 text-right">
        <span className={`h-5 w-5 shrink-0 rounded-full border ${item.completed ? "border-teal-600 bg-teal-600" : "border-slate-300 bg-white"}`} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${item.completed ? "text-slate-400 line-through" : "text-slate-700"}`}>{item.text}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
            {createdByAvatarUrl ? (
              <Image
                loader={passthroughImageLoader}
                unoptimized
                src={createdByAvatarUrl}
                alt="משתמש"
                width={14}
                height={14}
                className="h-3.5 w-3.5 rounded-full object-cover"
              />
            ) : (
              <span className="h-3.5 w-3.5 rounded-full bg-slate-300" />
            )}
            <span>{addedAtLabel}</span>
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label="עריכה"
        title="עריכה"
        className="flex min-h-9 items-center justify-center rounded-xl px-2 py-1 text-slate-600 transition hover:bg-slate-100"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m12 20 7-7-3-3-7 7-1 4z" />
          <path d="m15 7 3 3" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="מחיקה"
        title="מחיקה"
        className="flex min-h-9 items-center justify-center rounded-xl px-2 py-1 text-rose-600 transition hover:bg-rose-50"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      </button>
    </li>
  );
}

export default function HomePage() {
  const [isMobile, setIsMobile] = useState(true);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  const [authMode, setAuthMode] = useState<"create" | "login">("login");
  const [usernameInput, setUsernameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [userPasswordInput, setUserPasswordInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [userAvatarInput, setUserAvatarInput] = useState("");
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotPasswordIdentifier, setForgotPasswordIdentifier] = useState("");
  const [forgotPasswordError, setForgotPasswordError] = useState("");
  const [forgotPasswordFeedback, setForgotPasswordFeedback] = useState("");
  const [isForgotPasswordLoading, setIsForgotPasswordLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryPasswordInput, setRecoveryPasswordInput] = useState("");
  const [recoveryPasswordConfirmInput, setRecoveryPasswordConfirmInput] = useState("");
  const [recoveryPasswordError, setRecoveryPasswordError] = useState("");
  const [recoveryPasswordFeedback, setRecoveryPasswordFeedback] = useState("");
  const [isRecoveryPasswordLoading, setIsRecoveryPasswordLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthResolving, setIsAuthResolving] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [settingsHouseName, setSettingsHouseName] = useState("");
  const [settingsHouseImage, setSettingsHouseImage] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isDeletingHouse, setIsDeletingHouse] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [userProfileName, setUserProfileName] = useState("");
  const [userProfileImage, setUserProfileImage] = useState("");
  const [isSavingUserProfile, setIsSavingUserProfile] = useState(false);
  const [userProfileError, setUserProfileError] = useState("");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [desktopQuery, setDesktopQuery] = useState("");
  const [desktopFilter, setDesktopFilter] = useState<"all" | "open" | "done">("all");
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState("");
  const [inviteIdentifierInput, setInviteIdentifierInput] = useState("");
  const [inviteByUserLoading, setInviteByUserLoading] = useState(false);
  const [houseCreateNameInput, setHouseCreateNameInput] = useState("");
  const [houseCreateLoading, setHouseCreateLoading] = useState(false);
  const [joinTokenInput, setJoinTokenInput] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [houseListError, setHouseListError] = useState("");
  const [inviteToken, setInviteToken] = useState("");

  const [activeUser, setActiveUser] = useState<CloudUserRow | null>(null);
  const [activeHouse, setActiveHouse] = useState<CloudHouseRow | null>(null);
  const [cachedHouseMeta, setCachedHouseMeta] = useState<CachedHouseMeta | null>(null);
  const [memberHouses, setMemberHouses] = useState<CloudHouseRow[]>([]);
  const [houseMembers, setHouseMembers] = useState<HouseMemberUser[]>([]);
  const [isHouseMembersLoading, setIsHouseMembersLoading] = useState(false);

  const [sections, setSections] = useState(initialSections);
  const [invitePhone, setInvitePhone] = useState("");
  const [homeLink, setHomeLink] = useState("");

  const [activeRecording, setActiveRecording] = useState<SectionKey | null>(null);
  const [processingRecording, setProcessingRecording] = useState<SectionKey | null>(null);
  const [voiceError, setVoiceError] = useState("");

  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [recipeText, setRecipeText] = useState("");
  const [recipeQuestions, setRecipeQuestions] = useState<RecipeQuestion[]>([]);
  const [recipeAnswers, setRecipeAnswers] = useState<Record<string, RecipeAnswerValue>>({});
  const [recipeItems, setRecipeItems] = useState<string[]>([]);
  const [recipeNotes, setRecipeNotes] = useState("");
  const [recipeError, setRecipeError] = useState("");
  const [isRecipeLoading, setIsRecipeLoading] = useState(false);
  const [recipeRecording, setRecipeRecording] = useState(false);
  const [dragOverlayItem, setDragOverlayItem] = useState<Item | null>(null);

  const [inputs, setInputs] = useState<Record<SectionKey, string>>({
    homeTasks: "",
    generalShopping: "",
    supermarketShopping: "",
  });

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptBufferRef = useRef("");
  const recordingSectionRef = useRef<SectionKey | null>(null);
  const shouldKeepRecordingRef = useRef(false);
  const recipeRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const userAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const userProfileImageInputRef = useRef<HTMLInputElement | null>(null);
  const desktopSearchRef = useRef<HTMLInputElement | null>(null);
  const sectionInputRefs = useRef<Record<SectionKey, HTMLInputElement | null>>({
    homeTasks: null,
    generalShopping: null,
    supermarketShopping: null,
  });
  const autoJoinFromLinkDoneRef = useRef(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAuthUserIdRef = useRef<string | null>(null);
  const initialSessionResolvedRef = useRef(false);
  const lastCloudApplyRef = useRef(0);
  const activeHouseRef = useRef<CloudHouseRow | null>(null);
  const activeUserRef = useRef<CloudUserRow | null>(null);
  const housesLoadRequestRef = useRef(0);
  const houseMembersRequestRef = useRef(0);
  const houseSaveRequestRef = useRef(0);
  const isHousePersistingRef = useRef(false);
  // True from the moment the user makes a local change until the save completes.
  // Blocks real-time / loadUserHouses from overwriting unsaved local state.
  const hasPendingLocalChangesRef = useRef(false);
  // When true, the sections useEffect saves immediately (0ms delay) instead of debouncing.
  const saveImmediatelyRef = useRef(false);
  // Incremented every time applyActiveHouse runs — lets the save effect
  // distinguish "triggered by cloud data" from "triggered by user action".
  const cloudApplyVersionRef = useRef(0);
  const lastSeenCloudVersionRef = useRef(0);
  // Tracks the updated_at of the last cloud snapshot we accepted.
  // Realtime events older than this are stale echoes and are discarded.
  const lastAcceptedCloudUpdatedAtRef = useRef("");
  const [isHouseLoading, setIsHouseLoading] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isMobile
        ? { delay: 180, tolerance: 6 }
        : { distance: 6 },
    }),
  );

  useEffect(() => {
    let cancelled = false;

    const restoreNativeBootstrapCache = async () => {
      try {
        const cachedUserRaw = await appCacheStorage.getItem(CACHED_USER_KEY);
        if (!cachedUserRaw || cancelled) return;
        const cachedUser = toCachedUser(JSON.parse(cachedUserRaw) as CloudUserRow);
        setActiveUser((current) => current || cachedUser);
        setIsAuthReady(true);
        setIsHouseLoading(true);

        const cachedHouseMetaRaw = await appCacheStorage.getItem(
          getCachedHouseMetaStorageKey(cachedUser.id),
        );
        if (cachedHouseMetaRaw && !cancelled) {
          const parsedHouseMeta = JSON.parse(cachedHouseMetaRaw) as CachedHouseMeta;
          setCachedHouseMeta((current) => current || parsedHouseMeta);

          const cachedMembersRaw = await appCacheStorage.getItem(
            getCachedHouseMembersStorageKey(parsedHouseMeta.id),
          );
          if (cachedMembersRaw && !cancelled) {
            const parsedMembers = JSON.parse(cachedMembersRaw) as HouseMemberUser[];
            if (Array.isArray(parsedMembers)) {
              setHouseMembers((current) => (current.length > 0 ? current : parsedMembers));
            }
          }
          // Restore cached list items for instant display before network loads.
          const cachedSectionsRaw = await appCacheStorage.getItem(
            getCachedHouseSectionsStorageKey(parsedHouseMeta.id),
          );
          if (cachedSectionsRaw && !cancelled) {
            try {
              const parsedSections = JSON.parse(cachedSectionsRaw) as Record<SectionKey, Item[]>;
              const normalized = normalizeCloudSections(parsedSections);
              setSections((current) => {
                const hasItems =
                  current.homeTasks.items.length > 0 ||
                  current.generalShopping.items.length > 0 ||
                  current.supermarketShopping.items.length > 0;
                if (hasItems) return current;
                return {
                  homeTasks: { ...initialSections.homeTasks, items: normalized.homeTasks },
                  generalShopping: { ...initialSections.generalShopping, items: normalized.generalShopping },
                  supermarketShopping: { ...initialSections.supermarketShopping, items: normalized.supermarketShopping },
                };
              });
            } catch {
              // Ignore malformed cached sections.
            }
          }
        }
      } catch {
        // Ignore native bootstrap cache errors.
      }
    };

    setHomeLink(getPublicAppOrigin());
    try {
      const cachedUserRaw = window.localStorage.getItem(CACHED_USER_KEY);
      const cachedUser = cachedUserRaw ? toCachedUser(JSON.parse(cachedUserRaw) as CloudUserRow) : null;

      if (cachedUser) {
        setActiveUser(cachedUser);
        setIsAuthReady(true);
        setIsHouseLoading(true);
        const cachedHouseMetaRaw = window.localStorage.getItem(
          getCachedHouseMetaStorageKey(cachedUser.id),
        );
        if (cachedHouseMetaRaw) {
          const parsedHouseMeta = JSON.parse(cachedHouseMetaRaw) as CachedHouseMeta;
          setCachedHouseMeta(parsedHouseMeta);
          const cachedMembersRaw = window.localStorage.getItem(
            getCachedHouseMembersStorageKey(parsedHouseMeta.id),
          );
          if (cachedMembersRaw) {
            const parsedMembers = JSON.parse(cachedMembersRaw) as HouseMemberUser[];
            if (Array.isArray(parsedMembers)) {
              setHouseMembers(parsedMembers);
            }
          }
          // Restore cached list items for instant display before network loads.
          const cachedSectionsRaw = window.localStorage.getItem(
            getCachedHouseSectionsStorageKey(parsedHouseMeta.id),
          );
          if (cachedSectionsRaw) {
            try {
              const parsedSections = JSON.parse(cachedSectionsRaw) as Record<SectionKey, Item[]>;
              const normalized = normalizeCloudSections(parsedSections);
              setSections({
                homeTasks: { ...initialSections.homeTasks, items: normalized.homeTasks },
                generalShopping: { ...initialSections.generalShopping, items: normalized.generalShopping },
                supermarketShopping: { ...initialSections.supermarketShopping, items: normalized.supermarketShopping },
              });
            } catch {
              // Ignore malformed cached sections.
            }
          }
        }
      } else {
        void restoreNativeBootstrapCache();
      }
    } catch {
      // Ignore corrupted local cache and continue with network auth bootstrap.
      void restoreNativeBootstrapCache();
    }
    if (window.location.hash.includes("type=recovery")) {
      setIsRecoveryMode(true);
    }
    const query = new URLSearchParams(window.location.search);
    const inviteFromUrl = query.get("invite")?.trim();
    const houseFromUrl = query.get("house")?.trim();
    const joinCodeFromUrl = inviteFromUrl || houseFromUrl;
    if (joinCodeFromUrl) {
      setJoinTokenInput(joinCodeFromUrl.toUpperCase());
      window.localStorage.setItem(PENDING_JOIN_CODE_KEY, joinCodeFromUrl.toUpperCase());
    }
    if (houseFromUrl) {
      window.localStorage.setItem(PENDING_JOIN_HOUSE_KEY, houseFromUrl.toUpperCase());
    }
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    setIsSpeechSupported(
      Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition),
    );

    const media = window.matchMedia("(max-width: 1023px)");
    const updateDeviceMode = () => setIsMobile(media.matches);
    updateDeviceMode();
    media.addEventListener("change", updateDeviceMode);

    return () => {
      cancelled = true;
      shouldKeepRecordingRef.current = false;
      media.removeEventListener("change", updateDeviceMode);
      recognitionRef.current?.stop();
      recipeRecognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;
    const userSelect = "id,username,display_name,avatar_url,auth_user_id";
    const clearAuthState = () => {
      housesLoadRequestRef.current += 1;
      houseMembersRequestRef.current += 1;
      const previousAuthId = activeAuthUserIdRef.current;
      activeAuthUserIdRef.current = null;
      setActiveUser(null);
      setActiveHouse(null);
      setCachedHouseMeta(null);
      setMemberHouses([]);
      setHouseMembers([]);
      setIsHouseMembersLoading(false);
      setIsHouseLoading(false);
      autoJoinFromLinkDoneRef.current = false;
      if (typeof window !== "undefined") {
        void removePersistentCacheValue(CACHED_USER_KEY);
        if (previousAuthId) {
          void removePersistentCacheValue(getCachedHouseMetaStorageKey(previousAuthId));
        }
        if (activeHouseRef.current?.id) {
          void removePersistentCacheValue(getCachedHouseSectionsStorageKey(activeHouseRef.current.id));
        }
      }
    };

    const findProfile = async (field: "auth_user_id" | "id", value: string) => {
      const { data, error } = await client
        .from("app_users")
        .select(userSelect)
        .eq(field, value)
        .order("created_at", { ascending: true })
        .limit(1);

      if (error) return null;
      return (data?.[0] as CloudUserRow | undefined) || null;
    };

    const getCachedUser = async () => {
      try {
        const localRaw =
          typeof window !== "undefined" ? window.localStorage.getItem(CACHED_USER_KEY) : null;
        const raw = localRaw || (await appCacheStorage.getItem(CACHED_USER_KEY));
        if (!raw) return null;
        return JSON.parse(raw) as CloudUserRow;
      } catch {
        return null;
      }
    };

    const resolveProfileFromAuth = async (authUser: User) => {
      const byAuth = await findProfile("auth_user_id", authUser.id);
      if (byAuth) return byAuth;

      const byId = await findProfile("id", authUser.id);
      if (byId) {
        if (byId.auth_user_id === authUser.id) return byId;
        const { data: updated } = await client
          .from("app_users")
          .update({ auth_user_id: authUser.id, password: "" })
          .eq("id", byId.id)
          .select(userSelect)
          .limit(1);
        return (updated?.[0] as CloudUserRow | undefined) || byId;
      }

      const metadata = (authUser.user_metadata || {}) as Record<string, unknown>;
      const usernameFromMetadata =
        typeof metadata.username === "string" ? normalizeUsername(metadata.username) : "";
      const usernameFromEmail = authUser.email ? normalizeUsername(authUser.email.split("@")[0]) : "";
      const baseUsername = usernameFromMetadata || usernameFromEmail || "user";
      const displayName =
        typeof metadata.display_name === "string" && metadata.display_name.trim().length > 0
          ? metadata.display_name.trim()
          : baseUsername;
      const avatarUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : "";
      const preferredUsername = baseUsername.slice(0, 24) || "user";
      const fallbackUsername = `${preferredUsername}${authUser.id.replace(/-/g, "").slice(0, 6)}`;

      const tryUpsert = async (username: string) => {
        const { error } = await client.from("app_users").upsert(
          {
            id: authUser.id,
            username,
            password: "",
            display_name: displayName,
            avatar_url: avatarUrl,
            auth_user_id: authUser.id,
          },
          { onConflict: "id" },
        );
        return !error;
      };

      const created = (await tryUpsert(preferredUsername)) || (await tryUpsert(fallbackUsername));
      if (!created) return null;

      return await findProfile("id", authUser.id);
    };

    const applyAuthUser = async (
      authUser: User | null,
      options?: { clearIfMissing?: boolean },
    ) => {
      if (cancelled) return;
      const shouldClear = options?.clearIfMissing ?? true;
      setIsAuthResolving(true);

      if (!authUser) {
        if (shouldClear) clearAuthState();
        setIsAuthResolving(false);
        return;
      }

      const cached = await getCachedUser();
      const cachedMatchesAuth =
        cached && (cached.id === authUser.id || cached.auth_user_id === authUser.id);

      if (cachedMatchesAuth) {
        activeAuthUserIdRef.current = cached.auth_user_id || cached.id;
        setIsHouseLoading(true);
        setActiveUser(cached);
        void loadUserHouses(cached.id);
      }

      const profile = await resolveProfileFromAuth(authUser);
      if (cancelled) return;
      if (!profile) {
        if (cachedMatchesAuth && cached) {
          activeAuthUserIdRef.current = cached.auth_user_id || cached.id;
          setIsAuthResolving(false);
          return;
        }
        if (shouldClear) clearAuthState();
        setIsAuthResolving(false);
        return;
      }

      activeAuthUserIdRef.current = profile.auth_user_id || profile.id;
      setActiveUser(profile);
      if (!cachedMatchesAuth || profile.id !== cached?.id) {
        setIsHouseLoading(true);
        // Keep the UI responsive and fetch house state in background.
        void loadUserHouses(profile.id);
      }
      setIsAuthResolving(false);
    };

    void client.auth
      .getSession()
      .then(async ({ data }) => {
        const hasCachedUser = Boolean(await getCachedUser());
        await applyAuthUser(data.session?.user || null, {
          clearIfMissing: !hasCachedUser,
        });
      })
      .finally(() => {
        initialSessionResolvedRef.current = true;
        if (!cancelled) setIsAuthReady(true);
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      }

      if (event === "INITIAL_SESSION") {
        return;
      }

      const nextAuthId = session?.user?.id || null;
      if (
        event === "SIGNED_IN" &&
        nextAuthId &&
        activeAuthUserIdRef.current &&
        nextAuthId === activeAuthUserIdRef.current
      ) {
        if (!cancelled) setIsAuthReady(true);
        return;
      }
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        // Token refresh / user metadata updates should never re-fetch house data or
        // overwrite local unsaved changes. Session validity is maintained by Supabase.
        if (!cancelled) setIsAuthReady(true);
        return;
      }

      // Only clear cached auth state on an explicit sign-out.
      // A failed token refresh should NOT log the user out.
      const clearIfMissing = event === "SIGNED_OUT";
      if (!cancelled) setIsAuthReady(false);
      void applyAuthUser(session?.user || null, { clearIfMissing }).finally(() => {
        if (!cancelled) setIsAuthReady(true);
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // loadUserHouses is intentionally captured once for initial auth bootstrap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep refs in sync so callbacks always see latest values.
  useEffect(() => {
    activeHouseRef.current = activeHouse;
  }, [activeHouse]);

  useEffect(() => {
    activeUserRef.current = activeUser;
  }, [activeUser]);

  useEffect(() => {
    const client = supabase;
    if (!activeHouse || !client) return;

    // Detect whether this effect run was triggered by cloud data (applyActiveHouse)
    // or by a real user action. The version counter is incremented in applyActiveHouse,
    // so if it changed since last time, this run is cloud-triggered — skip saving.
    const isFromCloudApply = cloudApplyVersionRef.current !== lastSeenCloudVersionRef.current;
    lastSeenCloudVersionRef.current = cloudApplyVersionRef.current;
    if (isFromCloudApply) {
      hasPendingLocalChangesRef.current = false;
      return;
    }

    // User made a local change — protect state from being overwritten.
    hasPendingLocalChangesRef.current = true;

    const delay = saveImmediatelyRef.current ? 0 : 500;
    saveImmediatelyRef.current = false;

    const timeout = setTimeout(async () => {
      const house = activeHouseRef.current;
      const user = activeUserRef.current;
      if (!house) return;

      const requestId = ++houseSaveRequestRef.current;
      isHousePersistingRef.current = true;
      const { error } = await client
        .from("houses")
        .update({
          name: house.name,
          sections: {
            homeTasks: sections.homeTasks.items,
            generalShopping: sections.generalShopping.items,
            supermarketShopping: sections.supermarketShopping.items,
          },
          invite_phone: invitePhone,
          house_image: house.house_image || "",
        })
        .eq("id", house.id);

      if (requestId !== houseSaveRequestRef.current) return;

      isHousePersistingRef.current = false;
      hasPendingLocalChangesRef.current = false;
      if (error) {
        setHouseListError("שמירת השינויים נכשלה, מנסה לרענן מהענן...");
        if (user?.id) {
          void loadUserHouses(user.id, house.id);
        }
        return;
      }

      setHouseListError("");
      // Cache sections for instant display on next app open.
      void setPersistentCacheValue(
        getCachedHouseSectionsStorageKey(house.id),
        JSON.stringify({
          homeTasks: sections.homeTasks.items,
          generalShopping: sections.generalShopping.items,
          supermarketShopping: sections.supermarketShopping.items,
        }),
      );
    }, delay);

    return () => {
      clearTimeout(timeout);
      // Do NOT reset hasPendingLocalChangesRef here — if the debounce was
      // interrupted by another user change, we still have unsaved state.
    };
    // activeHouse is intentionally not in deps to avoid save loops from cloud apply.
    // The ref is used inside the callback for fresh data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, invitePhone, activeHouse?.id]);

  useEffect(() => {
    if (!isSettingsOpen || !activeHouse) return;
    setSettingsHouseName(activeHouse.name);
    setSettingsHouseImage(activeHouse.house_image || "");
    setSettingsError("");
  }, [isSettingsOpen, activeHouse]);

  useEffect(() => {
    if (!isUserProfileOpen || !activeUser) return;
    setUserProfileName(activeUser.display_name || "");
    setUserProfileImage(activeUser.avatar_url || "");
    setUserProfileError("");
  }, [isUserProfileOpen, activeUser]);

  useEffect(() => {
    if (!isRecipeModalOpen) return;
    setRecipeText("");
    setRecipeQuestions([]);
    setRecipeAnswers({});
    setRecipeItems([]);
    setRecipeNotes("");
    setRecipeError("");
  }, [isRecipeModalOpen]);

  useEffect(() => {
    setInviteToken("");
    setInviteFeedback("");
  }, [activeHouse?.id]);

  useEffect(() => {
    activeAuthUserIdRef.current = activeUser?.auth_user_id || activeUser?.id || null;
  }, [activeUser?.auth_user_id, activeUser?.id]);

  useEffect(() => {
    if (typeof window === "undefined" || !isAuthReady) return;
    try {
      if (activeUser) {
        void setPersistentCacheValue(CACHED_USER_KEY, JSON.stringify(toCachedUser(activeUser)));
      } else {
        void removePersistentCacheValue(CACHED_USER_KEY);
      }
    } catch {
      // Ignore local storage errors.
    }
  }, [activeUser, isAuthReady]);

  useEffect(() => {
    if (typeof window === "undefined" || !isAuthReady || !activeUser?.id) return;
    try {
      if (activeHouse) {
        const meta = toCachedHouseMeta(activeHouse);
        setCachedHouseMeta(meta);
        void setPersistentCacheValue(getCachedHouseMetaStorageKey(activeUser.id), JSON.stringify(meta));
      }
    } catch {
      // Ignore local storage errors.
    }
  }, [activeUser?.id, activeHouse, isAuthReady]);

  useEffect(() => {
    if (typeof window === "undefined" || !isAuthReady || !activeUser?.id) return;
    const key = getSelectedHouseStorageKey(activeUser.id);
    if (activeHouse?.id) {
      void setPersistentCacheValue(key, activeHouse.id);
    } else if (!isHouseLoading) {
      void removePersistentCacheValue(key);
    }
  }, [activeUser?.id, activeHouse?.id, isAuthReady, isHouseLoading]);

  useEffect(() => {
    if (!activeHouse?.id) {
      houseMembersRequestRef.current += 1;
      setHouseMembers([]);
      setIsHouseMembersLoading(false);
      return;
    }
    void loadHouseMembers(activeHouse.id);
  }, [activeHouse?.id]);

  useEffect(() => {
    const client = supabase;
    if (!client || !activeHouse?.id) return;

    const houseId = activeHouse.id;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;
    let fallbackBootstrapTimeout: ReturnType<typeof setTimeout> | null = null;

    const startFallbackSync = () => {
      if (fallbackInterval) return;
      const userId = activeUserRef.current?.id;
      if (userId) {
        void loadUserHouses(userId, houseId, true);
      }
      fallbackInterval = setInterval(() => {
        const uid = activeUserRef.current?.id;
        if (uid) {
          void loadUserHouses(uid, houseId, true);
        }
      }, 30000);
    };

    const stopFallbackSync = () => {
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
    };

    const channel = client
      .channel(`homly-house-live-${houseId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "houses",
          filter: `id=eq.${houseId}`,
        },
        (payload) => {
          const next = payload.new as Partial<CloudHouseRow> | null;
          if (!next?.id) return;
          // Use refs for fresh values — the closure would otherwise see stale data.
          const currentHouse = activeHouseRef.current;
          const syncedHouse: CloudHouseRow = {
            id: String(next.id),
            name: String(next.name || currentHouse?.name || ""),
            pin: String(next.pin || currentHouse?.pin || ""),
            sections: normalizeCloudSections(
              (next.sections as Record<SectionKey, Item[]> | undefined) || currentHouse?.sections || null,
            ),
            invite_phone: String(next.invite_phone || currentHouse?.invite_phone || ""),
            house_image:
              typeof next.house_image === "string"
                ? next.house_image
                : (currentHouse?.house_image || ""),
            owner_user_id:
              typeof next.owner_user_id === "string"
                ? next.owner_user_id
                : (currentHouse?.owner_user_id ?? null),
            updated_at: typeof next.updated_at === "string" ? next.updated_at : currentHouse?.updated_at,
          };
          // Discard stale echoes: if the incoming event's updated_at is older than
          // (or equal to) the last snapshot we accepted, it's an out-of-order echo
          // from a previous save and must not overwrite local state.
          if (
            syncedHouse.updated_at &&
            lastAcceptedCloudUpdatedAtRef.current &&
            syncedHouse.updated_at <= lastAcceptedCloudUpdatedAtRef.current
          ) {
            return;
          }
          if (
            (isHousePersistingRef.current || hasPendingLocalChangesRef.current) &&
            currentHouse?.id === syncedHouse.id
          ) {
            setMemberHouses((prev) =>
              prev.map((house) => (house.id === syncedHouse.id ? { ...house, ...syncedHouse } : house)),
            );
            return;
          }
          applyActiveHouse(syncedHouse);
          setMemberHouses((prev) =>
            prev.map((house) => (house.id === syncedHouse.id ? syncedHouse : house)),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "house_members",
          filter: `house_id=eq.${houseId}`,
        },
        () => {
          const userId = activeUserRef.current?.id;
          if (userId) {
            void loadUserHouses(userId, houseId);
            void loadHouseMembers(houseId);
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (fallbackBootstrapTimeout) {
            clearTimeout(fallbackBootstrapTimeout);
            fallbackBootstrapTimeout = null;
          }
          stopFallbackSync();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          startFallbackSync();
        }
      });

    // On some iOS WebView setups realtime websocket can be flaky.
    // If channel doesn't subscribe quickly, keep data fresh via polling fallback.
    fallbackBootstrapTimeout = setTimeout(() => {
      startFallbackSync();
    }, 3000);

    return () => {
      if (fallbackBootstrapTimeout) {
        clearTimeout(fallbackBootstrapTimeout);
      }
      stopFallbackSync();
      void client.removeChannel(channel);
    };
    // applyActiveHouse and loadUserHouses are intentionally captured for live sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHouse?.id, activeUser?.id]);

  // Re-sync data and verify session when the app returns from background.
  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;

      // Verify the session is still valid.
      void client.auth.getSession().then(({ data }) => {
        if (!data.session && activeUserRef.current) {
          // Token expired while app was in background — try a silent refresh.
          void client.auth.refreshSession();
        }
      });

      // Refresh house data from the cloud.
      const userId = activeUserRef.current?.id;
      const houseId = activeHouseRef.current?.id;
      if (userId) {
        void loadUserHouses(userId, houseId);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capacitor Keyboard — keyboard avoidance
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import("@/lib/capacitor").then(({ setupKeyboardListeners }) => {
      setupKeyboardListeners(
        (height) => {
          document.documentElement.style.setProperty("--keyboard-height", `${height}px`);
          document.body.classList.add("keyboard-open");
        },
        () => {
          document.documentElement.style.setProperty("--keyboard-height", "0px");
          document.body.classList.remove("keyboard-open");
        }
      ).then((fn) => { cleanup = fn; });
    });
    return () => { cleanup?.(); };
  }, []);

  useEffect(() => {
    setInviteToken("");
    setInviteFeedback("");
  }, [activeHouse?.id]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const targetTag = target?.tagName?.toLowerCase();
      const isTypingField =
        targetTag === "input" ||
        targetTag === "textarea" ||
        targetTag === "select" ||
        target?.isContentEditable;

      if (event.key === "/") {
        event.preventDefault();
        desktopSearchRef.current?.focus();
        return;
      }

      if (isTypingField) return;

      if (!event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        if (event.key.toLowerCase() === "n") {
          event.preventDefault();
          sectionInputRefs.current.homeTasks?.focus();
          return;
        }
      }

      if (event.shiftKey && ["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        const sectionByShortcut: SectionKey[] = [
          "homeTasks",
          "generalShopping",
          "supermarketShopping",
        ];
        const section = sectionByShortcut[Number(event.key) - 1];
        const anchor = sectionAnchors[section];
        const node = document.getElementById(anchor);
        node?.scrollIntoView({ behavior: "smooth", block: "start" });
        sectionInputRefs.current[section]?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const parseRecordingWithAI = async (sectionKey: SectionKey, text: string) => {
    const fallbackItems = () => sanitizeItems(splitTranscriptToItems(text));

    try {
      const client = supabase;
      if (!client) return fallbackItems();
      const { data, error } = await client.functions.invoke("ai-parse-recording", {
        body: { sectionKey, text },
      });
      if (error || !data) return fallbackItems();
      const parsed = data as { items?: string[] };
      if (!Array.isArray(parsed.items) || parsed.items.length === 0) return fallbackItems();
      return sanitizeItems(parsed.items);
    } catch {
      return fallbackItems();
    }
  };

  const pushUndoState = (label: string) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoState({
      label,
      sections: cloneSections(sections),
    });
    undoTimerRef.current = setTimeout(() => {
      setUndoState(null);
    }, 5500);
  };

  const restoreUndo = () => {
    if (!undoState) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setSections(cloneSections(undoState.sections));
    setUndoState(null);
  };

  const addBatchItems = (key: SectionKey, items: string[], undoLabel = "נוספו פריטים") => {
    const cleanItems = items.map((item) => item.trim()).filter(Boolean);
    if (cleanItems.length === 0) return;
    pushUndoState(undoLabel);

    setSections((prev) => {
      const maxId =
        prev[key].items.length > 0
          ? Math.max(...prev[key].items.map((item) => item.id))
          : 0;

      const newItems = cleanItems.map((text, index) => ({
        id: maxId + index + 1,
        text,
        completed: false,
        createdByUserId: activeUser?.id,
        createdByName: activeUser?.display_name || "לא ידוע",
        createdAt: new Date().toISOString(),
      }));

      return {
        ...prev,
        [key]: {
          ...prev[key],
          items: [...newItems, ...prev[key].items],
        },
      };
    });
  };

  const finalizeRecording = async () => {
    const sectionKey = recordingSectionRef.current;
    const transcript = transcriptBufferRef.current;

    if (sectionKey && transcript) {
      setProcessingRecording(sectionKey);
      const parsedItems = await parseRecordingWithAI(sectionKey, transcript);
      addBatchItems(sectionKey, parsedItems, "נוספו פריטים מהקלטה");
      setProcessingRecording(null);
    }

    setActiveRecording(null);
    recordingSectionRef.current = null;
    transcriptBufferRef.current = "";
  };

  const startRecording = (key: SectionKey) => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };

    const RecognitionClass =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!RecognitionClass) {
      setVoiceError("הדפדפן לא תומך בהקלטת דיבור.");
      return;
    }

    setVoiceError("");
    transcriptBufferRef.current = "";
    shouldKeepRecordingRef.current = true;

    const recognition = new RecognitionClass();
    recognition.lang = "he-IL";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let fullText = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const segment = event.results[i]?.[0]?.transcript ?? "";
        fullText += `${segment} `;
      }
      transcriptBufferRef.current = fullText.trim();
    };

    recognition.onerror = (event) => {
      shouldKeepRecordingRef.current = false;
      setVoiceError(
        event.error === "not-allowed"
          ? "צריך לאשר הרשאת מיקרופון כדי להקליט."
          : "קרתה שגיאה בהקלטה. אפשר לנסות שוב.",
      );
    };

    recognition.onend = () => {
      if (shouldKeepRecordingRef.current) {
        recognition.start();
        return;
      }
      void finalizeRecording();
    };

    recognitionRef.current = recognition;
    recordingSectionRef.current = key;
    setActiveRecording(key);
    recognition.start();
  };

  const toggleRecording = (key: SectionKey) => {
    if (activeRecording === key) {
      shouldKeepRecordingRef.current = false;
      recognitionRef.current?.stop();
      return;
    }

    if (activeRecording && activeRecording !== key) {
      setVoiceError("יש הקלטה פעילה ברשימה אחרת. סיים אותה קודם.");
      return;
    }

    startRecording(key);
  };

  const toggleRecipeRecording = () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const RecognitionClass =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!RecognitionClass) {
      setRecipeError("הדפדפן לא תומך בהקלטה למתכון.");
      return;
    }

    if (recipeRecording) {
      recipeRecognitionRef.current?.stop();
      setRecipeRecording(false);
      return;
    }

    const recognition = new RecognitionClass();
    recognition.lang = "he-IL";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        text += `${event.results[i]?.[0]?.transcript ?? ""} `;
      }
      setRecipeText(text.trim());
    };

    recognition.onend = () => {
      setRecipeRecording(false);
    };

    recognition.onerror = () => {
      setRecipeRecording(false);
      setRecipeError("שגיאה בהקלטת מתכון. נסה שוב.");
    };

    recipeRecognitionRef.current = recognition;
    recognition.start();
    setRecipeRecording(true);
  };

  const handleAddItem = (key: SectionKey) => {
    const text = inputs[key].trim();
    if (!text) return;

    void hapticLight();
    addBatchItems(key, [text], "נוסף פריט");
    setInputs((prev) => ({ ...prev, [key]: "" }));
  };

  const handleSubmit = (event: { preventDefault(): void }, key: SectionKey) => {
    event.preventDefault();
    handleAddItem(key);
  };

  const toggleComplete = (key: SectionKey, id: number) => {
    const isCompleting = !sections[key].items.find((i) => i.id === id)?.completed;
    if (isCompleting) void hapticNotificationSuccess(); else void hapticLight();
    saveImmediatelyRef.current = true;
    pushUndoState("עודכן פריט");
    setSections((prev) => {
      const next = {
        ...prev,
        [key]: {
          ...prev[key],
          items: prev[key].items.map((item) =>
            item.id === id ? { ...item, completed: !item.completed } : item,
          ),
        },
      };
      if (activeHouseRef.current) {
        try {
          window.localStorage.setItem(
            getCachedHouseSectionsStorageKey(activeHouseRef.current.id),
            JSON.stringify({ homeTasks: next.homeTasks.items, generalShopping: next.generalShopping.items, supermarketShopping: next.supermarketShopping.items }),
          );
        } catch {}
      }
      return next;
    });
  };

  const editItem = (key: SectionKey, id: number) => {
    const currentItem = sections[key].items.find((item) => item.id === id);
    if (!currentItem) return;
    const nextText = window.prompt("עריכת פריט", currentItem.text);
    if (nextText === null) return;
    const normalized = nextText.trim();
    if (!normalized || normalized === currentItem.text) return;

    pushUndoState("נערך פריט");
    setSections((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        items: prev[key].items.map((item) =>
          item.id === id ? { ...item, text: normalized } : item,
        ),
      },
    }));
  };

  const deleteItem = (key: SectionKey, id: number) => {
    void hapticHeavy();
    saveImmediatelyRef.current = true;
    pushUndoState("נמחק פריט");
    setSections((prev) => {
      const next = {
        ...prev,
        [key]: {
          ...prev[key],
          items: prev[key].items.filter((item) => item.id !== id),
        },
      };
      if (activeHouseRef.current) {
        try {
          window.localStorage.setItem(
            getCachedHouseSectionsStorageKey(activeHouseRef.current.id),
            JSON.stringify({ homeTasks: next.homeTasks.items, generalShopping: next.generalShopping.items, supermarketShopping: next.supermarketShopping.items }),
          );
        } catch {}
      }
      return next;
    });
  };

  const getVisibleItems = (items: Item[]) =>
    items.filter((item) => {
      if (desktopFilter === "open" && item.completed) return false;
      if (desktopFilter === "done" && !item.completed) return false;
      if (!desktopQuery.trim()) return true;
      return item.text.toLowerCase().includes(desktopQuery.trim().toLowerCase());
    });

  const reorderWithinSection = (
    key: SectionKey,
    sourceItemId: number,
    targetItemId: number,
  ) => {
    if (sourceItemId === targetItemId) return;
    pushUndoState("שונה סדר פריטים");

    setSections((prev) => {
      const items = [...prev[key].items];
      const sourceIndex = items.findIndex((item) => item.id === sourceItemId);
      const targetIndex = items.findIndex((item) => item.id === targetItemId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;

      return {
        ...prev,
        [key]: {
          ...prev[key],
          items: arrayMove(items, sourceIndex, targetIndex),
        },
      };
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const parsed = fromSortableId(String(event.active.id));
    if (!parsed) return;

    const sectionItems = sections[parsed.sectionKey].items;
    const currentItem = sectionItems.find((item) => item.id === parsed.itemId) || null;
    setDragOverlayItem(currentItem);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeParsed = fromSortableId(String(event.active.id));
    const overParsed = event.over ? fromSortableId(String(event.over.id)) : null;
    setDragOverlayItem(null);

    if (!activeParsed || !overParsed) return;
    if (activeParsed.sectionKey !== overParsed.sectionKey) return;

    reorderWithinSection(
      activeParsed.sectionKey,
      activeParsed.itemId,
      overParsed.itemId,
    );
  };

  const handleDragCancel = () => {
    setDragOverlayItem(null);
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === "string" ? reader.result : "");
      };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });

  const optimizeImageFile = async (file: File, maxSize: number, quality: number) => {
    // Auto-convert HEIC/HEIF to JPEG for cross-browser support.
    let processFile = file;
    const isHeic =
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      /\.(heic|heif)$/i.test(file.name);
    if (isHeic) {
      try {
        const heic2any = (await import("heic2any")).default;
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
        processFile = new File(
          [converted as Blob],
          file.name.replace(/\.(heic|heif)$/i, ".jpg"),
          { type: "image/jpeg" },
        );
      } catch {
        // heic2any failed — fall through to canvas attempt (works on iOS Safari natively).
      }
    }

    const fallback = await readFileAsDataUrl(processFile);
    try {
      const objectUrl = URL.createObjectURL(processFile);
      const image = new window.Image();
      const loaded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("image-load-failed"));
      });
      image.src = objectUrl;
      await loaded;

      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) {
        URL.revokeObjectURL(objectUrl);
        return fallback;
      }

      const scale = Math.min(1, maxSize / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        return fallback;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);

      // Try progressively lower quality until under 200KB (~267K base64 chars).
      const MAX_CHARS = 270_000;
      let optimized = canvas.toDataURL("image/jpeg", quality);
      if (optimized.length > MAX_CHARS) {
        optimized = canvas.toDataURL("image/jpeg", 0.65);
      }
      if (optimized.length > MAX_CHARS) {
        optimized = canvas.toDataURL("image/jpeg", 0.45);
      }
      // Still too large — try at half the size.
      if (optimized.length > MAX_CHARS && canvas.width > 320) {
        const small = document.createElement("canvas");
        small.width = Math.round(canvas.width / 2);
        small.height = Math.round(canvas.height / 2);
        small.getContext("2d")?.drawImage(canvas, 0, 0, small.width, small.height);
        optimized = small.toDataURL("image/jpeg", 0.6);
      }
      if (!optimized || optimized.length > MAX_CHARS) return "";
      return optimized;
    } catch {
      // Fallback (original file) — only if within size limit.
      if (fallback.length > 270_000) return "";
      return fallback;
    }
  };

  // Uploads a base64 data-URL to Supabase Storage and returns the public URL.
  // Falls back to the original base64 value if the upload fails, so callers
  // always get a usable image string regardless of network state.
  const uploadImageToStorage = async (base64: string, path: string): Promise<string> => {
    const client = supabase;
    if (!client || !base64.startsWith("data:")) return base64;
    try {
      const [header, data] = base64.split(",");
      if (!data) return base64;
      const mime = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: mime });
      const { error } = await client.storage.from("homly-images").upload(path, blob, {
        contentType: mime,
        upsert: true,
      });
      if (error) return base64;
      const { data: urlData } = client.storage.from("homly-images").getPublicUrl(path);
      return urlData.publicUrl;
    } catch {
      return base64;
    }
  };

  const handleSettingsImageFile = async (file?: File) => {
    if (!file) return;
    setIsProcessingImage(true);
    setSettingsError("");
    const value = await optimizeImageFile(file, 1280, 0.8);
    setIsProcessingImage(false);
    if (!value) {
      setSettingsError("התמונה גדולה מדי או פגומה. נסה תמונה קטנה יותר (עד 5MB).");
      return;
    }
    setSettingsHouseImage(value);
  };

  const handleUserAvatarFile = async (file?: File) => {
    if (!file) return;
    setIsProcessingImage(true);
    const value = await optimizeImageFile(file, 640, 0.82);
    setIsProcessingImage(false);
    if (!value) {
      setUserProfileError("התמונה גדולה מדי או פגומה. נסה תמונה קטנה יותר (עד 5MB).");
      return;
    }
    setUserAvatarInput(value);
  };

  const openUserAvatarPicker = () => {
    userAvatarInputRef.current?.click();
  };

  const handleUserProfileImageFile = async (file?: File) => {
    if (!file) return;
    setIsProcessingImage(true);
    setUserProfileError("");
    const base64 = await optimizeImageFile(file, 640, 0.82);
    if (!base64) {
      setUserProfileError("התמונה גדולה מדי או פגומה. נסה תמונה קטנה יותר (עד 5MB).");
      setIsProcessingImage(false);
      return;
    }
    // Show preview immediately — no flash waiting for upload.
    setUserProfileImage(base64);
    // Upload to Storage in the background; replace base64 with the stable URL.
    const userId = activeUser?.id;
    if (userId) {
      const url = await uploadImageToStorage(base64, `avatars/${userId}.jpg`);
      setUserProfileImage(url);
    }
    setIsProcessingImage(false);
  };

  const openUserProfileImagePicker = () => {
    userProfileImageInputRef.current?.click();
  };

const saveUserProfileSettings = async () => {
    const client = supabase;
    if (!client || !activeUser) return;

    const nextName = userProfileName.trim();
    if (nextName.length < 2) {
      setUserProfileError("שם משתמש לתצוגה חייב להכיל לפחות 2 תווים.");
      return;
    }

    setIsSavingUserProfile(true);
    setUserProfileError("");

    // Upload avatar to Storage if it's still a base64 preview (same pattern as house image save).
    const finalAvatarUrl = await uploadImageToStorage(
      userProfileImage.trim(),
      `avatars/${activeUser.id}.jpg`,
    );
    if (finalAvatarUrl !== userProfileImage) setUserProfileImage(finalAvatarUrl);

    const { error } = await client
      .from("app_users")
      .update({
        display_name: nextName,
        avatar_url: finalAvatarUrl,
      })
      .eq("id", activeUser.id);

    if (error) {
      setUserProfileError("שמירת הפרופיל נכשלה. נסה שוב.");
      setIsSavingUserProfile(false);
      return;
    }

    setActiveUser((prev) =>
      prev
        ? {
            ...prev,
            display_name: nextName,
            avatar_url: finalAvatarUrl,
          }
        : prev,
    );

    setHouseMembers((prev) =>
      prev.map((member) =>
        member.id === activeUser.id
          ? { ...member, display_name: nextName, avatar_url: finalAvatarUrl }
          : member,
      ),
    );

    setSections((prev) => {
      const updateItems = (items: Item[]) =>
        items.map((item) =>
          item.createdByUserId === activeUser.id
            ? { ...item, createdByName: nextName }
            : item,
        );

      return {
        ...prev,
        homeTasks: { ...prev.homeTasks, items: updateItems(prev.homeTasks.items) },
        generalShopping: {
          ...prev.generalShopping,
          items: updateItems(prev.generalShopping.items),
        },
        supermarketShopping: {
          ...prev.supermarketShopping,
          items: updateItems(prev.supermarketShopping.items),
        },
      };
    });

    setIsSavingUserProfile(false);
    setIsUserProfileOpen(false);
  };

  const saveHouseSettings = async () => {
    if (!activeHouse) return;

    const nextName = settingsHouseName.trim();
    if (nextName.length < 2) {
      setSettingsError("שם בית חייב להכיל לפחות 2 תווים.");
      return;
    }

    setIsSavingSettings(true);
    setSettingsError("");

    const client = supabase;
    if (!client) {
      setIsSavingSettings(false);
      return;
    }

    const { data: duplicate, error: duplicateError } = await client
      .from("houses")
      .select("id")
      .eq("name", nextName)
      .neq("id", activeHouse.id)
      .maybeSingle();

    if (duplicateError) {
      setSettingsError("שמירת ההגדרות נכשלה. נסה שוב.");
      setIsSavingSettings(false);
      return;
    }

    if (duplicate) {
      setSettingsError("שם הבית כבר תפוס. בחר שם אחר.");
      setIsSavingSettings(false);
      return;
    }

    // Upload house image to Storage if it's still a base64 preview.
    const finalHouseImage = await uploadImageToStorage(
      settingsHouseImage.trim(),
      `houses/${activeHouse.id}.jpg`,
    );

    // Persist name + image to DB immediately (don't rely on the sections save effect).
    const { error: updateError } = await client
      .from("houses")
      .update({ name: nextName, house_image: finalHouseImage })
      .eq("id", activeHouse.id);

    if (updateError) {
      setSettingsError("שמירת ההגדרות נכשלה. נסה שוב.");
      setIsSavingSettings(false);
      return;
    }

    setActiveHouse((prev) =>
      prev ? { ...prev, name: nextName, house_image: finalHouseImage } : prev,
    );
    setSettingsHouseImage(finalHouseImage);
    setIsSavingSettings(false);
    setIsSettingsOpen(false);
  };

  const deleteActiveHouse = async () => {
    const client = supabase;
    if (!client || !activeHouse || !activeUser) return;

    const isOwner = activeHouse.owner_user_id === activeUser.id;
    if (!isOwner) {
      setSettingsError("רק בעל הבית יכול למחוק את הבית.");
      return;
    }

    const confirmed = window.confirm("למחוק את הבית לצמיתות? כל הרשימות והחברים יימחקו.");
    if (!confirmed) return;

    setIsDeletingHouse(true);
    setSettingsError("");

    const { error } = await client.from("houses").delete().eq("id", activeHouse.id);
    if (error) {
      setSettingsError("מחיקת הבית נכשלה. נסה שוב.");
      setIsDeletingHouse(false);
      return;
    }

    window.localStorage.removeItem(getSelectedHouseStorageKey(activeUser.id));
    setIsSettingsOpen(false);
    setInviteToken("");
    await loadUserHouses(activeUser.id);
    setIsDeletingHouse(false);
  };

  const runRecipeFallback = () => {
    const hasAnswer = (questionId: string) =>
      !isRecipeAnswerMissing(
        { id: questionId, title: questionId, kind: "text" },
        recipeAnswers[questionId],
      );
    const answerValues = (questionId: string) => getRecipeAnswerValues(recipeAnswers[questionId]);

    const q: RecipeQuestion[] = [];
    if (!/\d/.test(recipeText) && !hasAnswer("servings")) {
      q.push({
        id: "servings",
        title: "לכמה אנשים המתכון?",
        kind: "single",
        options: ["2", "4", "6", "8"],
      });
    }
    if (/פסטה|רוטב|לזניה/.test(recipeText) && !hasAnswer("sauce")) {
      q.push({
        id: "sauce",
        title: "איזה רוטב תרצה?",
        kind: "single",
        options: ["עגבניות", "שמנת", "פסטו"],
      });
    }
    if (/ירקות|סלט|מוקפץ|מרק ירקות/.test(recipeText) && answerValues("vegetables").length === 0) {
      q.push({
        id: "vegetables",
        title: "איזה ירקות להוסיף? (אפשר לבחור כמה)",
        kind: "multi",
        options: ["עגבנייה", "מלפפון", "גזר", "פלפל", "בצל", "קישוא", "פטריות", "ברוקולי"],
        maxSelections: 6,
      });
    }
    if (q.length > 0) {
      setRecipeQuestions(normalizeRecipeQuestions(q));
      setRecipeItems([]);
      setRecipeNotes("");
      return;
    }

    const base = splitTranscriptToItems(recipeText);
    const items = new Set<string>(base);
    if (/עוף/.test(recipeText)) {
      items.add("חזה עוף");
      items.add("שום");
      items.add("שמן זית");
    }
    if (/פסטה/.test(recipeText)) {
      items.add("פסטה");
      if (answerValues("sauce").includes("שמנת")) items.add("שמנת לבישול");
      if (answerValues("sauce").includes("עגבניות") || !hasAnswer("sauce")) {
        items.add("רוטב עגבניות");
      }
    }
    if (/סלט/.test(recipeText)) {
      items.add("עגבניות");
      items.add("מלפפון");
      items.add("לימון");
    }
    answerValues("vegetables").forEach((vegetable) => items.add(vegetable));
    setRecipeQuestions([]);
    setRecipeItems(Array.from(items));
    setRecipeNotes("הרשימה הופקה במצב חכם מקומי.");
  };

  const runRecipeAi = async () => {
    if (!recipeText.trim()) return;
    if (recipeQuestions.length > 0) {
      const missingQuestion = recipeQuestions.find((question) =>
        isRecipeAnswerMissing(question, recipeAnswers[question.id]),
      );
      if (missingQuestion) {
        setRecipeError("יש להשלים תשובה לכל השאלות לפני המשך ניתוח.");
        return;
      }
    }

    setIsRecipeLoading(true);
    setRecipeError("");
    setRecipeNotes("");

    const applyParsedRecipeResult = (parsed: RecipeAiResponse) => {
      if (
        typeof parsed.needs_clarification !== "boolean" ||
        !Array.isArray(parsed.questions) ||
        !Array.isArray(parsed.items)
      ) {
        return false;
      }

      const normalizedQuestions = normalizeRecipeQuestions(parsed.questions);
      if (parsed.needs_clarification) {
        if (normalizedQuestions.length === 0) {
          return false;
        }
        setRecipeQuestions(normalizedQuestions);
        setRecipeItems([]);
        setRecipeNotes("");
        return true;
      }

      const mapped = Array.from(
        new Set(
          parsed.items
            .map((item) => (item.amount ? `${item.name} - ${item.amount}` : item.name))
            .map((item) => item.trim()),
        ),
      ).filter(Boolean);
      if (mapped.length === 0) {
        return false;
      }

      setRecipeQuestions([]);
      setRecipeNotes(parsed.source === "fallback" ? parsed.notes || "בוצע ניתוח חלופי." : parsed.notes || "");
      setRecipeItems(mapped);
      return true;
    };

    try {
      const client = supabase;
      if (!client) {
        runRecipeFallback();
        setIsRecipeLoading(false);
        return;
      }
      const { data, error } = await client.functions.invoke("ai-recipe", {
        body: { recipeText, answers: recipeAnswers },
      });
      if (error || !data) {
        runRecipeFallback();
        setRecipeError("לא הצלחתי לנתח את המתכון כרגע.");
        setIsRecipeLoading(false);
        return;
      }
      const parsed = data as RecipeAiResponse;
      const successFromApi = applyParsedRecipeResult(parsed);
      if (!successFromApi) {
        runRecipeFallback();
        setRecipeError("לא התקבלו רכיבים מספקים, עברתי למצב חלופי.");
      }
    } catch {
      runRecipeFallback();
      setRecipeError("ניתוח ענן נכשל, עברתי למצב חכם חלופי.");
    } finally {
      setIsRecipeLoading(false);
    }
  };

  const addRecipeItemsToSupermarket = () => {
    addBatchItems("supermarketShopping", recipeItems, "נוספו פריטי מתכון");
    setRecipeItems([]);
    setRecipeQuestions([]);
    setRecipeAnswers({});
    setRecipeText("");
    setIsRecipeModalOpen(false);
  };

  const applyActiveHouse = (house: CloudHouseRow) => {
    const normalizedSections = normalizeCloudSections(house.sections);
    const normalizedHouse = { ...house, sections: normalizedSections };
    // Mark timestamp + increment version so the save effect knows this run
    // was triggered by cloud data (not a user action).
    lastCloudApplyRef.current = Date.now();
    cloudApplyVersionRef.current++;
    if (house.updated_at) {
      lastAcceptedCloudUpdatedAtRef.current = house.updated_at;
    }

    if (hasPendingLocalChangesRef.current) {
      // User has unsaved local changes — update only house metadata, never the list items.
      setActiveHouse((prev) =>
        prev
          ? {
              ...prev,
              name: normalizedHouse.name,
              pin: normalizedHouse.pin,
              house_image: normalizedHouse.house_image,
              invite_phone: normalizedHouse.invite_phone,
              owner_user_id: normalizedHouse.owner_user_id,
              updated_at: normalizedHouse.updated_at,
            }
          : normalizedHouse,
      );
      return;
    }

    setActiveHouse(normalizedHouse);
    setSections({
      homeTasks: { ...initialSections.homeTasks, items: normalizedSections.homeTasks },
      generalShopping: {
        ...initialSections.generalShopping,
        items: normalizedSections.generalShopping,
      },
      supermarketShopping: {
        ...initialSections.supermarketShopping,
        items: normalizedSections.supermarketShopping,
      },
    });
    setInvitePhone(house.invite_phone || "");
  };

  const loadHouseMembers = async (houseId: string) => {
    const client = supabase;
    if (!client) return;

    const requestId = ++houseMembersRequestRef.current;
    const shouldShowLoading = !(activeHouse?.id === houseId && houseMembers.length > 0);
    setIsHouseMembersLoading(shouldShowLoading);
    const loadingGuard = setTimeout(() => {
      if (requestId === houseMembersRequestRef.current) {
        setIsHouseMembersLoading(false);
      }
    }, 3500);
    const cacheKey = getCachedHouseMembersStorageKey(houseId);
    try {
      const localRaw =
        typeof window !== "undefined" ? window.localStorage.getItem(cacheKey) : null;
      const nativeRaw = localRaw || (await appCacheStorage.getItem(cacheKey));
      if (nativeRaw) {
        const cachedMembers = toCachedHouseMembers(JSON.parse(nativeRaw) as HouseMemberUser[]);
        if (Array.isArray(cachedMembers) && cachedMembers.length > 0) {
          setHouseMembers(cachedMembers);
          setIsHouseMembersLoading(false);
        }
      }
    } catch {
      // Ignore malformed cached house members.
    }
    // Single JOIN query instead of two sequential round-trips.
    const { data: membersData, error: membersError } = await client
      .from("house_members")
      .select("role, user_id, app_users!house_members_user_id_fkey(id, display_name, avatar_url)")
      .eq("house_id", houseId);

    if (requestId !== houseMembersRequestRef.current) {
      clearTimeout(loadingGuard);
      return;
    }

    if (membersError || !membersData) {
      clearTimeout(loadingGuard);
      setIsHouseMembersLoading(false);
      return;
    }

    if (membersData.length === 0) {
      setHouseMembers([]);
      void setPersistentCacheValue(cacheKey, JSON.stringify([]));
      clearTimeout(loadingGuard);
      setIsHouseMembersLoading(false);
      return;
    }

    const members = membersData
      .map((row) => {
        const rawUser = row.app_users;
        const user = (Array.isArray(rawUser) ? rawUser[0] : rawUser) as { id: string; display_name: string; avatar_url: string } | null;
        if (!user) return null;
        return {
          id: user.id,
          display_name: String(user.display_name || "משתמש"),
          avatar_url: String(user.avatar_url || ""),
          role: (row.role as "owner" | "member") || "member",
        };
      })
      .filter((member): member is HouseMemberUser => Boolean(member));

    // Set full data in state (with base64 avatars) — strip only for the cache.
    setHouseMembers(members);
    void setPersistentCacheValue(cacheKey, JSON.stringify(toCachedHouseMembers(members)));
    clearTimeout(loadingGuard);
    setIsHouseMembersLoading(false);
  };

  const loadUserHouses = async (userId: string, preferredHouseId?: string, silent?: boolean) => {
    const client = supabase;
    if (!client) return;
    const requestId = ++housesLoadRequestRef.current;
    if (!silent) setIsHouseLoading(true);

    const { data: membershipData, error: membershipError } = await client
      .from("house_members")
      .select("house_id,user_id,role")
      .eq("user_id", userId);

    if (requestId !== housesLoadRequestRef.current) return;

    if (membershipError || !membershipData || membershipData.length === 0) {
      if (!silent) {
        setMemberHouses([]);
        setActiveHouse(null);
        setHouseMembers([]);
        if (typeof window !== "undefined") {
          void removePersistentCacheValue(getSelectedHouseStorageKey(userId));
        }
        setIsHouseLoading(false);
      }
      return;
    }

    const houseIds = Array.from(new Set(membershipData.map((member) => member.house_id)));
    const { data: housesData, error: housesError } = await client
      .from("houses")
      .select("id,name,pin,sections,invite_phone,house_image,owner_user_id,updated_at")
      .in("id", houseIds)
      .order("updated_at", { ascending: false });

    if (requestId !== housesLoadRequestRef.current) return;

    if (housesError || !housesData) {
      if (!silent) {
        setHouseListError("לא הצלחתי לטעון את הבתים שלך.");
        setIsHouseLoading(false);
      }
      return;
    }

    const houses = housesData as CloudHouseRow[];
    setMemberHouses(houses);
    const selectedHouseKey = getSelectedHouseStorageKey(userId);
    const selectedHouseFromStorage =
      (typeof window !== "undefined"
        ? window.localStorage.getItem(selectedHouseKey) || undefined
        : undefined) || (await appCacheStorage.getItem(selectedHouseKey)) || undefined;
    const preferredHouse = preferredHouseId || selectedHouseFromStorage;

    const nextHouse =
      houses.find((house) => house.id === preferredHouse) ||
      (activeHouse ? houses.find((house) => house.id === activeHouse.id) : null) ||
      houses[0];

    if (nextHouse) {
      if (
        (isHousePersistingRef.current || hasPendingLocalChangesRef.current) &&
        activeHouse?.id === nextHouse.id
      ) {
        if (!silent) setIsHouseLoading(false);
        return;
      }
      applyActiveHouse(nextHouse);
      if (!silent) void loadHouseMembers(nextHouse.id);
    } else {
      if (!silent) setActiveHouse(null);
    }
    if (!silent) setIsHouseLoading(false);
  };

  const handleCreateUser = async () => {
    const client = supabase;
    if (!client) return;

    const username = normalizeUsername(usernameInput);
    const email = emailInput.trim().toLowerCase();
    const password = userPasswordInput.trim();
    const displayName = displayNameInput.trim();
    const avatarUrl = userAvatarInput.trim();

    if (username.length < 3) {
      setAuthError("שם משתמש חייב להכיל לפחות 3 תווים.");
      return;
    }
    if (!isValidEmail(email)) {
      setAuthError("יש להזין אימייל תקין.");
      return;
    }
    if (password.length < 4) {
      setAuthError("סיסמה חייבת להיות לפחות 4 תווים.");
      return;
    }
    if (displayName.length < 2) {
      setAuthError("שם מלא חייב להכיל לפחות 2 תווים.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");

    const { data: signUpData, error: signUpError } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: displayName,
        },
      },
    });

    if (signUpError && !/already registered/i.test(signUpError.message)) {
      setAuthError("יצירת משתמש נכשלה. נסה שוב.");
      setAuthLoading(false);
      return;
    }

    if (signUpError && /already registered/i.test(signUpError.message)) {
      setAuthError("האימייל כבר רשום במערכת. נסה להתחבר או לאפס סיסמה.");
      setAuthLoading(false);
      return;
    }

    // Supabase may obfuscate existing-user signups with no explicit error.
    if (
      !signUpError &&
      Array.isArray(signUpData?.user?.identities) &&
      signUpData.user.identities.length === 0
    ) {
      setAuthError("האימייל כבר רשום במערכת. נסה להתחבר או לאפס סיסמה.");
      setAuthLoading(false);
      return;
    }

    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.user) {
      setAuthError("יצירת משתמש הושלמה חלקית, אבל לא הצלחתי להתחבר. נסה שוב.");
      setAuthLoading(false);
      return;
    }

    const authUserId = signInData.user.id;
    // User is now authenticated — upload avatar to Storage if it's a base64 preview.
    const finalAvatarUrl = await uploadImageToStorage(avatarUrl, `avatars/${authUserId}.jpg`);
    const { data: insertedUser, error: insertError } = await client
      .from("app_users")
      .insert({
        id: authUserId,
        username,
        password: "",
        display_name: displayName,
        avatar_url: finalAvatarUrl,
        auth_user_id: authUserId,
      })
      .select("id,username,display_name,avatar_url,auth_user_id")
      .single();

    let nextUser: CloudUserRow | null = null;
    let createFailureMessage = "נוצר משתמש אבל שמירת פרופיל נכשלה. נסה שוב.";
    if (!insertError && insertedUser) {
      nextUser = insertedUser as CloudUserRow;
    } else {
      const { data: existingProfile } = await client
        .from("app_users")
        .select("id,username,display_name,avatar_url,auth_user_id")
        .eq("username", username)
        .maybeSingle();

      if (existingProfile && !existingProfile.auth_user_id) {
        const { data: migratedProfile, error: migrateError } = await client
          .from("app_users")
          .update({
            auth_user_id: authUserId,
            password: "",
            display_name: displayName,
            avatar_url: finalAvatarUrl,
          })
          .eq("id", existingProfile.id)
          .select("id,username,display_name,avatar_url,auth_user_id")
          .maybeSingle();

        if (!migrateError && migratedProfile) {
          nextUser = migratedProfile as CloudUserRow;
        }
      } else if (existingProfile?.auth_user_id) {
        createFailureMessage = "שם המשתמש כבר קיים. בחר שם משתמש אחר.";
      }
    }

    if (!nextUser) {
      await client.auth.signOut();
      setAuthError(createFailureMessage);
      setAuthLoading(false);
      return;
    }

    setActiveUser(nextUser);
    setIsHouseLoading(true);
    setAuthLoading(false);
    setAuthError("");
    setEmailInput("");
    setUserPasswordInput("");
    await loadUserHouses(nextUser.id);
  };

  const handleLoginUser = async () => {
    const client = supabase;
    if (!client) return;

    const identifier = usernameInput.trim().toLowerCase();
    const password = userPasswordInput.trim();
    if (!identifier || !password) {
      setAuthError("יש להזין אימייל וסיסמה.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");

    const email = getAuthEmailFromUsername(identifier);
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.user) {
      setAuthError("אימייל או סיסמה לא נכונים.");
      setAuthLoading(false);
      return;
    }

    const authUserId = signInData.user.id;
    let user: CloudUserRow | null = null;

    const { data: profileByAuth, error: profileByAuthError } = await client
      .from("app_users")
      .select("id,username,display_name,avatar_url,auth_user_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (!profileByAuthError && profileByAuth) {
      user = profileByAuth as CloudUserRow;
    } else {
      const legacyUsername = identifier.includes("@") ? "" : normalizeUsername(identifier);
      const { data: profileByUsername, error: profileByUsernameError } = await client
        .from("app_users")
        .select("id,username,display_name,avatar_url,auth_user_id")
        .eq("username", legacyUsername)
        .maybeSingle();

      if (!profileByUsernameError && profileByUsername && !profileByUsername.auth_user_id) {
        const { data: updatedProfile, error: updateProfileError } = await client
          .from("app_users")
          .update({
            auth_user_id: authUserId,
            password: "",
          })
          .eq("id", profileByUsername.id)
          .select("id,username,display_name,avatar_url,auth_user_id")
          .maybeSingle();

        if (!updateProfileError && updatedProfile) {
          user = updatedProfile as CloudUserRow;
        }
      }
    }

    if (!user) {
      setAuthError("התחברת, אבל לא נמצא פרופיל משתמש. נסה ליצור משתמש חדש.");
      setAuthLoading(false);
      return;
    }

    setActiveUser(user);
    setIsHouseLoading(true);
    setAuthLoading(false);
    setUserPasswordInput("");
    await loadUserHouses(user.id);
    // רישום Push Notification token לאחר כניסה
    void registerPushToken(user.id);
  };

  const registerPushToken = async (userId: string) => {
    const client = supabase;
    if (!client) return;
    const { requestPushPermission } = await import("@/lib/capacitor");
    const token = await requestPushPermission();
    if (!token) return;
    await client.from("push_tokens").upsert(
      { user_id: userId, token, platform: "ios", updated_at: new Date().toISOString() },
      { onConflict: "user_id,token" }
    );
  };

  const handleForgotPassword = async () => {
    const client = supabase;
    if (!client) return;

    const identifier = forgotPasswordIdentifier.trim().toLowerCase();
    if (!identifier) {
      setForgotPasswordError("יש להזין אימייל.");
      return;
    }
    if (!identifier.includes("@") || !isValidEmail(identifier)) {
      setForgotPasswordError("לאיפוס סיסמה חייבים להזין אימייל תקין.");
      return;
    }

    setIsForgotPasswordLoading(true);
    setForgotPasswordError("");
    setForgotPasswordFeedback("");

    const redirectTo = homeLink || getPublicAppOrigin();
    const { error } = await client.auth.resetPasswordForEmail(identifier, { redirectTo });

    if (error) {
      setForgotPasswordError("לא הצלחתי לשלוח קישור איפוס כרגע.");
      setIsForgotPasswordLoading(false);
      return;
    }

    setForgotPasswordFeedback("אם המשתמש קיים, נשלח קישור איפוס סיסמה לאימייל.");
    setIsForgotPasswordLoading(false);
  };

  const handleRecoveryPasswordUpdate = async () => {
    const client = supabase;
    if (!client) return;

    const password = recoveryPasswordInput.trim();
    const confirm = recoveryPasswordConfirmInput.trim();

    if (password.length < 6) {
      setRecoveryPasswordError("סיסמה חדשה חייבת להכיל לפחות 6 תווים.");
      return;
    }
    if (password !== confirm) {
      setRecoveryPasswordError("אימות הסיסמה לא תואם.");
      return;
    }

    setIsRecoveryPasswordLoading(true);
    setRecoveryPasswordError("");
    setRecoveryPasswordFeedback("");

    const { error } = await client.auth.updateUser({ password });
    if (error) {
      setRecoveryPasswordError("לא הצלחתי לעדכן סיסמה. נסה שוב.");
      setIsRecoveryPasswordLoading(false);
      return;
    }

    await client.auth.signOut();
    setRecoveryPasswordFeedback("הסיסמה עודכנה בהצלחה. אפשר להתחבר עם הסיסמה החדשה.");
    setIsRecoveryMode(false);
    setRecoveryPasswordInput("");
    setRecoveryPasswordConfirmInput("");
    if (window.location.hash) {
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
    }
    setIsRecoveryPasswordLoading(false);
  };

  const handleCreateHouse = async () => {
    const client = supabase;
    if (!client || !activeUser) return;

    const houseName = houseCreateNameInput.trim();
    if (houseName.length < 2) {
      setHouseListError("שם בית חייב להכיל לפחות 2 תווים.");
      return;
    }

    setHouseCreateLoading(true);
    setHouseListError("");

    const houseId = Math.random().toString(36).slice(2, 8).toUpperCase();
    const sectionsData = getDefaultSectionItems();

    const { error: houseError } = await client.from("houses").insert({
      id: houseId,
      name: houseName,
      pin: "",
      owner_user_id: activeUser.id,
      sections: sectionsData,
      invite_phone: "",
      house_image: "",
    });

    if (houseError) {
      setHouseListError("יצירת בית נכשלה. נסה שוב.");
      setHouseCreateLoading(false);
      return;
    }

    await client.from("house_members").upsert(
      {
        house_id: houseId,
        user_id: activeUser.id,
        role: "owner",
      },
      {
        onConflict: "house_id,user_id",
      },
    );

    setHouseCreateNameInput("");
    setHouseCreateLoading(false);
    await loadUserHouses(activeUser.id, houseId);
  };

  const handleJoinHouseByToken = async (overrideCode?: string, fallbackHouseCode?: string) => {
    const client = supabase;
    if (!client || !activeUser) return false;
    const rawCode = (overrideCode ?? joinTokenInput).trim().toUpperCase();
    const normalizedFallbackHouseCode = fallbackHouseCode?.trim().toUpperCase() || "";
    if (!rawCode && !normalizedFallbackHouseCode) {
      setHouseListError("יש להזין קוד הזמנה.");
      return false;
    }

    setJoinLoading(true);
    setHouseListError("");

    const { data, error } = await client.rpc("join_house_by_token", {
      p_token: rawCode,
      p_house_id: normalizedFallbackHouseCode,
    });

    if (error || !data) {
      setHouseListError("קוד ההזמנה לא תקין או שלא ניתן להצטרף כרגע.");
      setJoinLoading(false);
      return false;
    }

    const result = data as { house_id?: string; error?: string; already_member?: boolean };

    if (result.error) {
      setHouseListError("קוד ההזמנה לא תקין או שלא ניתן להצטרף כרגע.");
      setJoinLoading(false);
      return false;
    }

    const targetHouseId = result.house_id ?? "";
    setJoinTokenInput("");
    setJoinLoading(false);
    if (window.location.search.includes("invite=") || window.location.search.includes("house=")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    await loadUserHouses(activeUser.id, targetHouseId);
    return true;
  };

  useEffect(() => {
    if (!activeUser || autoJoinFromLinkDoneRef.current) return;
    const query = new URLSearchParams(window.location.search);
    const inviteFromUrl = query.get("invite")?.trim().toUpperCase() || "";
    const houseFromUrl = query.get("house")?.trim().toUpperCase() || "";
    const pendingCodeFromStorage = window.localStorage.getItem(PENDING_JOIN_CODE_KEY) || "";
    const pendingHouseFromStorage = window.localStorage.getItem(PENDING_JOIN_HOUSE_KEY) || "";
    const code = inviteFromUrl || houseFromUrl || pendingCodeFromStorage;
    const fallbackHouse = houseFromUrl || pendingHouseFromStorage;
    if (!code) return;

    autoJoinFromLinkDoneRef.current = true;
    void handleJoinHouseByToken(code, fallbackHouse).then((ok) => {
      if (ok) {
        window.localStorage.removeItem(PENDING_JOIN_CODE_KEY);
        window.localStorage.removeItem(PENDING_JOIN_HOUSE_KEY);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser?.id]);

  const removeMember = async (memberId: string) => {
    const client = supabase;
    if (!client || !activeHouse || !activeUser) return;
    if (activeHouse.owner_user_id !== activeUser.id) return;
    if (memberId === activeUser.id) return;
    const { error } = await client
      .from("house_members")
      .delete()
      .eq("house_id", activeHouse.id)
      .eq("user_id", memberId);
    if (!error) {
      await loadHouseMembers(activeHouse.id);
    }
  };

  const leaveHouse = async () => {
    const client = supabase;
    if (!client || !activeHouse || !activeUser) return;
    if (activeHouse.owner_user_id === activeUser.id) return;
    const { error } = await client
      .from("house_members")
      .delete()
      .eq("house_id", activeHouse.id)
      .eq("user_id", activeUser.id);
    if (!error) {
      setIsSettingsOpen(false);
      const otherHouse = memberHouses.find((h) => h.id !== activeHouse.id);
      await loadUserHouses(activeUser.id, otherHouse?.id);
    }
  };

  const openInviteModal = async () => {
    const client = supabase;
    if (!client || !activeHouse || !activeUser) return;

    setInviteFeedback("");
    setInviteToken("");
    setInviteByUserLoading(false);
    setIsInviteModalOpen(true);
    const { data: existingInvite } = await client
      .from("house_invites")
      .select("token")
      .eq("house_id", activeHouse.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingInvite?.token) {
      setInviteToken(existingInvite.token);
      return;
    }

    let createdToken = "";
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const token = createInviteToken();
      const { error } = await client.from("house_invites").insert({
        token,
        house_id: activeHouse.id,
        created_by_user_id: activeUser.id,
      });
      if (!error) {
        createdToken = token;
        break;
      }
    }

    if (!createdToken) {
      setInviteFeedback("לא הצלחתי ליצור קישור הזמנה.");
      return;
    }
    setInviteToken(createdToken);
  };

  const normalizedPhone = invitePhone.replace(/[^\d+]/g, "");
  const inviteLink = (() => {
    if (!homeLink || !activeHouse) return homeLink;
    const url = new URL(homeLink);
    url.searchParams.set("house", activeHouse.id);
    if (inviteToken) url.searchParams.set("invite", inviteToken);
    return url.toString();
  })();
  const inviteMessage = inviteLink
    ? `היי, מזמין אותך לבית שלי ב-Homly. זה לינק הצטרפות: ${inviteLink}`
    : "היי, מזמין אותך לבית שלי ב-Homly.";
  const smsHref = `sms:${normalizedPhone}?body=${encodeURIComponent(inviteMessage)}`;

  const shareInviteLink = async () => {
    if (!inviteLink) return;
    void hapticLight();
    try {
      await nativeShare({ title: "Homly", text: inviteMessage, url: inviteLink });
      setInviteFeedback("הלינק שותף בהצלחה.");
    } catch {
      setInviteFeedback("לא הצלחתי לשתף כרגע.");
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteFeedback("הלינק הועתק ללוח.");
    } catch {
      setInviteFeedback("לא הצלחתי להעתיק את הלינק.");
    }
  };

  const resolveInviteUserByIdentifier = async (identifierRaw: string) => {
    const client = supabase;
    if (!client) return null;
    const identifier = identifierRaw.trim();
    if (!identifier) return null;

    const selectColumns = "id,username,display_name,avatar_url,auth_user_id";
    const username = normalizeUsername(identifier);
    const isEmail = identifier.includes("@") && isValidEmail(identifier.toLowerCase());

    if (isEmail) {
      const email = identifier.toLowerCase();
      const { data: byEmailRpc } = await client.rpc("find_app_user_by_email", {
        p_email: email,
      });
      const emailMatch = (byEmailRpc as InviteLookupByEmail[] | null)?.[0];
      if (emailMatch?.app_user_id) {
        const { data: userFromEmail } = await client
          .from("app_users")
          .select(selectColumns)
          .eq("id", emailMatch.app_user_id)
          .maybeSingle();
        if (userFromEmail) return userFromEmail as CloudUserRow;
      }

      const emailLocalPart = normalizeUsername(email.split("@")[0] || "");
      const { data: byEmailFallback } = await client
        .from("app_users")
        .select(selectColumns)
        .in("username", [email, emailLocalPart])
        .order("created_at", { ascending: true })
        .limit(1);
      if (byEmailFallback?.[0]) return byEmailFallback[0] as CloudUserRow;
      return null;
    }

    const { data: byUsername } = await client
      .from("app_users")
      .select(selectColumns)
      .eq("username", username)
      .order("created_at", { ascending: true })
      .limit(1);
    return (byUsername?.[0] as CloudUserRow | undefined) || null;
  };

  const inviteMemberByIdentifier = async () => {
    const client = supabase;
    if (!client || !activeHouse || !activeUser) return;
    const identifier = inviteIdentifierInput.trim();
    if (!identifier) {
      setInviteFeedback("יש להזין שם משתמש או אימייל.");
      return;
    }

    setInviteByUserLoading(true);
    setInviteFeedback("");

    const targetUser = await resolveInviteUserByIdentifier(identifier);
    if (!targetUser) {
      setInviteFeedback("לא נמצא משתמש עם שם המשתמש/האימייל שהוזן.");
      setInviteByUserLoading(false);
      return;
    }

    if (targetUser.id === activeUser.id) {
      setInviteFeedback("אי אפשר להזמין את עצמך לבית.");
      setInviteByUserLoading(false);
      return;
    }

    const { data: existingMembership } = await client
      .from("house_members")
      .select("house_id,user_id")
      .eq("house_id", activeHouse.id)
      .eq("user_id", targetUser.id)
      .maybeSingle();

    if (existingMembership) {
      setInviteFeedback("המשתמש כבר נמצא בבית הזה.");
      setInviteByUserLoading(false);
      return;
    }

    const { error } = await client.from("house_members").insert({
      house_id: activeHouse.id,
      user_id: targetUser.id,
      role: "member",
    });

    if (error) {
      setInviteFeedback("לא הצלחתי לשלוח הזמנה כרגע.");
      setInviteByUserLoading(false);
      return;
    }

    setInviteIdentifierInput("");
    setInviteFeedback(`${targetUser.display_name} נוסף לבית בהצלחה.`);
    setInviteByUserLoading(false);
  };

  if (!isSupabaseConfigured) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl items-center px-4 py-8">
        <section className="w-full rounded-3xl border border-white/80 bg-white/95 p-6 shadow-xl shadow-slate-200/70">
          <HomeLogo />
          <p className="mt-4 text-sm text-slate-600">
            כדי לעבוד בלי מצב מקומי, צריך להגדיר Supabase ולפרוס מחדש.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            הגדר ב־env: `NEXT_PUBLIC_SUPABASE_URL` ו־`NEXT_PUBLIC_SUPABASE_ANON_KEY`.
          </p>
        </section>
      </main>
    );
  }

  if ((!isAuthReady || isAuthResolving) && !activeUser) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl items-center px-4 py-8">
        <section className="w-full rounded-3xl border border-white/80 bg-white/95 p-6 text-center shadow-xl shadow-slate-200/70">
          <HomeLogo />
          <p className="mt-4 text-sm font-bold text-slate-700">טוען התחברות...</p>
          <LoadingBar done={isAuthReady} />
        </section>
      </main>
    );
  }

  if (!activeUser) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl items-center px-4 py-8">
        <section className="w-full rounded-3xl border border-white/80 bg-white/95 p-5 shadow-xl shadow-slate-200/70 sm:p-7">
          <HomeLogo />
          <p className="mt-3 text-sm text-slate-600">התחברות היא לפי משתמש אישי. אחרי זה נכנסים לבית.</p>

          {isRecoveryMode && (
            <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 p-3">
              <p className="text-xs font-bold text-teal-700">איפוס סיסמה</p>
              <p className="mt-1 text-xs text-teal-700">הכנס סיסמה חדשה כדי להשלים את תהליך האיפוס.</p>
              <div className="mt-2 space-y-2">
                <input
                  value={recoveryPasswordInput}
                  onChange={(event) => setRecoveryPasswordInput(event.target.value)}
                  type="password"
                  placeholder="סיסמה חדשה"
                  className="min-h-11 w-full rounded-2xl border border-teal-200 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
                <input
                  value={recoveryPasswordConfirmInput}
                  onChange={(event) => setRecoveryPasswordConfirmInput(event.target.value)}
                  type="password"
                  placeholder="אימות סיסמה חדשה"
                  className="min-h-11 w-full rounded-2xl border border-teal-200 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
                <button
                  type="button"
                  onClick={handleRecoveryPasswordUpdate}
                  disabled={isRecoveryPasswordLoading}
                  className="min-h-11 w-full rounded-2xl bg-teal-600 text-sm font-bold text-white disabled:opacity-50"
                >
                  {isRecoveryPasswordLoading ? "מעדכן..." : "עדכן סיסמה"}
                </button>
              </div>
              {recoveryPasswordError && (
                <p className="mt-2 text-xs font-bold text-rose-600">{recoveryPasswordError}</p>
              )}
              {recoveryPasswordFeedback && (
                <p className="mt-2 text-xs font-bold text-teal-700">{recoveryPasswordFeedback}</p>
              )}
            </div>
          )}

          <div className="mt-4 flex gap-2 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setAuthError("");
                setIsForgotPasswordOpen(false);
              }}
              className={`flex-1 rounded-xl py-2 text-sm font-bold ${
                authMode === "login" ? "bg-white text-teal-700" : "text-slate-500"
              }`}
            >
              התחברות משתמש
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("create");
                setAuthError("");
                setIsForgotPasswordOpen(false);
              }}
              className={`flex-1 rounded-xl py-2 text-sm font-bold ${
                authMode === "create" ? "bg-white text-teal-700" : "text-slate-500"
              }`}
            >
              יצירת משתמש
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {authMode === "create" && (
              <>
                <input
                  value={displayNameInput}
                  onChange={(event) => setDisplayNameInput(event.target.value)}
                  placeholder="שם מלא להצגה"
                  className="min-h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
                <input
                  value={emailInput}
                  onChange={(event) => setEmailInput(event.target.value)}
                  type="email"
                  dir="ltr"
                  placeholder="אימייל (לכניסה ולאיפוס סיסמה)"
                  className="min-h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-bold text-slate-600">תמונת פרופיל (אופציונלי)</p>
                  <div className="flex items-center gap-3">
                    {userAvatarInput ? (
                      <Image
                        loader={passthroughImageLoader}
                        unoptimized
                        src={userAvatarInput}
                        alt="תמונת פרופיל"
                        width={44}
                        height={44}
                        className="h-11 w-11 rounded-2xl border border-slate-200 object-cover"
                      />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-sm font-bold text-teal-700">
                        {displayNameInput.trim().slice(0, 1) || "?"}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={openUserAvatarPicker}
                      disabled={isProcessingImage}
                      className="min-h-10 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                    >
                      {isProcessingImage ? "מעבד תמונה..." : "העלאת תמונה"}
                    </button>
                    {userAvatarInput && (
                      <button
                        type="button"
                        onClick={() => setUserAvatarInput("")}
                        className="min-h-10 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500 transition hover:bg-slate-100"
                      >
                        הסרה
                      </button>
                    )}
                    <input
                      ref={userAvatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleUserAvatarFile(event.target.files?.[0])}
                      className="hidden"
                    />
                  </div>
                </div>
              </>
            )}
            <input
              value={usernameInput}
              onChange={(event) => setUsernameInput(event.target.value)}
              dir={authMode === "login" ? "rtl" : undefined}
              placeholder={authMode === "create" ? "שם משתמש" : "מייל/שם משתמש"}
              className="min-h-11 w-full rounded-2xl border border-slate-200 px-3 text-right text-sm outline-none placeholder:text-right focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            <input
              value={userPasswordInput}
              onChange={(event) => setUserPasswordInput(event.target.value)}
              type="password"
              placeholder="סיסמה"
              className="min-h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            <button
              type="button"
              onClick={authMode === "create" ? handleCreateUser : handleLoginUser}
              disabled={authLoading}
              className="min-h-11 w-full rounded-2xl bg-gradient-to-l from-teal-600 to-cyan-600 text-sm font-bold text-white disabled:opacity-50"
            >
              {authLoading
                ? "טוען..."
                : authMode === "create"
                  ? "צור משתמש"
                  : "התחבר"}
            </button>
            {authMode === "login" && (
              <button
                type="button"
                onClick={() => {
                  setForgotPasswordIdentifier(usernameInput.includes("@") ? usernameInput : "");
                  setForgotPasswordError("");
                  setForgotPasswordFeedback("");
                  setIsForgotPasswordOpen(true);
                }}
                className="w-full text-center text-xs font-bold text-slate-500 underline-offset-2 transition hover:text-slate-700 hover:underline"
              >
                שכחתי סיסמה
              </button>
            )}
          </div>

          {authError && <p className="mt-3 text-xs font-bold text-rose-600">{authError}</p>}
          {recoveryPasswordFeedback && (
            <p className="mt-3 text-xs font-bold text-teal-700">{recoveryPasswordFeedback}</p>
          )}
          {isForgotPasswordOpen && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-700">שחזור סיסמה</p>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(false)}
                  className="rounded-xl bg-white px-2 py-1 text-[11px] font-bold text-slate-600"
                >
                  סגור
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                הזן אימייל הרשמה. נשלח קישור לאיפוס סיסמה.
              </p>
              <input
                value={forgotPasswordIdentifier}
                onChange={(event) => setForgotPasswordIdentifier(event.target.value)}
                type="email"
                dir="ltr"
                placeholder="אימייל"
                className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isForgotPasswordLoading}
                className="mt-2 min-h-11 w-full rounded-2xl bg-slate-900 text-sm font-bold text-white disabled:opacity-50"
              >
                {isForgotPasswordLoading ? "שולח..." : "שלח קישור איפוס"}
              </button>
              {forgotPasswordError && (
                <p className="mt-2 text-xs font-bold text-rose-600">{forgotPasswordError}</p>
              )}
              {forgotPasswordFeedback && (
                <p className="mt-2 text-xs font-bold text-teal-700">{forgotPasswordFeedback}</p>
              )}
            </div>
          )}
        </section>
      </main>
    );
  }

  if (!activeHouse) {
    if (isHouseLoading) {
      return (
        <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl items-center px-4 py-8">
          <section className="w-full rounded-3xl border border-white/80 bg-white/95 p-6 text-center shadow-xl shadow-slate-200/70">
            <HomeLogo houseName={cachedHouseMeta?.name} houseImage={cachedHouseMeta?.house_image} />
            <p className="mt-4 text-sm font-bold text-slate-700">טוען את הבית שלך...</p>
            <p className="mt-2 text-xs text-slate-500">מסנכרן נתונים עדכניים מהענן.</p>
            <LoadingBar />
            {houseMembers.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {houseMembers.slice(0, 4).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <SafeImage
                      src={member.avatar_url}
                      alt={member.display_name}
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-xl object-cover"
                      fallback={
                        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-100 text-xs font-bold text-teal-700">
                          {member.display_name.slice(0, 1)}
                        </span>
                      }
                    />
                    <span className="text-xs font-bold text-slate-700">{member.display_name}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      );
    }

    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl items-center px-4 py-8">
        <section className="w-full rounded-3xl border border-white/80 bg-white/95 p-5 shadow-xl shadow-slate-200/70 sm:p-7">
          <div className="flex items-center gap-3">
            <SafeImage
              src={activeUser.avatar_url}
              alt="תמונת משתמש"
              width={52}
              height={52}
              className="h-13 w-13 rounded-2xl border border-slate-200 object-cover"
              fallback={
                <span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-teal-100 text-lg font-bold text-teal-700">
                  {activeUser.display_name.slice(0, 1)}
                </span>
              }
            />
            <div>
              <h2 className="text-lg font-bold text-slate-900">{activeUser.display_name}</h2>
              <p className="text-xs font-bold text-slate-500">@{activeUser.username}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-800">יצירת בית חדש</p>
              <input
                value={houseCreateNameInput}
                onChange={(event) => setHouseCreateNameInput(event.target.value)}
                placeholder="שם הבית"
                className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              <button
                type="button"
                onClick={handleCreateHouse}
                disabled={houseCreateLoading}
                className="mt-2 min-h-11 w-full rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {houseCreateLoading ? "יוצר..." : "צור בית"}
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-800">הצטרפות לבית קיים</p>
              <input
                value={joinTokenInput}
                onChange={(event) => setJoinTokenInput(event.target.value.toUpperCase())}
                placeholder="קוד הזמנה"
                className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm uppercase outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              <button
                type="button"
                onClick={() => {
                  void handleJoinHouseByToken();
                }}
                disabled={joinLoading}
                className="mt-2 min-h-11 w-full rounded-2xl bg-teal-600 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {joinLoading ? "מצרף..." : "הצטרף לבית"}
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-bold text-slate-800">הבתים שלי</p>
            {memberHouses.length === 0 ? (
              <p className="mt-2 text-xs font-bold text-slate-500">עדיין אין לך בתים. צור בית או הצטרף בהזמנה.</p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {memberHouses.map((house) => (
                  <button
                    key={house.id}
                    type="button"
                    onClick={() => applyActiveHouse(house)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-right transition hover:bg-slate-100"
                  >
                    <p className="text-sm font-bold text-slate-900">{house.name}</p>
                    <p className="text-xs font-bold text-slate-500">{house.id}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {houseListError && <p className="mt-3 text-xs font-bold text-rose-600">{houseListError}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-[1600px] px-2 py-4 pb-[calc(7.25rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-6 sm:pb-8 lg:px-6">
      <header className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-30 mb-5 rounded-3xl border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/70 backdrop-blur sm:mb-7 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <HomeLogo houseName={activeHouse.name} houseImage={activeHouse.house_image} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsUserProfileOpen(true)}
              className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1 lg:flex"
            >
              <SafeImage
                src={activeUser.avatar_url}
                alt="תמונת משתמש"
                width={28}
                height={28}
                className="h-7 w-7 rounded-xl object-cover"
                fallback={
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-100 text-xs font-bold text-teal-700">
                    {activeUser.display_name.slice(0, 1)}
                  </span>
                }
              />
              <span className="text-xs font-bold text-slate-700">{activeUser.display_name}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
              הגדרות
            </button>
          </div>
        </div>
      </header>

      <section className="mb-4 rounded-3xl border border-white/80 bg-white/95 p-3 shadow-lg shadow-slate-200/70">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-500">אנשים בבית</p>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-teal-50 px-2 py-1 text-[11px] font-bold text-teal-700">
              {isHouseMembersLoading && houseMembers.length === 0
                ? "טוען אנשים..."
                : `${houseMembers.length} משתמשים`}
            </span>
            <button
              type="button"
              onClick={() => {
                void openInviteModal();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
              title="שיתוף הזמנה לבית"
              aria-label="שיתוף הזמנה לבית"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="m8.6 13.5 6.8 3.9" />
                <path d="m15.4 6.6-6.8 3.8" />
              </svg>
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {isHouseMembersLoading && houseMembers.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
              טוען את אנשי הבית...
            </div>
          )}
          {houseMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1.5"
            >
              <SafeImage
                src={member.avatar_url}
                alt={member.display_name}
                width={28}
                height={28}
                className="h-7 w-7 rounded-xl object-cover"
                fallback={
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-100 text-xs font-bold text-teal-700">
                    {member.display_name.slice(0, 1)}
                  </span>
                }
              />
              <span className="text-xs font-bold text-slate-700">{member.display_name}</span>
              {member.role === "owner" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  בעל הבית
                </span>
              )}
              {activeHouse?.owner_user_id === activeUser?.id && member.role !== "owner" && (
                <button
                  type="button"
                  onClick={() => void removeMember(member.id)}
                  className="mr-auto rounded-lg bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 transition hover:bg-rose-100"
                  title="הסר מהבית"
                >
                  הסר
                </button>
              )}
            </div>
          ))}
          {houseMembers.length === 0 && (
            <p className="text-xs font-bold text-slate-500">עדיין אין חברים בבית הזה.</p>
          )}
        </div>
      </section>

      <div>
        <div className="mb-4 hidden grid-cols-1 gap-3 lg:grid lg:grid-cols-[1.2fr_1fr]">
          <section className="rounded-3xl border border-white/80 bg-white/95 p-4 shadow-lg shadow-slate-200/70">
            <p className="text-xs font-bold text-slate-500">חיפוש וסינון</p>
            <div className="mt-3 flex items-center gap-2">
              <input
                ref={desktopSearchRef}
                value={desktopQuery}
                onChange={(event) => setDesktopQuery(event.target.value)}
                placeholder="חיפוש מהיר בכל הרשימות..."
                className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              <select
                value={desktopFilter}
                onChange={(event) => setDesktopFilter(event.target.value as "all" | "open" | "done")}
                className="min-h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option value="all">הכול</option>
                <option value="open">פתוחים</option>
                <option value="done">הושלמו</option>
              </select>
            </div>
          </section>

          <section className="rounded-3xl border border-white/80 bg-white/95 p-4 shadow-lg shadow-slate-200/70">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-sky-50 px-3 py-3 text-center text-xs font-bold text-sky-700">
                משימות
                <br />
                {sections.homeTasks.items.length}
              </div>
              <div className="rounded-2xl bg-teal-50 px-3 py-3 text-center text-xs font-bold text-teal-700">
                כללי
                <br />
                {sections.generalShopping.items.length}
              </div>
              <div className="rounded-2xl bg-violet-50 px-3 py-3 text-center text-xs font-bold text-violet-700">
                סופר
                <br />
                {sections.supermarketShopping.items.length}
              </div>
            </div>
          </section>

        </div>

        {voiceError && (
          <p className="mb-3 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            {voiceError}
          </p>
        )}
        {undoState && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs font-bold text-amber-800">{undoState.label}</p>
            <button
              type="button"
              onClick={restoreUndo}
              className="rounded-xl bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 hover:bg-amber-200"
            >
              בטל
            </button>
          </div>
        )}

        <DndContext
          sensors={sensors}
          modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <section className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sectionOrder.map((key) => {
              const section = sections[key];
              const isRecordingHere = activeRecording === key;
              const visibleItems = getVisibleItems(section.items);
              const doneCount = section.items.filter((item) => item.completed).length;
              const progress = section.items.length
                ? Math.round((doneCount / section.items.length) * 100)
                : 0;

              return (
                <article key={key} id={sectionAnchors[key]} className="scroll-mt-32 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-lg shadow-slate-200/70 backdrop-blur sm:p-5 lg:flex lg:min-h-[38rem] lg:flex-col">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>
                    <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">{section.items.length} פריטים</span>
                  </div>
                  <div className="mb-4">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-teal-500 to-cyan-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <form className="mb-4 flex flex-col gap-2" onSubmit={(event) => handleSubmit(event, key)}>
                    <div className="flex items-center gap-2">
                      <input
                        ref={(node) => {
                          sectionInputRefs.current[key] = node;
                        }}
                        value={inputs[key]}
                        onChange={(event) => setInputs((prev) => ({ ...prev, [key]: event.target.value }))}
                        placeholder={section.placeholder}
                        className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      />
                      {key === "supermarketShopping" && (
                        <button
                          type="button"
                          onClick={() => {
                            setRecipeError("");
                            setRecipeNotes("");
                            setRecipeQuestions([]);
                            setRecipeItems([]);
                            setRecipeAnswers({});
                            setIsRecipeModalOpen(true);
                          }}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100"
                          title="מתכון חכם"
                        >
                          <RecipeIcon />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleRecording(key)}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${
                          isRecordingHere
                            ? "border-rose-300 bg-rose-500 text-white shadow-lg shadow-rose-200"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                        } ${!isSpeechSupported ? "pointer-events-none opacity-40" : ""}`}
                      >
                        {isRecordingHere ? <AudioWaveIcon /> : <MicIcon />}
                      </button>
                    </div>
                    <button type="submit" className="min-h-11 rounded-2xl bg-gradient-to-l from-teal-600 to-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:opacity-90">הוספה</button>
                  </form>

                  {isRecordingHere && <p className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">מקליט... עצירה בלחיצה חוזרת על המיקרופון.</p>}
                  {processingRecording === key && (
                    <p className="mb-2 rounded-xl bg-teal-50 px-3 py-2 text-xs font-bold text-teal-700">
                      מפענח הקלטה עם AI...
                    </p>
                  )}

                  <SortableContext
                    items={visibleItems.map((item) => toSortableId(key, item.id))}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="space-y-2 lg:max-h-[24rem] lg:overflow-y-auto lg:pl-1">
                      {visibleItems.map((item) => {
                        const creator = houseMembers.find(
                          (member) => member.id === item.createdByUserId,
                        );
                        const avatarUrl =
                          creator?.avatar_url ||
                          (item.createdByUserId === activeUser?.id
                            ? activeUser?.avatar_url
                            : "");
                        return (
                        <SortableListItem
                          key={item.id}
                          sortableId={toSortableId(key, item.id)}
                          item={item}
                          createdByAvatarUrl={avatarUrl}
                          addedAtLabel={formatAddedAt(item.createdAt)}
                          onToggle={() => toggleComplete(key, item.id)}
                          onEdit={() => editItem(key, item.id)}
                          onDelete={() => deleteItem(key, item.id)}
                        />
                        );
                      })}
                    </ul>
                  </SortableContext>
                  {visibleItems.length === 0 && (
                    <p className="rounded-2xl bg-slate-50 px-3 py-4 text-center text-xs font-bold text-slate-500">
                      אין פריטים להצגה לפי הסינון הנוכחי.
                    </p>
                  )}
                </article>
              );
            })}
          </section>
          <DragOverlay>
            {dragOverlayItem ? (
              <div className="flex w-[min(92vw,30rem)] items-center gap-2 rounded-2xl border border-teal-300 bg-white px-3 py-2 shadow-2xl shadow-slate-300">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="9" cy="6" r="1" />
                    <circle cx="9" cy="12" r="1" />
                    <circle cx="9" cy="18" r="1" />
                    <circle cx="15" cy="6" r="1" />
                    <circle cx="15" cy="12" r="1" />
                    <circle cx="15" cy="18" r="1" />
                  </svg>
                </span>
                <span className={`truncate text-sm font-bold ${dragOverlayItem.completed ? "text-slate-400 line-through" : "text-slate-800"}`}>
                  {dragOverlayItem.text}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

          {isRecipeModalOpen && (
            <Suspense fallback={null}><RecipeModal
              recipeText={recipeText}
              onRecipeTextChange={setRecipeText}
              recipeQuestions={recipeQuestions}
              recipeAnswers={recipeAnswers}
              onRecipeAnswerChange={(questionId, value) => {
                setRecipeError("");
                setRecipeAnswers((prev) => ({ ...prev, [questionId]: value }));
              }}
              recipeItems={recipeItems}
              recipeNotes={recipeNotes}
              recipeError={recipeError}
              isRecipeLoading={isRecipeLoading}
              recipeRecording={recipeRecording}
              onToggleRecording={toggleRecipeRecording}
              onRunRecipe={() => void runRecipeAi()}
              onAddToSupermarket={addRecipeItemsToSupermarket}
              onClose={() => {
                setIsRecipeModalOpen(false);
                setRecipeRecording(false);
                recipeRecognitionRef.current?.stop();
              }}
            /></Suspense>
          )}

          {isInviteModalOpen && (
            <Suspense fallback={null}><InviteModal
              invitePhone={invitePhone}
              onInvitePhoneChange={setInvitePhone}
              inviteIdentifierInput={inviteIdentifierInput}
              onInviteIdentifierChange={setInviteIdentifierInput}
              inviteByUserLoading={inviteByUserLoading}
              inviteToken={inviteToken}
              inviteLink={inviteLink}
              normalizedPhone={normalizedPhone}
              smsHref={smsHref}
              inviteFeedback={inviteFeedback}
              houseId={activeHouse?.id}
              onInviteMember={() => void inviteMemberByIdentifier()}
              onShareLink={() => void shareInviteLink()}
              onCopyLink={() => void copyInviteLink()}
              onClose={() => setIsInviteModalOpen(false)}
            /></Suspense>
          )}
      </div>

      {isMobile && (
        <nav className={`bottom-nav fixed inset-x-0 bottom-[max(0.45rem,env(safe-area-inset-bottom))] z-40 px-2 ${activeRecording ? "translate-y-full opacity-0 pointer-events-none" : ""}`}>
          <div className="mx-auto w-full max-w-[min(100vw-0.7rem,24.5rem)] rounded-t-[2.1rem] rounded-b-[1.45rem] border border-white/70 bg-white/70 p-2 shadow-xl shadow-slate-200/70 backdrop-blur-xl">
            <div className="mx-auto mb-1 h-1.5 w-20 rounded-full bg-slate-200/65" />
            <div className="flex items-center justify-between rounded-[1.8rem] border border-white/60 bg-white/45 px-1 py-1.5">
              <a
                href="#tasks"
                className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl py-1.5 text-[11px] font-bold text-slate-700 transition active:scale-95"
              >
                <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-sky-100 bg-sky-50 text-sky-600 shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </span>
                משימות
              </a>
              <a
                href="#general"
                className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl py-1.5 text-[11px] font-bold text-slate-700 transition active:scale-95"
              >
                <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-teal-100 bg-teal-50 text-teal-600 shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 7h12" />
                    <path d="M8 7V5a4 4 0 0 1 8 0v2" />
                    <path d="M4 7l1 12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2l1-12" />
                  </svg>
                </span>
                כללי
              </a>
              <a
                href="#supermarket"
                className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl py-1.5 text-[11px] font-bold text-slate-700 transition active:scale-95"
              >
                <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-violet-100 bg-violet-50 text-violet-600 shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="9" cy="20" r="1" />
                    <circle cx="20" cy="20" r="1" />
                    <path d="M1 1h4l2.7 12.4a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.6L23 6H6" />
                  </svg>
                </span>
                סופר
              </a>
            </div>
          </div>
        </nav>
      )}

      {isUserProfileOpen && activeUser && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">הפרופיל שלי</h3>
              <button
                type="button"
                onClick={() => setIsUserProfileOpen(false)}
                className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                סגור
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="relative mx-auto mb-3 h-24 w-24">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-200">
                  <SafeImage
                    src={userProfileImage}
                    alt="תמונת משתמש"
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                    fallback={
                      <span className="text-3xl font-bold text-teal-700">
                        {userProfileName.trim().slice(0, 1) || "?"}
                      </span>
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={openUserProfileImagePicker}
                  disabled={isProcessingImage}
                  className="absolute -bottom-1 -left-1 flex h-8 w-8 items-center justify-center rounded-full border border-white bg-slate-900 text-white shadow-lg disabled:opacity-50"
                  title={isProcessingImage ? "מעבד תמונה..." : "החלפת תמונה"}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m12 20 7-7-3-3-7 7-1 4z" />
                    <path d="m15 7 3 3" />
                  </svg>
                </button>
                <input
                  ref={userProfileImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleUserProfileImageFile(event.target.files?.[0])}
                  className="hidden"
                />
              </div>

              <label className="block text-xs font-bold text-slate-600">
                שם לתצוגה
                <input
                  value={userProfileName}
                  onChange={(event) => setUserProfileName(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  placeholder="השם שיופיע בבית"
                />
              </label>
              <p className="mt-2 text-center text-xs font-bold text-slate-500">@{activeUser.username}</p>
            </div>

            {userProfileError && (
              <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                {userProfileError}
              </p>
            )}

            <button
              type="button"
              onClick={saveUserProfileSettings}
              disabled={isSavingUserProfile}
              className="mt-4 min-h-11 w-full rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isSavingUserProfile ? "שומר..." : "שמור פרופיל"}
            </button>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <Suspense fallback={null}><SettingsModal
          settingsHouseName={settingsHouseName}
          onSettingsHouseNameChange={setSettingsHouseName}
          settingsHouseImage={settingsHouseImage}
          onSettingsImageFile={handleSettingsImageFile}
          isSavingSettings={isSavingSettings}
          isDeletingHouse={isDeletingHouse}
          settingsError={settingsError}
          isOwner={activeHouse?.owner_user_id === activeUser?.id}
          onSave={() => void saveHouseSettings()}
          onDelete={() => void deleteActiveHouse()}
          onClose={() => setIsSettingsOpen(false)}
          onOpenUserProfile={() => {
            setIsSettingsOpen(false);
            setIsUserProfileOpen(true);
          }}
          onOpenInvite={() => {
            setIsSettingsOpen(false);
            void openInviteModal();
          }}
          onSwitchHouse={() => {
            setIsSettingsOpen(false);
            if (activeUser?.id) {
              window.localStorage.removeItem(getSelectedHouseStorageKey(activeUser.id));
            }
            setActiveHouse(null);
            setInviteToken("");
          }}
          onSignOut={async () => {
            if (supabase) {
              await supabase.auth.signOut();
            }
            setIsSettingsOpen(false);
            window.localStorage.removeItem(CACHED_USER_KEY);
            setActiveUser(null);
            setActiveHouse(null);
            setMemberHouses([]);
            setInviteToken("");
            setAuthError("");
            if (activeUser?.id) {
              window.localStorage.removeItem(getSelectedHouseStorageKey(activeUser.id));
            }
            setUsernameInput("");
            setUserPasswordInput("");
            setDisplayNameInput("");
            setUserAvatarInput("");
          }}
          onLeaveHouse={() => void leaveHouse()}
        /></Suspense>
      )}
    </main>
  );
}
