"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hapticLight, hapticHeavy, hapticNotificationSuccess, nativeShare, setupStatusBar, hideSplashScreen, addNetworkListener, addAppStateListener, addAppUrlOpenListener } from "@/lib/capacitor";
import { initMonitoring } from "@/lib/monitoring";
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
  arrayMove,
} from "@dnd-kit/sortable";
import type { User } from "@supabase/supabase-js";
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { appCacheStorage, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { sanitizeItems, splitTranscriptToItems } from "@/lib/item-parsing";
import type {
  SectionKey,
  Item,
  UndoState,
  CloudHouseRow,
  CloudUserRow,
  InviteLookupByEmail,
  HouseMemberUser,
  CachedHouseMeta,
  SpeechRecognitionInstance,
  SpeechRecognitionCtor,
  RecipeQuestion,
  RecipeAnswerValue,
  RecipeAiResponse,
} from "@/types";
import {
  sectionOrder,
  sectionAnchors,
  initialSections,
  PENDING_JOIN_CODE_KEY,
  PENDING_JOIN_HOUSE_KEY,
  CACHED_USER_KEY,
} from "@/lib/constants";
import {
  createInviteToken,
  normalizeUsername,
  getAuthEmailFromUsername,
  isValidEmail,
  getPublicAppOrigin,
  toCachedUser,
  toCachedHouseMeta,
  toCachedHouseMembers,
  normalizeRecipeQuestions,
  getRecipeAnswerValues,
  isRecipeAnswerMissing,
  getDefaultSectionItems,
  normalizeCloudSections,
  cloneSections,
  fromSortableId,
} from "@/lib/utils";
import {
  getSelectedHouseStorageKey,
  getCachedHouseMetaStorageKey,
  getCachedHouseMembersStorageKey,
  getCachedHouseSectionsStorageKey,
} from "@/lib/storage";
import { HomeLogo } from "@/components/HomeLogo";
import { LoadingBar } from "@/components/LoadingBar";
import { type SectionInputHandle } from "@/components/SectionInput";
import { AuthScreen } from "@/components/AuthScreen";
import { HouseLoadingScreen } from "@/components/HouseLoadingScreen";
import { HouseSelectorScreen } from "@/components/HouseSelectorScreen";
import { BottomNav } from "@/components/BottomNav";
import { UserProfileModal } from "@/components/UserProfileModal";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { HouseHeader } from "@/components/HouseHeader";
import { HouseMembersSection } from "@/components/HouseMembersSection";
import { SectionCard } from "@/components/SectionCard";
import { DesktopFilterBar } from "@/components/DesktopFilterBar";
import { DragOverlayItem } from "@/components/DragOverlayItem";
import { optimizeImageFile, uploadImageToStorage } from "@/lib/image-utils";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useNavDrag } from "@/hooks/useNavDrag";

const RecipeModal = lazy(() => import("@/components/RecipeModal").then((m) => ({ default: m.RecipeModal })));
const InviteModal = lazy(() => import("@/components/InviteModal").then((m) => ({ default: m.InviteModal })));
const SettingsModal = lazy(() => import("@/components/SettingsModal").then((m) => ({ default: m.SettingsModal })));

function setPersistentCacheValue(key: string, value: string) {
  appCacheStorage.setItem(key, value);
}

