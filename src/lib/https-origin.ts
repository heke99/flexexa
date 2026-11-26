export function httpsOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      (value === url.origin || value === `${url.origin}/`) ? url.origin : null;
  } catch {
    return null;
  }
}
