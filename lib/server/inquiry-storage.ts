import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { GridFSBucket, MongoServerError, ObjectId, type Db } from "mongodb";
import { collections, presentationBucket } from "./mongo-schema";
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
      await db.collection(collections.submissions).updateOne({ source: "subscription", "fields.email": inquiry.email }, {
        $setOnInsert: { fields: { email: inquiry.email }, status: "subscribed", source: "subscription", createdAt: now },
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
    _id, status: "new", source: inquiry.kind,
    createdAt: now, updatedAt: now,
  };
  const fields = { name: inquiry.name, email: inquiry.email, phone: inquiry.phone, message: inquiry.message };
  if (inquiry.kind === "contact") {
    await db.collection(collections.submissions).insertOne({ ...base, fields: { ...fields, subject: inquiry.subject } });
    return;
  }
  const bucket = new GridFSBucket(db, { bucketName: presentationBucket });
  let presentation;
  if (attachment) {
    const upload = bucket.openUploadStream(attachment.filename, {
      metadata: { submissionId: _id, mimeType: attachment.mimeType, sha256: attachment.sha256 },
    });
    try { await pipeline(Readable.from(attachment.bytes), upload); }
    catch (error) { await upload.abort().catch(() => {}); throw error; }
    presentation = { fileId: upload.id, filename: attachment.filename, mimeType: attachment.mimeType, size: attachment.size, sha256: attachment.sha256 };
  }
  try {
    await db.collection(collections.submissions).insertOne({
      ...base, fields: { ...fields, startupName: inquiry.startup_name, websiteUrl: inquiry.website_url,
        linkedinProfileUrl: inquiry.linkedin_profile_url, ...(presentation ? { presentation } : {}) },
    });
  } catch (error) {
    if (presentation) {
      // A timeout may follow a committed write; check before deleting the file.
      try {
        if (!await db.collection(collections.submissions).findOne({ _id })) await bucket.delete(presentation.fileId);
      } catch { /* Leave the private file intact if MongoDB is unavailable. */ }
    }
    throw error;
  }
}