function removePersistentCacheValue(key: string) {
  appCacheStorage.removeItem(key);
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
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const memberHousesRef = useRef<CloudHouseRow[]>([]);
  memberHousesRef.current = memberHouses;
  const [invitePhone, setInvitePhone] = useState("");
  const [homeLink, setHomeLink] = useState("");

  const [activeRecording, setActiveRecording] = useState<SectionKey | null>(null);
  const mainScrollRef = useRef<HTMLElement>(null);
  const { ptrDist, isRefreshing, isPtrDone, PTR_THRESHOLD, handlePtrStart, handlePtrMove, handlePtrEnd } = usePullToRefresh({
    mainScrollRef,
    onRefresh: async () => {
      const userId = activeUserRef.current?.id;
      const houseId = activeHouseRef.current?.id;
      lastAcceptedCloudUpdatedAtRef.current = "";
      if (userId) await loadUserHouses(userId, houseId, true);
    },
  });
  const { isNavHidden, setIsNavHidden, navDragY, handleNavDragStart, handleNavDragMove, handleNavDragEnd } = useNavDrag();
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

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptBufferRef = useRef("");
  const recordingSectionRef = useRef<SectionKey | null>(null);
  const shouldKeepRecordingRef = useRef(false);
  const recipeRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const userAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const userProfileImageInputRef = useRef<HTMLInputElement | null>(null);
  const desktopSearchRef = useRef<HTMLInputElement | null>(null);
  const sectionInputRefs = useRef<Record<SectionKey, SectionInputHandle | null>>({
    homeTasks: null,
    generalShopping: null,
    supermarketShopping: null,
  });
  // Stable setters so SectionCard's memo is not defeated by inline lambdas.
  // sectionOrder is a constant and sectionInputRefs is a ref — both stable forever.
  const sectionInputRefSetters = useMemo(
    () =>
      Object.fromEntries(
        sectionOrder.map((key) => [
          key,
          (node: SectionInputHandle | null) => {
            sectionInputRefs.current[key] = node;
          },
        ]),
      ) as Record<SectionKey, (node: SectionInputHandle | null) => void>,
    [],
  );
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

  // Returns true when an incoming cloud update should be discarded because we've
  // already accepted a newer (or equal) snapshot. Reads the ref live so it's always fresh.
  const isStaleCloudUpdate = useCallback((updatedAt: string | undefined): boolean => {
    if (!updatedAt || !lastAcceptedCloudUpdatedAtRef.current) return false;
    return updatedAt <= lastAcceptedCloudUpdatedAtRef.current;
  }, []);
  const [isHouseLoading, setIsHouseLoading] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isMobile
        ? { delay: 180, tolerance: 6 }
        : { distance: 6 },
    }),
  );

  const houseMembersMap = useMemo(
    () => new Map(houseMembers.map((m) => [m.id, m])),
    [houseMembers],
  );

  const normalizedDesktopQuery = useMemo(
    () => desktopQuery.trim().toLowerCase(),
    [desktopQuery],
  );

  const sectionStats = useMemo(() => {
    const q = normalizedDesktopQuery;
    return Object.fromEntries(
      sectionOrder.map((key) => {
        const items = sections[key].items;
        const visibleItems: Item[] = [];
        let doneCount = 0;
        for (const item of items) {
          if (item.completed) doneCount++;
          if (desktopFilter === "open" && item.completed) continue;
          if (desktopFilter === "done" && !item.completed) continue;
          if (q && !item.text.toLowerCase().includes(q)) continue;
          visibleItems.push(item);
        }
        const progress = items.length ? Math.round((doneCount / items.length) * 100) : 0;
        return [key, { visibleItems, doneCount, progress }];
      }),
    ) as Record<SectionKey, { visibleItems: Item[]; doneCount: number; progress: number }>;
  }, [sections, desktopFilter, normalizedDesktopQuery]);

  // Surface any unhandled JS errors to the Xcode console for easier debugging.
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      console.error("[HomlyError]", event.message, event.filename, event.lineno, event.error);
    };
    const onUnhandled = (event: PromiseRejectionEvent) => {
      console.error("[HomlyUnhandledRejection]", event.reason);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

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
      const { data: savedRow, error } = await client
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
        .eq("id", house.id)
        .select("updated_at")
        .single();

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

      // Stamp the saved updated_at so that any Realtime echo of this save is discarded.
      if (savedRow?.updated_at) {
        lastAcceptedCloudUpdatedAtRef.current = String(savedRow.updated_at);
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
  }, [isSettingsOpen, activeHouse?.id, activeHouse?.name, activeHouse?.house_image]);

  useEffect(() => {
    if (!isUserProfileOpen || !activeUser) return;
    setUserProfileName(activeUser.display_name || "");
    setUserProfileImage(activeUser.avatar_url || "");
    setUserProfileError("");
  }, [isUserProfileOpen, activeUser?.id, activeUser?.display_name, activeUser?.avatar_url]);

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
    let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;
    let fallbackBootstrapTimeout: ReturnType<typeof setTimeout> | null = null;

    const startFallbackSync = () => {
      if (fallbackTimeout) return;
      // Immediate first poll, then exponential backoff: 30s → 60s → 90s (cap).
      const poll = (delay: number) => {
        const uid = activeUserRef.current?.id;
        if (uid) void loadUserHouses(uid, houseId, true);
        fallbackTimeout = setTimeout(() => {
          poll(Math.min(delay * 2, 90000));
        }, delay);
      };
      poll(30000);
    };

    const stopFallbackSync = () => {
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
        fallbackTimeout = null;
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

          // When sections is null (TOAST'd payload — row too large for WAL replication),
          // we can't safely apply the event. If the timestamp is newer than what we've
          // accepted, do a fresh DB fetch; otherwise discard (it's our own echo).
          if (!next.sections) {
            const nextUpdatedAt = typeof next.updated_at === "string" ? next.updated_at : "";
            if (!nextUpdatedAt || isStaleCloudUpdate(nextUpdatedAt)) return;
            const uid = activeUserRef.current?.id;
            if (uid) void loadUserHouses(uid, String(next.id), true);
            return;
          }

          // Use refs for fresh values — the closure would otherwise see stale data.
          const currentHouse = activeHouseRef.current;
          const syncedHouse: CloudHouseRow = {
            id: String(next.id),
            name: String(next.name || currentHouse?.name || ""),
            pin: String(next.pin || currentHouse?.pin || ""),
            sections: normalizeCloudSections(
              next.sections as Record<SectionKey, Item[]>,
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
          if (isStaleCloudUpdate(syncedHouse.updated_at)) return;
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

  // Monitoring + Status Bar + Splash Screen — setup on mount
  useEffect(() => {
    initMonitoring();
    void setupStatusBar();
    void hideSplashScreen();
  }, []);

  // Capacitor Network — online/offline detection
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    addNetworkListener((connected) => {
      if (!connected) {
        document.body.classList.add("offline");
      } else {
        document.body.classList.remove("offline");
      }
    }).then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
  }, []);

  // Capacitor App — refresh data on app resume (native equivalent of visibilitychange)
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    addAppStateListener(() => {
      const userId = activeUserRef.current?.id;
      const houseId = activeHouseRef.current?.id;
      if (userId) void loadUserHouses(userId, houseId);
    }).then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capacitor Universal Links — handle invite URLs when app is already open
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    addAppUrlOpenListener((url) => {
      try {
        const parsed = new URL(url);
        const invite = parsed.searchParams.get("invite") ?? parsed.searchParams.get("house");
        if (invite) {
          setJoinTokenInput(invite.toUpperCase());
          window.localStorage.setItem(PENDING_JOIN_CODE_KEY, invite.toUpperCase());
        }
      } catch {}
    }).then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        const section = sectionOrder[Number(event.key) - 1];
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

  const pushUndoState = useCallback((label: string) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    // Store a reference to the pre-mutation sections object — React state is immutable
    // so this object will never be modified in-place; cloning is deferred until undo is
    // actually triggered, saving a deep-clone on every action where undo is never used.
    setUndoState({
      label,
      sections: sectionsRef.current,
    });
    undoTimerRef.current = setTimeout(() => {
      setUndoState(null);
    }, 5500);
  }, []);

  const restoreUndo = () => {
    if (!undoState) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    // Clone only now — when the user actually triggers undo.
    setSections(cloneSections(undoState.sections));
    setUndoState(null);
  };

  const addBatchItems = useCallback((key: SectionKey, items: string[], undoLabel = "נוספו פריטים") => {
    const cleanItems = items.map((item) => item.trim()).filter(Boolean);
    if (cleanItems.length === 0) return;
    pushUndoState(undoLabel);

    setSections((prev) => {
      const user = activeUserRef.current;
      let maxId = 0;
      for (const item of prev[key].items) {
        if (item.id > maxId) maxId = item.id;
      }

      const newItems = cleanItems.map((text, index) => ({
        id: maxId + index + 1,
        text,
        completed: false,
        createdByUserId: user?.id,
        createdByName: user?.display_name || "לא ידוע",
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
  }, [pushUndoState]);

  const finalizeRecording = useCallback(async () => {
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
  }, [addBatchItems]);

  const startRecording = useCallback((key: SectionKey) => {
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
  }, [finalizeRecording]);

  const toggleRecording = useCallback((key: SectionKey) => {
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
  }, [activeRecording, startRecording]);

  const toggleRecipeRecording = useCallback(() => {
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
  }, [recipeRecording]);

  // Called by SectionInput.onAdd — text is already trimmed and non-empty.
  const handleAddItem = useCallback((key: SectionKey, text: string) => {
    void hapticLight();
    addBatchItems(key, [text], "נוסף פריט");
  }, [addBatchItems]);

  const toggleComplete = useCallback((key: SectionKey, id: number) => {
    const isCompleting = !sectionsRef.current[key].items.find((i) => i.id === id)?.completed;
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
  }, [pushUndoState]);

  const editItem = useCallback((key: SectionKey, id: number) => {
    const currentItem = sectionsRef.current[key].items.find((item) => item.id === id);
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
  }, [pushUndoState]);

  const deleteItem = useCallback((key: SectionKey, id: number) => {
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
  }, [pushUndoState]);

  const openRecipeModal = useCallback(() => {
    setRecipeError("");
    setRecipeNotes("");
    setRecipeQuestions([]);
    setRecipeItems([]);
    setRecipeAnswers({});
    setIsRecipeModalOpen(true);
  }, []);

  const handleRecipeAnswerChange = useCallback((questionId: string, value: RecipeAnswerValue) => {
    setRecipeError("");
    setRecipeAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handleRecipeClose = useCallback(() => {
    setIsRecipeModalOpen(false);
    setRecipeRecording(false);
    recipeRecognitionRef.current?.stop();
  }, []);

  const handleOpenUserProfile = useCallback(() => setIsUserProfileOpen(true), []);
  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), []);
  const handleCloseUserProfile = useCallback(() => setIsUserProfileOpen(false), []);
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), []);

  const reorderWithinSection = (
    key: SectionKey,
    sourceItemId: number,
    targetItemId: number,
  ) => {
    if (sourceItemId === targetItemId) return;
    pushUndoState("שונה סדר פריטים");

    setSections((prev) => {
      const items = [...prev[key].items];
      let sourceIndex = -1;
      let targetIndex = -1;
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === sourceItemId) sourceIndex = i;
        else if (items[i].id === targetItemId) targetIndex = i;
        if (sourceIndex >= 0 && targetIndex >= 0) break;
      }
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

  const saveHouseSettings = useCallback(async () => {
    const activeHouse = activeHouseRef.current;
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
  }, [settingsHouseName, settingsHouseImage]);

  const deleteActiveHouse = useCallback(async () => {
    const client = supabase;
    const activeHouse = activeHouseRef.current;
    const activeUser = activeUserRef.current;
    if (!client || !activeHouse || !activeUser) return;

    if (activeHouse.owner_user_id !== activeUser.id) {
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
  }, []);

  const runRecipeFallback = useCallback(() => {
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
  }, [recipeText, recipeAnswers]);

  const runRecipeAi = useCallback(async () => {
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
  }, [recipeText, recipeQuestions, recipeAnswers, runRecipeFallback]);

  const handleRunRecipe = useCallback(() => { void runRecipeAi(); }, [runRecipeAi]);

  const addRecipeItemsToSupermarket = useCallback(() => {
    addBatchItems("supermarketShopping", recipeItems, "נוספו פריטי מתכון");
    setRecipeItems([]);
    setRecipeQuestions([]);
    setRecipeAnswers({});
    setRecipeText("");
    setIsRecipeModalOpen(false);
  }, [recipeItems, addBatchItems]);


  const applyActiveHouse = useCallback((house: CloudHouseRow) => {
    // Discard stale data: if the incoming timestamp is older than (or equal to) what we
    // already accepted, don't overwrite — protects against race between fallback polling
    // returning old DB data after a save already completed.
    if (isStaleCloudUpdate(house.updated_at)) return;

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
  }, [isStaleCloudUpdate]);

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

  const removeMember = useCallback(async (memberId: string) => {
    const client = supabase;
    const activeHouse = activeHouseRef.current;
    const activeUser = activeUserRef.current;
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
  }, []);

  const leaveHouse = useCallback(async () => {
    const client = supabase;
    const activeHouse = activeHouseRef.current;
    const activeUser = activeUserRef.current;
    if (!client || !activeHouse || !activeUser) return;
    if (activeHouse.owner_user_id === activeUser.id) return;
    const { error } = await client
      .from("house_members")
      .delete()
      .eq("house_id", activeHouse.id)
      .eq("user_id", activeUser.id);
    if (!error) {
      setIsSettingsOpen(false);
      const otherHouse = memberHousesRef.current.find((h) => h.id !== activeHouse.id);
      await loadUserHouses(activeUser.id, otherHouse?.id);
    }
  }, []);

  const handleSaveHouseSettings = useCallback(() => { void saveHouseSettings(); }, [saveHouseSettings]);
  const handleDeleteHouse = useCallback(() => { void deleteActiveHouse(); }, [deleteActiveHouse]);
  const handleLeaveHouse = useCallback(() => { void leaveHouse(); }, [leaveHouse]);
  const handleSettingsOpenUserProfile = useCallback(() => {
    handleCloseSettings();
    handleOpenUserProfile();
  }, [handleCloseSettings, handleOpenUserProfile]);
  const handleSwitchHouse = useCallback(() => {
    setIsSettingsOpen(false);
    const uid = activeUserRef.current?.id;
    if (uid) window.localStorage.removeItem(getSelectedHouseStorageKey(uid));
    setActiveHouse(null);
    setInviteToken("");
  }, []);
  const handleSignOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setIsSettingsOpen(false);
    window.localStorage.removeItem(CACHED_USER_KEY);
    setActiveUser(null);
    setActiveHouse(null);
    setMemberHouses([]);
    setInviteToken("");
    setAuthError("");
    const uid = activeUserRef.current?.id;
    if (uid) window.localStorage.removeItem(getSelectedHouseStorageKey(uid));
    setUsernameInput("");
    setUserPasswordInput("");
    setDisplayNameInput("");
    setUserAvatarInput("");
  }, []);
  const handleCloseInviteModal = useCallback(() => setIsInviteModalOpen(false), []);

  const openInviteModal = useCallback(async () => {
    const client = supabase;
    const activeHouse = activeHouseRef.current;
    const activeUser = activeUserRef.current;
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
  }, []);

  const handleSettingsOpenInvite = useCallback(() => {
    handleCloseSettings();
    void openInviteModal();
  }, [handleCloseSettings, openInviteModal]);

  const normalizedPhone = invitePhone.replace(/[^\d+]/g, "");
  const inviteLink = useMemo(() => {
    if (!homeLink || !activeHouse) return homeLink;
    const url = new URL(homeLink);
    url.searchParams.set("house", activeHouse.id);
    if (inviteToken) url.searchParams.set("invite", inviteToken);
    return url.toString();
  }, [homeLink, activeHouse?.id, inviteToken]);
  const inviteMessage = useMemo(
    () => inviteLink
      ? `היי, מזמין אותך לבית שלי ב-Homly. זה לינק הצטרפות: ${inviteLink}`
      : "היי, מזמין אותך לבית שלי ב-Homly.",
    [inviteLink],
  );
  const smsHref = useMemo(
    () => `sms:${normalizedPhone}?body=${encodeURIComponent(inviteMessage)}`,
    [normalizedPhone, inviteMessage],
  );

  const shareInviteLink = useCallback(async () => {
    if (!inviteLink) return;
    void hapticLight();
    try {
      await nativeShare({ title: "Homly", text: inviteMessage, url: inviteLink });
      setInviteFeedback("הלינק שותף בהצלחה.");
    } catch {
      setInviteFeedback("לא הצלחתי לשתף כרגע.");
    }
  }, [inviteLink, inviteMessage]);

  const copyInviteLink = useCallback(async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteFeedback("הלינק הועתק ללוח.");
    } catch {
      setInviteFeedback("לא הצלחתי להעתיק את הלינק.");
    }
  }, [inviteLink]);

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

  const inviteMemberByIdentifier = useCallback(async () => {
    const client = supabase;
    const activeHouse = activeHouseRef.current;
    const activeUser = activeUserRef.current;
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
  }, [inviteIdentifierInput]);

  if (!isSupabaseConfigured) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl items-center px-4 py-8">
        <section className="w-full rounded-3xl border border-white/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-800/95 p-6 shadow-xl shadow-slate-200/70 dark:shadow-slate-900/50">
          <HomeLogo />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            כדי לעבוד בלי מצב מקומי, צריך להגדיר Supabase ולפרוס מחדש.
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            הגדר ב־env: `NEXT_PUBLIC_SUPABASE_URL` ו־`NEXT_PUBLIC_SUPABASE_ANON_KEY`.
          </p>
        </section>
      </main>
    );
  }

  if ((!isAuthReady || isAuthResolving) && !activeUser) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl items-center px-4 py-8">
        <section className="w-full rounded-3xl border border-white/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-800/95 p-6 text-center shadow-xl shadow-slate-200/70 dark:shadow-slate-900/50">
          <HomeLogo />
          <p className="mt-4 text-sm font-bold text-slate-700 dark:text-slate-200">טוען התחברות...</p>
          <LoadingBar done={isAuthReady} />
        </section>
      </main>
    );
  }

  if (!activeUser) {
    return (
      <AuthScreen
        authMode={authMode}
        usernameInput={usernameInput}
        emailInput={emailInput}
        userPasswordInput={userPasswordInput}
        displayNameInput={displayNameInput}
        userAvatarInput={userAvatarInput}
        isProcessingImage={isProcessingImage}
        authError={authError}
        authLoading={authLoading}
        isForgotPasswordOpen={isForgotPasswordOpen}
        forgotPasswordIdentifier={forgotPasswordIdentifier}
        forgotPasswordError={forgotPasswordError}
        forgotPasswordFeedback={forgotPasswordFeedback}
        isForgotPasswordLoading={isForgotPasswordLoading}
        isRecoveryMode={isRecoveryMode}
        recoveryPasswordInput={recoveryPasswordInput}
        recoveryPasswordConfirmInput={recoveryPasswordConfirmInput}
        recoveryPasswordError={recoveryPasswordError}
        recoveryPasswordFeedback={recoveryPasswordFeedback}
        isRecoveryPasswordLoading={isRecoveryPasswordLoading}
        setAuthMode={setAuthMode}
        setAuthError={setAuthError}
        setUsernameInput={setUsernameInput}
        setEmailInput={setEmailInput}
        setUserPasswordInput={setUserPasswordInput}
        setDisplayNameInput={setDisplayNameInput}
        setUserAvatarInput={setUserAvatarInput}
        setIsForgotPasswordOpen={setIsForgotPasswordOpen}
        setForgotPasswordIdentifier={setForgotPasswordIdentifier}
        setForgotPasswordError={setForgotPasswordError}
        setForgotPasswordFeedback={setForgotPasswordFeedback}
        setRecoveryPasswordInput={setRecoveryPasswordInput}
        setRecoveryPasswordConfirmInput={setRecoveryPasswordConfirmInput}
        handleCreateUser={handleCreateUser}
        handleLoginUser={handleLoginUser}
        handleForgotPassword={handleForgotPassword}
        handleRecoveryPasswordUpdate={handleRecoveryPasswordUpdate}
        handleUserAvatarFile={handleUserAvatarFile}
        openUserAvatarPicker={openUserAvatarPicker}
        userAvatarInputRef={userAvatarInputRef}
      />
    );
  }

  if (!activeHouse) {
    if (isHouseLoading) {
      return <HouseLoadingScreen cachedHouseMeta={cachedHouseMeta} houseMembers={houseMembers} />;
    }

    return (
      <HouseSelectorScreen
        activeUser={activeUser}
        houseCreateNameInput={houseCreateNameInput}
        setHouseCreateNameInput={setHouseCreateNameInput}
        handleCreateHouse={handleCreateHouse}
        houseCreateLoading={houseCreateLoading}
        joinTokenInput={joinTokenInput}
        setJoinTokenInput={setJoinTokenInput}
        handleJoinHouseByToken={handleJoinHouseByToken}
        joinLoading={joinLoading}
        memberHouses={memberHouses}
        applyActiveHouse={applyActiveHouse}
        houseListError={houseListError}
      />
    );
  }

  return (
    <main
      ref={mainScrollRef}
      className="relative mx-auto min-h-[100dvh] w-full max-w-[1600px] px-2 py-4 pb-[calc(7.25rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-6 sm:pb-8 lg:px-6"
      onTouchStart={handlePtrStart}
      onTouchMove={handlePtrMove}
      onTouchEnd={() => { void handlePtrEnd(); }}
    >
      <PullToRefreshIndicator
        ptrDist={ptrDist}
        isRefreshing={isRefreshing}
        isPtrDone={isPtrDone}
        ptrThreshold={PTR_THRESHOLD}
      />
      <HouseHeader
        activeHouse={activeHouse}
        activeUser={activeUser}
        onOpenUserProfile={handleOpenUserProfile}
        onOpenSettings={handleOpenSettings}
      />

      <HouseMembersSection
        houseMembers={houseMembers}
        isHouseMembersLoading={isHouseMembersLoading}
        isOwner={activeHouse?.owner_user_id === activeUser?.id}
        openInviteModal={openInviteModal}
        removeMember={removeMember}
      />

      <div>
        <DesktopFilterBar
          desktopSearchRef={desktopSearchRef}
          desktopQuery={desktopQuery}
          setDesktopQuery={setDesktopQuery}
          desktopFilter={desktopFilter}
          setDesktopFilter={setDesktopFilter}
          taskCount={sections.homeTasks.items.length}
          generalCount={sections.generalShopping.items.length}
          supermarketCount={sections.supermarketShopping.items.length}
        />

        {voiceError && (
          <p className="mb-3 rounded-2xl bg-rose-50 dark:bg-red-900/30 px-3 py-2 text-xs font-bold text-rose-700">
            {voiceError}
          </p>
        )}
        {undoState && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-yellow-900/30 px-3 py-2">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">{undoState.label}</p>
            <button
              type="button"
              onClick={restoreUndo}
              className="rounded-xl bg-amber-100 dark:bg-yellow-900/50 px-3 py-1 text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-yellow-900/70"
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
            {sectionOrder.map((key) => (
              <SectionCard
                key={key}
                sectionKey={key}
                section={sections[key]}
                visibleItems={sectionStats[key].visibleItems}
                progress={sectionStats[key].progress}
                isRecordingHere={activeRecording === key}
                processingRecording={processingRecording}
                isSpeechSupported={isSpeechSupported}
                houseMembersMap={houseMembersMap}
                activeUserId={activeUser?.id}
                activeUserAvatarUrl={activeUser?.avatar_url}
                onAddItem={handleAddItem}
                onToggle={toggleComplete}
                onEdit={editItem}
                onDelete={deleteItem}
                onToggleRecording={toggleRecording}
                onOpenRecipeModal={openRecipeModal}
                externalInputRefSetter={sectionInputRefSetters[key]}
              />
            ))}
          </section>
          <DragOverlay>
            {dragOverlayItem ? <DragOverlayItem item={dragOverlayItem} /> : null}
          </DragOverlay>
        </DndContext>

          {isRecipeModalOpen && (
            <Suspense fallback={null}><RecipeModal
              recipeText={recipeText}
              onRecipeTextChange={setRecipeText}
              recipeQuestions={recipeQuestions}
              recipeAnswers={recipeAnswers}
              onRecipeAnswerChange={handleRecipeAnswerChange}
              recipeItems={recipeItems}
              recipeNotes={recipeNotes}
              recipeError={recipeError}
              isRecipeLoading={isRecipeLoading}
              recipeRecording={recipeRecording}
              onToggleRecording={toggleRecipeRecording}
              onRunRecipe={handleRunRecipe}
              onAddToSupermarket={addRecipeItemsToSupermarket}
              onClose={handleRecipeClose}
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
              onInviteMember={inviteMemberByIdentifier}
              onShareLink={shareInviteLink}
              onCopyLink={copyInviteLink}
              onClose={handleCloseInviteModal}
            /></Suspense>
          )}
      </div>

      <BottomNav
        isMobile={isMobile}
        isNavHidden={isNavHidden}
        navDragY={navDragY}
        activeRecording={activeRecording}
        setIsNavHidden={setIsNavHidden}
        handleNavDragStart={handleNavDragStart}
        handleNavDragMove={handleNavDragMove}
        handleNavDragEnd={handleNavDragEnd}
      />

      {isUserProfileOpen && activeUser && (
        <UserProfileModal
          activeUser={activeUser}
          userProfileImage={userProfileImage}
          userProfileName={userProfileName}
          setUserProfileName={setUserProfileName}
          userProfileError={userProfileError}
          isSavingUserProfile={isSavingUserProfile}
          isProcessingImage={isProcessingImage}
          saveUserProfileSettings={saveUserProfileSettings}
          openUserProfileImagePicker={openUserProfileImagePicker}
          handleUserProfileImageFile={handleUserProfileImageFile}
          userProfileImageInputRef={userProfileImageInputRef}
          onClose={handleCloseUserProfile}
        />
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
          onSave={handleSaveHouseSettings}
          onDelete={handleDeleteHouse}
          onClose={handleCloseSettings}
          onOpenUserProfile={handleSettingsOpenUserProfile}
          onOpenInvite={handleSettingsOpenInvite}
          onSwitchHouse={handleSwitchHouse}
          onSignOut={handleSignOut}
          onLeaveHouse={handleLeaveHouse}
        /></Suspense>
      )}
    </main>
  );
}
