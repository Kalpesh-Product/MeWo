import { createHash, timingSafeEqual } from "node:crypto";
import type { Db, Document } from "mongodb";
import { z } from "zod";
import { collections } from "./mongo-schema";

const sortFields = {
  createdAt: "createdAt", updatedAt: "updatedAt", source: "source", status: "status",
  name: "fields.name", email: "fields.email", phone: "fields.phone",
  subject: "fields.subject", startupName: "fields.startupName",
} as const;
const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  source: z.enum(["contact", "startup", "subscription"]).optional(),
  kind: z.enum(["contact", "startup", "subscription"]).optional(),
  status: z.enum(["new", "in_progress", "resolved", "subscribed", "unsubscribed"]).optional(),
  search: z.string().trim().max(100).default(""),
  sortBy: z.enum(["createdAt", "updatedAt", "source", "status", "name", "email", "phone", "subject", "startupName"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict();

export function parseSubmissionsQuery(parameters: URLSearchParams) {
  const values: Record<string, string> = {};
  for (const [key, value] of parameters) {
    if (parameters.getAll(key).length !== 1) throw new Error("Duplicate query parameters are not supported.");
    values[key] = value;
  }
  const { kind, ...query } = querySchema.parse(values);
  if (kind && query.source && kind !== query.source) throw new Error("kind and source must match when both are provided.");
  return { ...query, ...(kind ? { source: kind } : {}) };
}

export function validReadToken(header: string | null, expected: string) {
  if (!expected || !header?.startsWith("Bearer ")) return false;
  const token = header.slice(7);
  if (!token || token.length > 512) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(token), digest(expected));
}

export async function readSubmissions(db: Db, query: ReturnType<typeof parseSubmissionsQuery>) {
  const filter: Document = {};
  if (query.source) filter.source = query.source;
  if (query.status) filter.status = query.status;
  if (query.search) {
    const literal = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = ["name", "email", "phone", "subject", "message", "startupName", "websiteUrl", "linkedinProfileUrl"]
      .map((field) => ({ [`fields.${field}`]: { $regex: literal, $options: "i" } }));
  }
  const collection = db.collection(collections.submissions);
  const projection = {
    _id: 1, source: 1, status: 1, createdAt: 1, updatedAt: 1,
    "fields.name": 1, "fields.email": 1, "fields.phone": 1, "fields.subject": 1, "fields.message": 1,
    "fields.startupName": 1, "fields.websiteUrl": 1, "fields.linkedinProfileUrl": 1,
    "fields.presentation.fileId": 1, "fields.presentation.filename": 1,
    "fields.presentation.mimeType": 1, "fields.presentation.size": 1,
  };
  const [total, filteredTotal, documents] = await Promise.all([
    collection.countDocuments({}, { maxTimeMS: 5000 }),
    collection.countDocuments(filter, { maxTimeMS: 5000 }),
    collection.find(filter, { projection, maxTimeMS: 5000 })
      .sort({ [sortFields[query.sortBy]]: query.sortOrder === "asc" ? 1 : -1, _id: 1 })
      .skip((query.page - 1) * query.pageSize).limit(query.pageSize).toArray(),
  ]);
  const data = documents.map((record) => {
    const fields = record.fields;
    return {
      id: record._id.toHexString(), source: record.source, status: record.status,
      name: fields.name ?? null, email: fields.email, phone: fields.phone ?? null,
      subject: fields.subject ?? null, message: fields.message ?? null,
      startupName: fields.startupName ?? null, websiteUrl: fields.websiteUrl ?? null,
      linkedinProfileUrl: fields.linkedinProfileUrl ?? null,
      presentation: fields.presentation ? {
        id: fields.presentation.fileId.toHexString(), filename: fields.presentation.filename,
        mimeType: fields.presentation.mimeType, size: fields.presentation.size,
      } : null,
      createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
    };
  });
  return {
    data,
    pagination: {
      page: query.page, pageSize: query.pageSize, total, filteredTotal,
      totalPages: Math.ceil(filteredTotal / query.pageSize),
      hasNextPage: query.page * query.pageSize < filteredTotal,
    },
  };
}
