export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, source: "pages-function" }), {
    headers: { "Content-Type": "application/json" },
  });
}
