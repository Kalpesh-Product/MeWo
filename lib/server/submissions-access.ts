import { randomUUID } from "node:crypto";
import { serverEnv } from "./env";

export function responseHeaders(request: Request) {
  const env = serverEnv();
  const origin = request.headers.get("origin");
  const allowed = !origin || origin === new URL(request.url).origin || env.MEWO_SUBMISSIONS_ALLOWED_ORIGINS.includes(origin);
  const headers = new Headers({ "Cache-Control": "private, no-store", "X-Request-Id": randomUUID(), Vary: "Origin" });
  if (origin && allowed) headers.set("Access-Control-Allow-Origin", origin);
  return { env, allowed, headers };
}

export function submissionsPreflight(request: Request, method: "GET" | "PATCH") {
  try {
    const { allowed, headers } = responseHeaders(request);
    if (!allowed) return new Response(null, { status: 403, headers });
    headers.set("Access-Control-Allow-Methods", `${method}, OPTIONS`);
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    headers.set("Access-Control-Max-Age", "600");
    return new Response(null, { status: 204, headers });
  } catch { return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
