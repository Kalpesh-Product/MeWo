import assert from "node:assert/strict";
import { test } from "node:test";
import { InquiryError, MAX_FILE_BYTES, MAX_REQUEST_BYTES, parseInquiry, parsePresentation, readFormData } from "../lib/server/inquiry-validation";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}
const contact = { kind: "contact", name: " Test Person ", email: " TEST@example.com ", phone: "+91 80071 26444", message: " A question " };

test("normalizes form values and strips unexpected fields", () => {
  const result = parseInquiry(form({ ...contact, admin: "true" }));
  assert.equal(result.email, "test@example.com");
  assert.equal("name" in result && result.name, "Test Person");
  assert.equal("admin" in result, false);
});
test("rejects invalid kinds, email, missing fields, phone and excessive message length", () => {
  for (const change of [{ kind: "admin" }, { email: "bad" }, { name: " " }, { phone: "123" }, { message: "x".repeat(10001) }]) {
    assert.throws(() => parseInquiry(form({ ...contact, ...change })), InquiryError);
  }
});
test("allows optional startup details and rejects non-HTTP URLs", () => {
  assert.equal(parseInquiry(form({ ...contact, kind: "startup" })).kind, "startup");
  assert.throws(() => parseInquiry(form({ ...contact, kind: "startup", website_url: "javascript:alert(1)" })), InquiryError);
});
test("accepts a newsletter email without contact-only fields", () => {
  assert.deepEqual(parseInquiry(form({ kind: "subscription", email: " Test@example.com " })), { kind: "subscription", email: "test@example.com" });
});
test("rejects duplicate fields and files masquerading as text", () => {
  const duplicate = form(contact); duplicate.append("email", "other@example.com");
  assert.throws(() => parseInquiry(duplicate), InquiryError);
  const file = form(contact); file.set("name", new File(["name"], "name.txt"));
  assert.throws(() => parseInquiry(file), InquiryError);
});
test("checks attachment extension, MIME, signature and size", async () => {
  const data = form({});
  data.set("presentation", new File(["%PDF-1.7\nverification"], "../deck.pdf", { type: "application/pdf" }));
  const result = await parsePresentation(data, "startup");
  assert.equal(result?.filename, "deck.pdf");
  assert.equal(result?.sha256.length, 64);
  await assert.rejects(() => parsePresentation(data, "contact"), InquiryError);
  for (const file of [new File(["not a pdf"], "deck.pdf"), new File(["%PDF-"], "deck.exe"), new File([Buffer.alloc(MAX_FILE_BYTES + 1)], "deck.pdf")]) {
    data.set("presentation", file);
    await assert.rejects(() => parsePresentation(data, "startup"), InquiryError);
  }
});
test("accepts PPT and PPTX signatures; rejects arbitrary ZIP files", async () => {
  const data = form({});
  data.set("presentation", new File([Buffer.from("d0cf11e0a1b11ae1", "hex")], "deck.ppt"));
  assert.equal((await parsePresentation(data, "startup"))?.mimeType, "application/vnd.ms-powerpoint");
  data.set("presentation", new File([Buffer.from("504b0304", "hex"), "[Content_Types].xml ppt/presentation.xml"], "deck.pptx"));
  assert.ok(await parsePresentation(data, "startup"));
  data.set("presentation", new File([Buffer.from("504b0304", "hex"), "random.txt"], "deck.pptx"));
  await assert.rejects(() => parsePresentation(data, "startup"), InquiryError);
});
test("bounds actual body bytes even without Content-Length", async () => {
  const request = new Request("http://localhost/api/inquiry", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: Buffer.alloc(MAX_REQUEST_BYTES + 1),
  });
  await assert.rejects(() => readFormData(request), (error: unknown) => error instanceof InquiryError && error.status === 413);
});
test("reads URL-encoded and multipart forms; rejects malformed or unsupported bodies", async () => {
  for (const body of [new URLSearchParams(contact), form(contact)]) {
    const result = await readFormData(new Request("http://localhost/api/inquiry", { method: "POST", body }));
    assert.equal(parseInquiry(result).kind, "contact");
  }
  await assert.rejects(() => readFormData(new Request("http://localhost/api/inquiry", { method: "POST", body: "{}", headers: { "content-type": "application/json" } })), InquiryError);
  await assert.rejects(() => readFormData(new Request("http://localhost/api/inquiry", { method: "POST", body: "broken", headers: { "content-type": "multipart/form-data; boundary=missing" } })), InquiryError);
});
