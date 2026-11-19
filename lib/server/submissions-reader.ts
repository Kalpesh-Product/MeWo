import { createHash, timingSafeEqual } from "node:crypto";
import type { Db, Document, WithId } from "mongodb";
import { z } from "zod";
import { collections } from "./mongo-schema";

const names = [collections.contact, collections.startup, collections.subscription];
const sortFields = {
  createdAt: "createdAt", updatedAt: "updatedAt", source: "source", status: "status",
  name: "name", email: "email", phone: "phone", subject: "subject", startupName: "startupName",
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

export function validSubmissionsToken(header: string | null, expected: string) {
  if (!expected || !header?.startsWith("Bearer ")) return false;
  const token = header.slice(7);
  if (!token || token.length > 512) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(token), digest(expected));
}

export const submissionProjection = {
  _id: 1, source: 1, sourceCompany: 1, status: 1, createdAt: 1, updatedAt: 1,
  name: 1, email: 1, phone: 1, subject: 1, message: 1, startupName: 1, websiteUrl: 1,
  linkedinProfileUrl: 1, "presentation.fileId": 1, "presentation.filename": 1,
  "presentation.mimeType": 1, "presentation.size": 1, "presentation.presentationLink": 1,
};

export function submissionRow(record: WithId<Document>) {
  return {
    id: record._id.toHexString(), source: record.source, status: record.status,
    sourceCompany: record.sourceCompany,
    name: record.name ?? null, email: record.email, phone: record.phone ?? null,
    subject: record.subject ?? null, message: record.message ?? null,
    startupName: record.startupName ?? null, websiteUrl: record.websiteUrl ?? null,
    linkedinProfileUrl: record.linkedinProfileUrl ?? null,
    presentation: record.presentation ? {
      id: record.presentation.fileId.toHexString(), filename: record.presentation.filename,
      mimeType: record.presentation.mimeType, size: record.presentation.size,
      presentationLink: record.presentation.presentationLink ?? null,
    } : null,
    createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
  };
}

export async function readSubmissions(db: Db, query: ReturnType<typeof parseSubmissionsQuery>) {
  const selected = query.source ? [collections[query.source]] : names;
  const filter: Document = {};
  if (query.status) filter.status = query.status;
  if (query.search) {
    const literal = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = ["name", "email", "phone", "subject", "message", "startupName", "websiteUrl", "linkedinProfileUrl"]
      .map(field => ({ [field]: { $regex: literal, $options: "i" } }));
  }
  const [totals, filtered, pages] = await Promise.all([
    Promise.all(names.map(name => db.collection(name).countDocuments({}, { maxTimeMS: 5000 }))),
    Promise.all(selected.map(name => db.collection(name).countDocuments(filter, { maxTimeMS: 5000 }))),
    Promise.all(selected.map(name => db.collection(name).find(filter, { projection: submissionProjection, maxTimeMS: 5000 })
      .sort({ [sortFields[query.sortBy]]: query.sortOrder === "asc" ? 1 : -1, _id: 1 })
      .limit(query.page * query.pageSize).toArray())),
  ]);
  const total = totals.reduce((sum, count) => sum + count, 0);
  const filteredTotal = filtered.reduce((sum, count) => sum + count, 0);
  const direction = query.sortOrder === "asc" ? 1 : -1;
  const field = sortFields[query.sortBy];
  const documents = pages.flat().sort((a, b) => {
    const left = a[field], right = b[field];
    if (left !== right) return (left == null ? -1 : right == null ? 1 : left > right ? 1 : -1) * direction;
    return a._id.toHexString().localeCompare(b._id.toHexString()) * direction;
  }).slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
  const data = documents.map(submissionRow);
  return { data, pagination: {
    page: query.page, pageSize: query.pageSize, total, filteredTotal,
    totalPages: Math.ceil(filteredTotal / query.pageSize),
    hasNextPage: query.page * query.pageSize < filteredTotal,
  } };
}
