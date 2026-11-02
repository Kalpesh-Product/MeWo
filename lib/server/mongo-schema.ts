import { MongoServerError, type Db, type Document } from "mongodb";

export const collections = {
  submissions: "submissions",
  limits: "submission_rate_limits",
} as const;
export const presentationBucket = "presentations";

const common = {
  _id: { bsonType: "objectId" },
  createdAt: { bsonType: "date" }, updatedAt: { bsonType: "date" },
};
const inquiry = {
  email: { bsonType: "string", maxLength: 200 },
  name: { bsonType: "string", minLength: 1, maxLength: 200 },
  phone: { bsonType: "string", maxLength: 30 },
  message: { bsonType: "string", minLength: 1, maxLength: 10000 },
};

async function createCollection(db: Db, name: string, schema?: Document) {
  try {
    await db.createCollection(name, schema ? {
      validator: { $jsonSchema: schema }, validationLevel: "strict", validationAction: "error",
    } : {});
  } catch (error) {
    // Setup must not replace existing collections or modify their records.
    if (!(error instanceof MongoServerError && error.code === 48)) throw error;
  }
}

export async function initializeDatabase(db: Db) {
  const fields = {
    ...inquiry, subject: { bsonType: "string", maxLength: 200 },
      startupName: { bsonType: "string", maxLength: 200 },
      websiteUrl: { bsonType: "string", maxLength: 2048 },
      linkedinProfileUrl: { bsonType: "string", maxLength: 2048 },
      presentation: {
        bsonType: "object", additionalProperties: false,
        required: ["fileId", "filename", "mimeType", "size", "sha256"],
        properties: {
          fileId: { bsonType: "objectId" }, filename: { bsonType: "string" },
          mimeType: { bsonType: "string" }, size: { bsonType: ["int", "long", "double"] }, sha256: { bsonType: "string" },
        },
      },
  };
  const branch = (source: string, required: string[], statuses: string[], properties: Document) => ({
    bsonType: "object", additionalProperties: false,
    required: ["_id", "source", "fields", "status", "createdAt", "updatedAt"],
    properties: {
      ...common, source: { enum: [source] }, status: { enum: statuses },
      fields: { bsonType: "object", additionalProperties: false, required, properties },
    },
  });
  await createCollection(db, collections.submissions, {
    oneOf: [
      branch("contact", ["name", "email", "phone", "message"], ["new", "in_progress", "resolved"], {
        ...inquiry, subject: fields.subject,
      }),
      branch("startup", ["name", "email", "phone", "message"], ["new", "in_progress", "resolved"], {
        ...inquiry, startupName: fields.startupName, websiteUrl: fields.websiteUrl,
        linkedinProfileUrl: fields.linkedinProfileUrl, presentation: fields.presentation,
      }),
      branch("subscription", ["email"], ["subscribed", "unsubscribed"], { email: inquiry.email }),
    ],
  });
  await createCollection(db, collections.limits);
  await createCollection(db, `${presentationBucket}.files`);
  await createCollection(db, `${presentationBucket}.chunks`);
  await db.collection(collections.submissions).createIndexes([
      { key: { createdAt: -1 }, name: "createdAt_desc" },
      { key: { source: 1, status: 1, createdAt: -1 }, name: "source_status_createdAt" },
      { key: { "fields.email": 1 }, name: "email" },
      { key: { source: 1, "fields.email": 1 }, unique: true,
        partialFilterExpression: { source: "subscription" }, name: "subscription_email_unique" },
    ]);
  await db.collection(collections.limits).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "expiresAt_ttl" });
  await db.collection(`${presentationBucket}.files`).createIndex({ filename: 1, uploadDate: 1 }, { name: "filename_1_uploadDate_1" });
  await db.collection(`${presentationBucket}.chunks`).createIndex({ files_id: 1, n: 1 }, { unique: true, name: "files_id_1_n_1" });
}
