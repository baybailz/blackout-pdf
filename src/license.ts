import { LICENSE_VALIDATE_URL } from "./config.ts";

const STORAGE_KEY = "blackout-pdf-license";

export function getStoredLicense(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function isPro(): boolean {
  return getStoredLicense() !== null;
}

// Validates against the Lemon Squeezy public license endpoint. Once a Pro
// product exists (docs/MONETIZATION.md), keys sold there validate here with no
// backend of our own.
export async function activateLicense(
  key: string,
): Promise<{ ok: boolean; message: string }> {
  const trimmed = key.trim();
  if (!trimmed) return { ok: false, message: "Enter a license key." };
  try {
    const res = await fetch(LICENSE_VALIDATE_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ license_key: trimmed }),
    });
    const data = await res.json();
    if (data?.valid) {
      localStorage.setItem(STORAGE_KEY, trimmed);
      return { ok: true, message: "Pro activated. Thank you!" };
    }
    return {
      ok: false,
      message: data?.error ?? "That key doesn't look valid.",
    };
  } catch {
    return {
      ok: false,
      message: "Couldn't reach the license server. Try again in a minute.",
    };
  }
}
