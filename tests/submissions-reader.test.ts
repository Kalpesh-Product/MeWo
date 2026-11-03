import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSubmissionsQuery, validReadToken } from "../lib/server/submissions-reader";

test("read API requires the exact bearer token and fails closed without a configured key", () => {
  const key = "a".repeat(64);
  assert.equal(validReadToken(`Bearer ${key}`, key), true);
  for (const header of [null, key, "Bearer wrong", `Bearer ${"a".repeat(513)}`]) assert.equal(validReadToken(header, key), false);
  assert.equal(validReadToken("Bearer anything", ""), false);
});

test("read query defaults and valid table pagination/sorting", () => {
  assert.deepEqual(parseSubmissionsQuery(new URLSearchParams()), { page: 1, pageSize: 25, search: "", sortBy: "createdAt", sortOrder: "desc" });
  const query = parseSubmissionsQuery(new URLSearchParams("source=startup&page=2&pageSize=10&sortBy=email&sortOrder=asc&search=Example"));
  assert.equal(query.source, "startup");
  assert.equal(query.page, 2);
  assert.equal(query.sortBy, "email");
});

test("read query rejects unbounded pagination and arbitrary database operators", () => {
  for (const query of ["page=0", "pageSize=101", "pageSize=-1", "page=1.5", "page=10001", "sortBy=$where", "source=unknown", "status=unknown", "$where=1", "page=1&page=2", `search=${"a".repeat(101)}`]) {
    assert.throws(() => parseSubmissionsQuery(new URLSearchParams(query)));
  }
});

test("kind filters form type while retaining the source alias", () => {
  for (const kind of ["contact", "startup", "subscription"]) {
    const query = parseSubmissionsQuery(new URLSearchParams({ kind }));
    assert.equal(query.source, kind);
    assert.deepEqual(query, parseSubmissionsQuery(new URLSearchParams({ source: kind })));
    assert.deepEqual(query, parseSubmissionsQuery(new URLSearchParams({ kind, source: kind })));
  }
  for (const query of ["kind=unknown", "kind=", "kind=contact&kind=startup", "kind=contact&source=startup"]) {
    assert.throws(() => parseSubmissionsQuery(new URLSearchParams(query)));
  }
});
