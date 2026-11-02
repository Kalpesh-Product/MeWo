import assert from "node:assert/strict";
import { test } from "node:test";
import { serverEnv } from "../lib/server/env";

const base = { MONGODB_URI: "mongodb://127.0.0.1:27017", MONGODB_DB: "mewo_test" };

test("reads server settings with safe defaults and deployment overrides", () => {
  const defaults = serverEnv(base);
  assert.equal(defaults.MONGODB_MAX_POOL_SIZE, 10);
  assert.deepEqual(defaults.MEWO_ALLOWED_ORIGINS, []);
  const override = serverEnv({ ...base, MONGODB_MAX_POOL_SIZE: "25", MONGODB_CONNECT_TIMEOUT_MS: "8000", MEWO_ALLOWED_ORIGINS: "https://example.com, http://localhost:3012" });
  assert.equal(override.MONGODB_MAX_POOL_SIZE, 25);
  assert.equal(override.MONGODB_CONNECT_TIMEOUT_MS, 8000);
  assert.deepEqual(override.MEWO_ALLOWED_ORIGINS, ["https://example.com", "http://localhost:3012"]);
});

test("requires database settings and rejects invalid limits and browser origins", () => {
  for (const input of [{}, { ...base, MONGODB_DB: "invalid/name" }, { ...base, MONGODB_MAX_POOL_SIZE: "0" }, { ...base, MONGODB_SOCKET_TIMEOUT_MS: "oops" }, { ...base, MEWO_ALLOWED_ORIGINS: "https://example.com/path" }]) {
    assert.throws(() => serverEnv(input), /Missing or invalid server environment variables/);
  }
});

test("configuration errors name the setting without exposing connection credentials", () => {
  assert.throws(() => serverEnv({ ...base, MONGODB_URI: "invalid://username:private-password@host" }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /MONGODB_URI/);
    assert.doesNotMatch(error.message, /username|private-password|@host/);
    return true;
  });
});
