import type { SectionKey, Section } from "@/types";

export const sectionOrder: SectionKey[] = [
  "supermarketShopping",
  "homeTasks",
  "generalShopping",
];

export const sectionAnchors: Record<SectionKey, string> = {
  homeTasks: "tasks",
  generalShopping: "general",
  supermarketShopping: "supermarket",
};

export const SORTABLE_SEP = "::";
export const PENDING_JOIN_CODE_KEY = "homly_pending_join_code";
export const PENDING_JOIN_HOUSE_KEY = "homly_pending_join_house";
export const SELECTED_HOUSE_KEY_PREFIX = "homly_selected_house_";
export const CACHED_USER_KEY = "homly_cached_user";
export const CACHED_HOUSE_META_KEY_PREFIX = "homly_cached_house_meta_";
export const CACHED_HOUSE_MEMBERS_KEY_PREFIX = "homly_cached_house_members_";

const defaultCreatedAt = new Date().toISOString();

export const initialSections: Record<SectionKey, Section> = {
  homeTasks: {
    title: "משימות בית",
    placeholder: "הוספת משימה חדשה",
    items: [
      { id: 1, text: "לקפל כביסה", completed: false, createdByName: "Homly", createdAt: defaultCreatedAt },
      { id: 2, text: "לשטוף כלים", completed: true, createdByName: "Homly", createdAt: defaultCreatedAt },
      { id: 3, text: "להוציא אשפה", completed: false, createdByName: "Homly", createdAt: defaultCreatedAt },
    ],
  },
  generalShopping: {
    title: "רשימת קניות כללית",
    placeholder: "הוספת פריט לרשימה",
    items: [
      { id: 1, text: "סבון ידיים", completed: false, createdByName: "Homly", createdAt: defaultCreatedAt },
      { id: 2, text: "נייר אפייה", completed: false, createdByName: "Homly", createdAt: defaultCreatedAt },
      { id: 3, text: "שקיות זבל", completed: true, createdByName: "Homly", createdAt: defaultCreatedAt },
    ],
  },
  supermarketShopping: {
    title: "רשימת קניות לסופר",
    placeholder: "הוספת מוצר לסופר",
    items: [
      { id: 1, text: "חלב", completed: false, createdByName: "Homly", createdAt: defaultCreatedAt },
      { id: 2, text: "לחם", completed: true, createdByName: "Homly", createdAt: defaultCreatedAt },
      { id: 3, text: "ביצים", completed: false, createdByName: "Homly", createdAt: defaultCreatedAt },
    ],
  },
};
