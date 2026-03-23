/**
 * Supabase Edge Function — send-push
 * שולח Push Notification לכל חברי הבית כשמישהו מוסיף פריט.
 *
 * Trigger: קרא לפונקציה הזו מהלקוח אחרי הוספת פריט.
 *
 * ENV variables (set in Supabase Dashboard → Edge Functions → Secrets):
 *   APNS_KEY_ID       — מזהה ה-APNs Key שיצרת ב-Apple Developer Console
 *   APNS_TEAM_ID      — מזהה ה-Team שלך ב-Apple Developer
 *   APNS_BUNDLE_ID    — Bundle ID של האפליקציה (למשל com.omerb.homly)
 *   APNS_PRIVATE_KEY  — תוכן ה-.p8 file (כולל BEGIN/END PRIVATE KEY)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APNS_HOST = "https://api.push.apple.com";

// ── JWT signing with ES256 ────────────────────────────────────────────────────

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function makeApnsJwt(keyId: string, teamId: string, p8Pem: string): Promise<string> {
  // Strip PEM headers and decode base64
  const pemBody = p8Pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const header = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ alg: "ES256", kid: keyId })),
  );
  const payload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })),
  );

  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );

  return `${header}.${payload}.${base64UrlEncode(sigBuf)}`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const { house_id, sender_name, item_text } = await req.json() as {
      house_id: string;
      sender_name: string;
      item_text: string;
    };

    if (!house_id || !sender_name || !item_text) {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // מציא את כל חברי הבית
    const { data: members } = await supabase
      .from("house_members")
      .select("user_id")
      .eq("house_id", house_id);

    if (!members?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

    const userIds = members.map((m: { user_id: string }) => m.user_id);

    // מציא tokens
    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token")
      .in("user_id", userIds);

    if (!tokens?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

    const apnsKeyId = Deno.env.get("APNS_KEY_ID") ?? "";
    const apnsTeamId = Deno.env.get("APNS_TEAM_ID") ?? "";
    const apnsBundleId = Deno.env.get("APNS_BUNDLE_ID") ?? "";
    const apnsPrivateKey = Deno.env.get("APNS_PRIVATE_KEY") ?? "";

    // יוצר JWT חתום עם ES256
    const apnsJwt = await makeApnsJwt(apnsKeyId, apnsTeamId, apnsPrivateKey);

    const notification = {
      aps: {
        alert: {
          title: "הומלי 🏠",
          body: `${sender_name} הוסיף: ${item_text}`,
        },
        sound: "default",
        badge: 1,
      },
    };

    let sent = 0;
    for (const { token } of tokens) {
      const res = await fetch(`${APNS_HOST}/3/device/${token}`, {
        method: "POST",
        headers: {
          "authorization": `bearer ${apnsJwt}`,
          "apns-topic": apnsBundleId,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-type": "application/json",
        },
        body: JSON.stringify(notification),
      }).catch(() => null);
      if (res?.status === 200) sent++;
    }

    return new Response(JSON.stringify({ sent }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
