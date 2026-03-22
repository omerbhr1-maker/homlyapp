/**
 * Supabase Edge Function — send-push
 * שולח Push Notification לכל חברי הבית כשמישהו מוסיף פריט.
 *
 * Trigger: קרא לפונקציה הזו מהלקוח אחרי הוספת פריט.
 *
 * ENV variables (set in Supabase Dashboard → Edge Functions → Secrets):
 *   APNS_KEY_ID       — מזהה ה-APNs Key שיצרת ב-Apple Developer Console
 *   APNS_TEAM_ID      — מזהה ה-Team שלך ב-Apple Developer
 *   APNS_BUNDLE_ID    — Bundle ID של האפליקציה (למשל com.yourname.homly)
 *   APNS_PRIVATE_KEY  — תוכן ה-.p8 file (כולל BEGIN/END PRIVATE KEY)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APNS_HOST = "https://api.push.apple.com";

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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // מציא את כל חברי הבית (חוץ מהשולח אם תרצה)
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

    // שולח APNs JWT (פשטות — יש להחליף ב-JWT signing אמיתי)
    const apnsKeyId = Deno.env.get("APNS_KEY_ID") ?? "";
    const apnsTeamId = Deno.env.get("APNS_TEAM_ID") ?? "";
    const apnsBundleId = Deno.env.get("APNS_BUNDLE_ID") ?? "";

    // TODO: sign JWT properly using apns private key
    // לצורך production — יש להשתמש ב-JWT signing עם ES256
    const apnsJwt = `${apnsTeamId}.${apnsKeyId}`; // placeholder

    const notification = {
      aps: {
        alert: {
          title: "Homly 🏠",
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
