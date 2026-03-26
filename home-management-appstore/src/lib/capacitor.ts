import { Capacitor } from "@capacitor/core";

const isNative = Capacitor.isNativePlatform();
export { isNative };

// ─── Haptic Feedback ──────────────────────────────────────────────────────────

let HapticsPlugin: typeof import("@capacitor/haptics").Haptics | null = null;

async function getHaptics() {
  if (!isNative) return null;
  if (!HapticsPlugin) {
    const { Haptics } = await import("@capacitor/haptics");
    HapticsPlugin = Haptics;
  }
  return HapticsPlugin;
}

export async function hapticSuccess() {
  const h = await getHaptics();
  if (!h) return;
  const { ImpactStyle } = await import("@capacitor/haptics");
  await h.impact({ style: ImpactStyle.Medium }).catch(() => {});
}

export async function hapticLight() {
  const h = await getHaptics();
  if (!h) return;
  const { ImpactStyle } = await import("@capacitor/haptics");
  await h.impact({ style: ImpactStyle.Light }).catch(() => {});
}

export async function hapticHeavy() {
  const h = await getHaptics();
  if (!h) return;
  const { ImpactStyle } = await import("@capacitor/haptics");
  await h.impact({ style: ImpactStyle.Heavy }).catch(() => {});
}

export async function hapticNotificationSuccess() {
  const h = await getHaptics();
  if (!h) return;
  const { NotificationType } = await import("@capacitor/haptics");
  await h.notification({ type: NotificationType.Success }).catch(() => {});
}

export async function hapticNotificationError() {
  const h = await getHaptics();
  if (!h) return;
  const { NotificationType } = await import("@capacitor/haptics");
  await h.notification({ type: NotificationType.Error }).catch(() => {});
}

// ─── Share Sheet ──────────────────────────────────────────────────────────────

export async function nativeShare(options: { title: string; text: string; url?: string }) {
  if (isNative) {
    const { Share } = await import("@capacitor/share");
    const canShare = await Share.canShare();
    if (canShare.value) {
      await Share.share(options).catch(() => {});
      return;
    }
  }
  // fallback ל-Web Share API
  if (navigator.share) {
    await navigator.share(options).catch(() => {});
    return;
  }
  // fallback לcopy
  await navigator.clipboard.writeText(options.url ?? options.text).catch(() => {});
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────

export async function setupKeyboardListeners(
  onShow: (height: number) => void,
  onHide: () => void
) {
  if (!isNative) return () => {};
  const { Keyboard } = await import("@capacitor/keyboard");
  await Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(() => {});
  const showListener = await Keyboard.addListener("keyboardWillShow", (info) => {
    onShow(info.keyboardHeight);
  });
  const hideListener = await Keyboard.addListener("keyboardWillHide", () => {
    onHide();
  });
  return () => {
    showListener.remove();
    hideListener.remove();
  };
}

// ─── Push Notifications ───────────────────────────────────────────────────────

export async function requestPushPermission(): Promise<string | null> {
  if (!isNative) return null;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") return null;
    await PushNotifications.register();
    return await new Promise((resolve) => {
      PushNotifications.addListener("registration", (token) => {
        resolve(token.value);
      });
      PushNotifications.addListener("registrationError", () => {
        resolve(null);
      });
      setTimeout(() => resolve(null), 10000);
    });
  } catch {
    return null;
  }
}

export async function setupPushListeners(
  onNotification: (title: string, body: string) => void
) {
  if (!isNative) return () => {};
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const listener = await PushNotifications.addListener(
    "pushNotificationReceived",
    (notification) => {
      onNotification(notification.title ?? "", notification.body ?? "");
    }
  );
  return () => listener.remove();
}

// ─── Status Bar ────────────────────────────────────────────────────────────────

export async function setupStatusBar() {
  if (!isNative) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: true });
    // Set style based on current color scheme
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    await StatusBar.setStyle({ style: prefersDark ? Style.Light : Style.Dark });
    // Listen for color-scheme changes and update status bar accordingly
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", async (e) => {
      await StatusBar.setStyle({ style: e.matches ? Style.Light : Style.Dark }).catch(() => {});
    });
  } catch {}
}

// ─── Splash Screen ─────────────────────────────────────────────────────────────

export async function hideSplashScreen() {
  if (!isNative) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch {}
}

// ─── Network ───────────────────────────────────────────────────────────────────

export async function getNetworkStatus(): Promise<boolean> {
  if (!isNative) return navigator.onLine;
  try {
    const { Network } = await import("@capacitor/network");
    const status = await Network.getStatus();
    return status.connected;
  } catch {
    return navigator.onLine;
  }
}

export async function addNetworkListener(
  onChange: (connected: boolean) => void
): Promise<() => void> {
  if (!isNative) {
    const onOnline = () => onChange(true);
    const onOffline = () => onChange(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }
  try {
    const { Network } = await import("@capacitor/network");
    const listener = await Network.addListener("networkStatusChange", (status) => {
      onChange(status.connected);
    });
    return () => listener.remove();
  } catch {
    return () => {};
  }
}

// ─── App Lifecycle ─────────────────────────────────────────────────────────────

export async function addAppStateListener(
  onResume: () => void,
  onPause?: () => void
): Promise<() => void> {
  if (!isNative) return () => {};
  try {
    const { App } = await import("@capacitor/app");
    const listener = await App.addListener("appStateChange", (state) => {
      if (state.isActive) onResume();
      else onPause?.();
    });
    return () => listener.remove();
  } catch {
    return () => {};
  }
}

// ─── Universal Links (appUrlOpen) ─────────────────────────────────────────────

export async function addAppUrlOpenListener(
  onUrl: (url: string) => void
): Promise<() => void> {
  if (!isNative) return () => {};
  try {
    const { App } = await import("@capacitor/app");
    const listener = await App.addListener("appUrlOpen", (event) => {
      onUrl(event.url);
    });
    return () => listener.remove();
  } catch {
    return () => {};
  }
}
