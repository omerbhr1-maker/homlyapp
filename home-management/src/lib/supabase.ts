import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const storageKey = "homly-auth";

export const isSupabaseConfigured =
  Boolean(supabaseUrl) && Boolean(supabaseAnonKey);

const authStorage = {
  async getItem(key: string) {
    if (typeof window === "undefined") return null;
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key });
      return value;
    }
    return window.localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (typeof window === "undefined") return;
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key, value });
      return;
    }
    window.localStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    if (typeof window === "undefined") return;
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key });
      return;
    }
    window.localStorage.removeItem(key);
  },
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey,
        storage: authStorage,
      },
    })
  : null;
