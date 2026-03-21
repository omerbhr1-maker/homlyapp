export type SectionKey = "homeTasks" | "generalShopping" | "supermarketShopping";

export type Item = {
  id: number;
  text: string;
  completed: boolean;
  createdByUserId?: string;
  createdByName?: string;
  createdAt?: string;
};

export type Section = {
  title: string;
  placeholder: string;
  items: Item[];
};

export type UndoState = {
  label: string;
  sections: Record<SectionKey, Section>;
};

export type CloudHouseRow = {
  id: string;
  name: string;
  pin?: string;
  sections: Record<SectionKey, Item[]>;
  invite_phone: string;
  house_image?: string;
  owner_user_id?: string | null;
  updated_at?: string;
};

export type CloudUserRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  auth_user_id?: string | null;
};

export type CloudInviteRow = {
  token: string;
  house_id: string;
};

export type InviteLookupByEmail = {
  app_user_id: string;
};

export type HouseMemberUser = {
  id: string;
  display_name: string;
  avatar_url: string;
  role: "owner" | "member";
};

export type CachedHouseMeta = {
  id: string;
  name: string;
  pin?: string;
  invite_phone: string;
  house_image?: string;
  owner_user_id?: string | null;
};

export type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

export type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

export type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export type RecipeQuestionKind = "single" | "multi" | "text";
export type RecipeAnswerValue = string | string[];

export type RecipeQuestion = {
  id: string;
  title: string;
  kind?: RecipeQuestionKind;
  options?: string[];
  placeholder?: string;
  maxSelections?: number;
};

export type RecipeAiResponse = {
  needs_clarification: boolean;
  questions: RecipeQuestion[];
  items: { name: string; amount?: string }[];
  notes?: string;
  source?: "ai" | "fallback";
};
