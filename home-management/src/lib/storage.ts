import { appCacheStorage } from "@/lib/supabase";
import {
  SELECTED_HOUSE_KEY_PREFIX,
  CACHED_HOUSE_META_KEY_PREFIX,
  CACHED_HOUSE_MEMBERS_KEY_PREFIX,
} from "@/lib/constants";

export function getSelectedHouseStorageKey(userId: string) {
  return `${SELECTED_HOUSE_KEY_PREFIX}${userId}`;
}

export function getCachedHouseMetaStorageKey(userId: string) {
  return `${CACHED_HOUSE_META_KEY_PREFIX}${userId}`;
}

export function getCachedHouseMembersStorageKey(houseId: string) {
  return `${CACHED_HOUSE_MEMBERS_KEY_PREFIX}${houseId}`;
}

export async function setPersistentCacheValue(key: string, value: string) {
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

export async function removePersistentCacheValue(key: string) {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(key);
  }
  await appCacheStorage.removeItem(key);
}
