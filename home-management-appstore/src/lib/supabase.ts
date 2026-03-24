import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const storageKey = "homly-auth";
const nativeSessionCache = new Map<string, string | null>();

export const isSupabaseConfigured =
  Boolean(supabaseUrl) && Boolean(supabaseAnonKey);

const authStorage = {
  async getItem(key: string) {
    if (typeof window === "undefined") return null;
    if (Capacitor.isNativePlatform()) {
      if (nativeSessionCache.has(key)) {
        return nativeSessionCache.get(key) ?? null;
      }
      const { value } = await Preferences.get({ key });
      nativeSessionCache.set(key, value ?? null);
      return value;
    }
    return window.localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (typeof window === "undefined") return;
    if (Capacitor.isNativePlatform()) {
      nativeSessionCache.set(key, value);
      await Preferences.set({ key, value });
      return;
    }
    window.localStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    if (typeof window === "undefined") return;
    if (Capacitor.isNativePlatform()) {
      nativeSessionCache.delete(key);
      await Preferences.remove({ key });
      return;
    }
    window.localStorage.removeItem(key);
  },
};

// App data cache — uses localStorage as fast synchronous layer,
// and writes Preferences asynchronously (fire-and-forget) so native
// round-trips never block the JS thread.
export const appCacheStorage = {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === "undefined") return null;
    // Fast path: localStorage is always written on setItem.
    const local = window.localStorage.getItem(key);
    if (local !== null) return local;
    if (Capacitor.isNativePlatform()) {
      if (nativeSessionCache.has(key)) return nativeSessionCache.get(key) ?? null;
      const { value } = await Preferences.get({ key });
      // Promote to localStorage for future fast reads.
      if (value) {
        try { window.localStorage.setItem(key, value); } catch { /* quota */ }
        nativeSessionCache.set(key, value);
      }
      return value ?? null;
    }
    return null;
  },
  setItem(key: string, value: string): void {
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(key, value); } catch { /* quota */ }
    }
    if (Capacitor.isNativePlatform()) {
      nativeSessionCache.set(key, value);
      void Preferences.set({ key, value });
    }
  },
  removeItem(key: string): void {
    if (typeof window !== "undefined") {
      try { window.localStorage.removeItem(key); } catch { /* ignore */ }
    }
    if (Capacitor.isNativePlatform()) {
      nativeSessionCache.delete(key);
      void Preferences.remove({ key });
    }
  },
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: !Capacitor.isNativePlatform(),
        storageKey,
        storage: authStorage,
      },
    })
  : null;
