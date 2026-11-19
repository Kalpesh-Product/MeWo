import { MongoServerError, ObjectId } from "mongodb";
import { submissionsWriteKey } from "@/lib/server/env";
import { InquiryError, parseSubmissionEdits } from "@/lib/server/inquiry-validation";
import { collections } from "@/lib/server/mongo-schema";
import { getDatabase } from "@/lib/server/mongodb";
import { responseHeaders, submissionsPreflight } from "@/lib/server/submissions-access";
import { submissionProjection, submissionRow, validSubmissionsToken } from "@/lib/server/submissions-reader";

const maxPatchBytes = 128 * 1024;
const editableCollections = { contact: collections.contact, startup: collections.startup, subscription: collections.subscription };

async function readPatch(request: Request): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) {
    throw new InquiryError("Use Content-Type: application/json.", 415);
  }
  if (Number(request.headers.get("content-length")) > maxPatchBytes) throw new InquiryError("The edit exceeds 128 KiB.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InquiryError("Send a non-empty JSON object.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxPatchBytes) {
        await reader.cancel();
        throw new InquiryError("The edit exceeds 128 KiB.", 413);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof InquiryError) throw error;
    throw new InquiryError("Invalid JSON body.");
  } finally { reader.releaseLock(); }
}

export function OPTIONS(request: Request) {
  return submissionsPreflight(request, "PATCH");
}

export async function PATCH(request: Request, { params }: { params: Promise<{ collection: string; id: string }> }) {
  let headers = new Headers({ "Cache-Control": "private, no-store", Vary: "Origin" });
  const reply = (message: string, status: number) => Response.json({ message }, { status, headers });
  try {
    const context = responseHeaders(request);
    headers = context.headers;
    if (!context.allowed) return reply("Origin is not allowed.", 403);
    const key = submissionsWriteKey();
    if (!key) return reply("Write API is not configured.", 503);
    if (!validSubmissionsToken(request.headers.get("authorization"), key)) {
      headers.set("WWW-Authenticate", "Bearer");
      return reply("A valid write bearer API key is required.", 401);
    }

    const { collection, id } = await params;
    if (!Object.hasOwn(editableCollections, collection)) return reply("Unknown submission collection.", 404);
    if (!/^[a-f0-9]{24}$/i.test(id)) return reply("Use the submission ID returned by the list API.", 400);
    const source = collection as keyof typeof editableCollections;
    const fields = parseSubmissionEdits(source, await readPatch(request));
    const updated = await (await getDatabase()).collection(editableCollections[source]).findOneAndUpdate(
      { _id: new ObjectId(id), source },
      { $set: fields, $currentDate: { updatedAt: true } },
      { projection: submissionProjection, returnDocument: "after" },
    );
    if (!updated) return reply("Submission not found in this collection.", 404);
    return Response.json({ data: submissionRow(updated) }, { headers });
  } catch (error) {
    if (error instanceof InquiryError) return reply(error.message, error.status);
    if (error instanceof MongoServerError && error.code === 11000) return reply("That newsletter email is already subscribed or recorded.", 409);
    console.error("Submissions update failed", { requestId: headers.get("X-Request-Id"), errorType: error instanceof Error ? error.name : "UnknownError" });
    return reply("Unable to update submission. Please try again later.", 503);
  }
}
