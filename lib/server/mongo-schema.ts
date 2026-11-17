import { MongoServerError, type Db, type Document } from "mongodb";

export const collections = {
  submissions: "submissions",
  contact: "contact_submissions",
  startup: "startup_submissions",
  subscription: "newsletter_subscriptions",
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
    if (schema) await db.command({ collMod: name, validator: { $jsonSchema: schema }, validationLevel: "strict", validationAction: "error" });
  }
}

export async function initializeDatabase(db: Db) {
  const commonProperties = {
    ...common,
    source: { bsonType: "string" },
    sourceCompany: { enum: ["MeWo"] },
    status: { bsonType: "string" },
  };
  const schema = (source: string, required: string[], properties: Document) => ({
    bsonType: "object",
    additionalProperties: false,
    required: ["_id", "source", "sourceCompany", "status", "createdAt", "updatedAt", ...required],
    properties: { ...commonProperties, source: { enum: [source] }, ...properties },
  });
  await createCollection(db, collections.contact, schema("contact", ["name", "email", "phone", "message"], {
    ...inquiry, subject: { bsonType: "string", maxLength: 200 },
  }));
  await createCollection(db, collections.startup, schema("startup", ["name", "email", "phone", "message"], {
    ...inquiry,
    startupName: { bsonType: "string", maxLength: 200 },
    websiteUrl: { bsonType: "string", maxLength: 2048 },
    linkedinProfileUrl: { bsonType: "string", maxLength: 2048 },
    presentation: {
      bsonType: "object", additionalProperties: false,
      required: ["fileId", "filename", "mimeType", "size", "sha256"],
      properties: {
        fileId: { bsonType: "objectId" }, filename: { bsonType: "string" },
        mimeType: { bsonType: "string" }, size: { bsonType: ["int", "long", "double"] },
        sha256: { bsonType: "string" }, presentationLink: { bsonType: "string", maxLength: 2048 },
      },
    },
  }));
  await createCollection(db, collections.subscription, schema("subscription", ["email"], {
    email: inquiry.email,
  }));
  await createCollection(db, collections.limits);
  for (const name of [collections.contact, collections.startup, collections.subscription]) {
    await db.collection(name).createIndex({ createdAt: -1 }, { name: "createdAt_desc" });
  }
  await db.collection(collections.contact).createIndex({ email: 1 }, { name: "email" });
  await db.collection(collections.startup).createIndex({ email: 1 }, { name: "email" });
  await db.collection(collections.subscription).createIndex({ email: 1 }, { unique: true, name: "subscription_email_unique" });
  await db.collection(collections.limits).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "expiresAt_ttl" });
}