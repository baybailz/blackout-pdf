// ---------------------------------------------------------------------------
// Monetization switchboard. Everything commercial is configured here so
// flipping revenue on is a one-line change per field. See docs/MONETIZATION.md.
// ---------------------------------------------------------------------------

export const PRODUCT_NAME = "Blackout PDF";

// Pages allowed per export on the free tier.
export const FREE_PAGE_LIMIT = 10;

export const PRO_PRICE_LABEL = "$29";

// Checkout link for the Pro lifetime license. Create a product on
// Lemon Squeezy (or Stripe payment link) and paste its URL here.
// While null, the Pro buttons show a "coming soon" waitlist mailto instead.
export const CHECKOUT_URL: string | null = null;

// Lemon Squeezy license validation (their /v1/licenses/validate endpoint is
// public + CORS-enabled; no API key needed). Leave as-is.
export const LICENSE_VALIDATE_URL =
  "https://api.lemonsqueezy.com/v1/licenses/validate";

// Fallback contact while checkout is not yet live.
export const CONTACT_EMAIL = "baileyrthomp@gmail.com";
