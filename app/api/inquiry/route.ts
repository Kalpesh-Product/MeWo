import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json(
      { message: "Invalid request origin." },
      { status: 403 },
    );
  if (Number(request.headers.get("content-length") || 0) > 10 * 1024 * 1024)
    return NextResponse.json(
      { message: "Please keep attachments below 10 MB." },
      { status: 413 },
    );
  const form = await request.formData();
  const kind = String(form.get("kind") || "");
  const email = String(form.get("email") || "");
  if (
    !["contact", "startup", "subscription"].includes(kind) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 200
  )
    return NextResponse.json(
      { message: "Please enter a valid email address." },
      { status: 400 },
    );
  if (
    kind !== "subscription" &&
    (!String(form.get("name") || "").trim() ||
      !String(form.get("message") || "").trim())
  )
    return NextResponse.json(
      { message: "Please complete your name and message." },
      { status: 400 },
    );
  const attachment = form.get("presentation");
  if (attachment instanceof File && attachment.size > 10 * 1024 * 1024)
    return NextResponse.json(
      { message: "Please keep attachments below 10 MB." },
      { status: 413 },
    );
  const endpoint = process.env.MEWO_INQUIRY_ENDPOINT;
  if (!endpoint)
    return NextResponse.json(
      {
        message:
          "Online submissions are not configured yet. Please email response@biznest.co.in or call +91 80071 26444.",
      },
      { status: 503 },
    );
  try {
    const result = await fetch(endpoint, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(15000),
    });
    if (!result.ok) throw new Error("Delivery failed");
    return NextResponse.json({
      message:
        kind === "subscription"
          ? "Thank you for subscribing!"
          : "Thank you! Your message has been sent.",
    });
  } catch {
    return NextResponse.json(
      {
        message:
          "Unable to send right now. Please email response@biznest.co.in.",
      },
      { status: 502 },
    );
  }
}
