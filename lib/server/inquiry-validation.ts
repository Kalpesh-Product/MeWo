import { createHash } from "node:crypto";
import { z } from "zod";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 128 * 1024;
export class InquiryError extends Error {
  constructor(message: string, public status = 400, public retryAfter?: number) {
    super(message);
    this.name = "InquiryError";
  }
}
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const optionalUrl = optionalText(2048).refine((value) => {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}, "Please enter a complete HTTP or HTTPS website/profile URL.");
const common = {
  name: z.string().trim().min(1, "Please enter your name.").max(200),
  email: z.string().trim().toLowerCase().max(200).pipe(z.email({ error: "Please enter a valid email address." })),
  phone: z.string().trim().max(30).regex(/^[+()\d .-]+$/, "Please enter a valid phone number.")
    .refine((value) => { const n = value.replace(/\D/g, "").length; return n >= 7 && n <= 15; }, "Please enter a valid phone number."),
  message: z.string().trim().min(1, "Please enter your message.").max(10000),
};
export const inquirySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("contact"), ...common, subject: optionalText(200) }),
  z.object({ kind: z.literal("startup"), ...common, startup_name: optionalText(200), website_url: optionalUrl, linkedin_profile_url: optionalUrl }),
  z.object({ kind: z.literal("subscription"), email: common.email }),
]);
export type Inquiry = z.infer<typeof inquirySchema>;
export type Presentation = { filename: string; mimeType: string; size: number; sha256: string; bytes: Buffer };

export async function readFormData(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type") || "";
  if (!/^(multipart\/form-data\s*;|application\/x-www-form-urlencoded(?:\s*;|$))/i.test(contentType)) {
    throw new InquiryError("Please submit the form as multipart or URL-encoded data.", 415);
  }
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) throw new InquiryError("Please keep attachments below 10 MB.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InquiryError("The form is empty.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new InquiryError("Please keep attachments below 10 MB.", 413);
      }
      chunks.push(value);
    }
    return await new Response(Buffer.concat(chunks), { headers: { "content-type": contentType } }).formData();
  } catch (error) {
    if (error instanceof InquiryError) throw error;
    throw new InquiryError("Unable to read the form. Please try again.");
  } finally { reader.releaseLock(); }
}

export function parseInquiry(form: FormData): Inquiry {
  const values: Record<string, string> = {};
  for (const [name, value] of form) {
    if (form.getAll(name).length !== 1) throw new InquiryError("Duplicate form fields are not allowed.");
    if (name === "presentation") continue;
    if (typeof value !== "string") throw new InquiryError("Invalid form field.");
    values[name] = value;
  }
  const parsed = inquirySchema.safeParse(values);
  if (!parsed.success) throw new InquiryError(parsed.error.issues[0]?.message || "Please check your form details.", 422);
  return parsed.data;
}

export async function parsePresentation(form: FormData, kind: Inquiry["kind"]): Promise<Presentation | undefined> {
  const file = form.get("presentation");
  if (file === null || (file instanceof File && !file.size && !file.name)) return;
  if (kind !== "startup" || !(file instanceof File)) throw new InquiryError("Invalid presentation attachment.");
  if (!file.size || file.size > MAX_FILE_BYTES) throw new InquiryError("Please choose a non-empty presentation below 10 MB.", 413);
  const filename = (file.name.replace(/\\/g, "/").split("/").at(-1) || "presentation").replace(/[\u0000-\u001f\u007f]/g, "").slice(-180);
  const extension = filename.split(".").at(-1)?.toLowerCase();
  const bytes = Buffer.from(await file.arrayBuffer());
  let mimeType: string | undefined;
  if (extension === "pdf" && bytes.subarray(0, 5).toString() === "%PDF-") mimeType = "application/pdf";
  if (extension === "ppt" && bytes.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex"))) mimeType = "application/vnd.ms-powerpoint";
  if (extension === "pptx" && bytes.subarray(0, 4).equals(Buffer.from("504b0304", "hex")) && bytes.includes(Buffer.from("[Content_Types].xml")) && bytes.includes(Buffer.from("ppt/presentation.xml"))) {
    mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (!mimeType || (file.type && ![mimeType, "application/octet-stream", ...(extension === "pptx" ? ["application/zip"] : [])].includes(file.type))) {
    throw new InquiryError("Please attach a PDF, PPT or PPTX file with matching file contents.", 415);
  }
  return { filename, mimeType, size: bytes.length, bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}
