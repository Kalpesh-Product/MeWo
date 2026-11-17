import { createHash } from "node:crypto";
import { MongoServerError, ObjectId, type Db } from "mongodb";
import { collections } from "./mongo-schema";
import { deleteAttachment, uploadAttachment } from "./s3-attachments.mjs";
import { InquiryError, type Inquiry, type Presentation } from "./inquiry-validation";

const WINDOW_MS = 15 * 60 * 1000;
export async function checkSubmissionRate(db: Db, inquiry: Inquiry, now = new Date()) {
  const end = (Math.floor(now.getTime() / WINDOW_MS) + 1) * WINDOW_MS;
  const key = createHash("sha256").update(`${inquiry.kind}:${inquiry.email}:${end}`).digest("hex");
  try {
    await db.collection<{ _id: string; count: number; expiresAt: Date }>(collections.limits).findOneAndUpdate(
      { _id: key, count: { $lt: 5 } },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(end) } },
      { upsert: true, returnDocument: "after" },
    );
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new InquiryError("Too many submissions for this email. Please try again later.", 429, Math.max(1, Math.ceil((end - now.getTime()) / 1000)));
    }
    throw error;
  }
}

export async function saveInquiry(db: Db, inquiry: Inquiry, attachment?: Presentation) {
  const now = new Date();
  if (inquiry.kind === "subscription") {
    try {
      await db.collection(collections.subscription).updateOne({ source: "subscription", email: inquiry.email }, {
        $setOnInsert: { email: inquiry.email, sourceCompany: "MeWo", status: "subscribed", source: "subscription", createdAt: now },
        $set: { updatedAt: now },
      }, { upsert: true });
    } catch (error) {
      // Concurrent signups can race on the unique email index; both are accepted.
      if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
    }
    return;
  }
  const _id = new ObjectId();
  const base = {
    _id, status: "new", source: inquiry.kind, sourceCompany: "MeWo",
    createdAt: now, updatedAt: now,
  };
  const fields = { name: inquiry.name, email: inquiry.email, phone: inquiry.phone, message: inquiry.message };
  if (inquiry.kind === "contact") {
    await db.collection(collections.contact).insertOne({ ...base, ...fields, subject: inquiry.subject });
    return;
  }
  const presentation = attachment ? {
    fileId: _id,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
    sha256: attachment.sha256,
    presentationLink: await uploadAttachment(_id.toHexString(), attachment.filename, attachment.mimeType, attachment.bytes),
  } : undefined;
  try {
    await db.collection(collections.startup).insertOne({
      ...base, ...fields, startupName: inquiry.startup_name, websiteUrl: inquiry.website_url,
        linkedinProfileUrl: inquiry.linkedin_profile_url, ...(presentation ? { presentation } : {}),
    });
  } catch (error) {
    if (presentation) {
      // A timeout may follow a committed write; check before deleting the file.
      try {
        if (!await db.collection(collections.startup).findOne({ _id })) await deleteAttachment(presentation.presentationLink);
      } catch { /* Leave the private file intact if MongoDB is unavailable. */ }
    }
    throw error;
  }
}
