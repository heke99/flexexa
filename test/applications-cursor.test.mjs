import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeApplicationCursor, encodeApplicationCursor } from "../src/domains/applications/cursor.ts";

const createdAt = "2026-11-26T08:30:01.123456Z";
const id = "29736c21-b8e1-450f-a202-36012e0379e2";

test("admin cursors preserve the complete timestamp and UUID", () => {
  const cursor = encodeApplicationCursor([createdAt, id]);
  assert.match(cursor, /^[\w-]+$/);
  assert.deepEqual(decodeApplicationCursor(cursor), {created_at: createdAt, id});
});

test("admin cursors reject tampered encoding, dates, and sort keys", () => {
  const wrap = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const valid = wrap([createdAt, id]);
  for (const invalid of [
    "", valid + "=", "a".repeat(129),
    wrap(["2026-02-30T08:30:01.123456Z", id]),
    wrap(["2026-11-26T08:30:01.123Z", id]),
    wrap([createdAt, "bad-id"]),
    wrap([createdAt, id, "extra"]),
    wrap({created_at: createdAt, id}),
  ]) assert.equal(decodeApplicationCursor(invalid), null);
});
