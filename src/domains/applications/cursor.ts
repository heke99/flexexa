const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

function isApplicationSortKey(value: unknown): value is [string, string] {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const [timestamp, id] = value;
  if (typeof timestamp !== "string" || typeof id !== "string" ||
    !timestampPattern.test(timestamp) || !uuidPattern.test(id)) return false;
  const seconds = timestamp.slice(0, 19);
  const date = new Date(`${seconds}Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === seconds;
}

export function encodeApplicationCursor(value: unknown): string | null {
  return isApplicationSortKey(value)
    ? Buffer.from(JSON.stringify(value)).toString("base64url")
    : null;
}

export function decodeApplicationCursor(value: string): {created_at: string; id: string} | null {
  if (!/^[\w-]{1,128}$/.test(value)) return null;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString());
    if (!isApplicationSortKey(decoded) || encodeApplicationCursor(decoded) !== value) return null;
    return {created_at: decoded[0], id: decoded[1]};
  } catch {
    return null;
  }
}
