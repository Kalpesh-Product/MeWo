import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/mongodb";
import { InquiryError, parseInquiry, parsePresentation, readFormData } from "@/lib/server/inquiry-validation";
import { checkSubmissionRate, saveInquiry } from "@/lib/server/inquiry-storage";
import { serverEnv } from "@/lib/server/env";

export async function POST(request: Request) {
  const requestId = randomUUID();
  const headers = { "Cache-Control": "no-store", "X-Request-Id": requestId };
  try {
    const origin = request.headers.get("origin");
    const allowed = [new URL(request.url).origin, ...serverEnv().MEWO_ALLOWED_ORIGINS];
    if (origin && !allowed.includes(origin)) throw new InquiryError("Invalid request origin.", 403);
    const form = await readFormData(request);
    if (form.get("fax_number")) {
      return NextResponse.json({ message: "Thank you! Your submission has been received." }, { status: 202, headers });
    }
    const inquiry = parseInquiry(form);
    const attachment = await parsePresentation(form, inquiry.kind);
    const db = await getDatabase();
    await checkSubmissionRate(db, inquiry);
    await saveInquiry(db, inquiry, attachment);
    return NextResponse.json({
      message: inquiry.kind === "subscription" ? "Thank you for subscribing!" : "Thank you! Your enquiry has been received.",
    }, { status: inquiry.kind === "subscription" ? 200 : 201, headers });
  } catch (error) {
    if (error instanceof InquiryError) {
      return NextResponse.json({ message: error.message }, {
        status: error.status, headers: { ...headers, ...(error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}) },
      });
    }
    // Do not log submitted personal details, attachment bytes or connection strings.
    console.error("Inquiry persistence failed", { requestId, errorType: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ message: "Unable to save right now. Please try again or email response@biznest.co.in." }, { status: 503, headers });
  }
}
