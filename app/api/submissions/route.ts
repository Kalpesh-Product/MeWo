import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server/env";
import { getDatabase } from "@/lib/server/mongodb";
import { parseSubmissionsQuery, readSubmissions, validReadToken } from "@/lib/server/submissions-reader";

function responseHeaders(request: Request) {
  const env = serverEnv();
  const origin = request.headers.get("origin");
  const allowed = !origin || origin === new URL(request.url).origin || env.MEWO_SUBMISSIONS_ALLOWED_ORIGINS.includes(origin);
  const headers = new Headers({ "Cache-Control": "private, no-store", "X-Request-Id": randomUUID(), Vary: "Origin" });
  if (origin && allowed) headers.set("Access-Control-Allow-Origin", origin);
  return { env, allowed, headers };
}

export async function GET(request: Request) {
  // Fail closed before opening MongoDB or returning submission metadata.
  let headers = new Headers({ "Cache-Control": "private, no-store", Vary: "Origin" });
  try {
    const context = responseHeaders(request);
    headers = context.headers;
    if (!context.allowed) return NextResponse.json({ message: "Origin is not allowed." }, { status: 403, headers });
    if (!context.env.MEWO_SUBMISSIONS_API_KEY) return NextResponse.json({ message: "Read API is not configured." }, { status: 503, headers });
    if (!validReadToken(request.headers.get("authorization"), context.env.MEWO_SUBMISSIONS_API_KEY)) {
      headers.set("WWW-Authenticate", "Bearer");
      return NextResponse.json({ message: "A valid bearer API key is required." }, { status: 401, headers });
    }
    let query;
    try { query = parseSubmissionsQuery(new URL(request.url).searchParams); }
    catch { return NextResponse.json({ message: "Invalid query. Use page (1–10000), pageSize (1–100), kind or source (contact/startup/subscription), status, search (max 100), sortBy and sortOrder (asc/desc). If both kind and source are supplied, they must match." }, { status: 400, headers }); }
    const result = await readSubmissions(await getDatabase(), query);
    return NextResponse.json(result, { headers });
  } catch (error) {
    console.error("Submissions read failed", { requestId: headers.get("X-Request-Id"), errorType: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ message: "Unable to fetch submissions. Please try again later." }, { status: 503, headers });
  }
}

export function OPTIONS(request: Request) {
  try {
    const { allowed, headers } = responseHeaders(request);
    if (!allowed) return new Response(null, { status: 403, headers });
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    headers.set("Access-Control-Max-Age", "600");
    return new Response(null, { status: 204, headers });
  } catch { return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
