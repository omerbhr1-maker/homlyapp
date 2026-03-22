import { Capacitor } from "@capacitor/core";

const isNative = Capacitor.isNativePlatform();

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
