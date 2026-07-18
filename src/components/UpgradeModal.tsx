import { useState } from "react";
import {
  CHECKOUT_URL,
  CONTACT_EMAIL,
  FREE_PAGE_LIMIT,
  PRO_PRICE_LABEL,
} from "../config.ts";
import { activateLicense } from "../license.ts";

interface Props {
  pageCount: number;
  onClose: () => void;
  onActivated: () => void;
}

// Stripe payment links redirect back with ?checkout=success to unlock Pro, so
// there is no license key to type. The key input only renders for key-based
// checkout providers (e.g. Lemon Squeezy).
const KEYLESS_CHECKOUT = CHECKOUT_URL?.includes("stripe.com") ?? false;

export default function UpgradeModal({ pageCount, onClose, onActivated }: Props) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const activate = async () => {
    setBusy(true);
    setMsg(null);
    const res = await activateLicense(key);
    setBusy(false);
    setMsg(res.message);
    if (res.ok) setTimeout(onActivated, 800);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>This document has {pageCount} pages</h2>
        <p>
          The free version exports up to {FREE_PAGE_LIMIT} pages. Pro removes
          the limit forever — {PRO_PRICE_LABEL}, one-time, still 100% in your
          browser.
        </p>
        {CHECKOUT_URL ? (
          <>
            <a className="btn" href={CHECKOUT_URL}>
              Get Pro — {PRO_PRICE_LABEL} one-time
            </a>
            {KEYLESS_CHECKOUT && (
              <p className="meta">
                You'll be sent back here after payment and Pro unlocks
                automatically. Bought it on another device? Email{" "}
                <a href={`mailto:${CONTACT_EMAIL}?subject=Blackout%20PDF%20Pro%20activation`}>
                  {CONTACT_EMAIL}
                </a>{" "}
                with your receipt and we'll sort it fast.
              </p>
            )}
          </>
        ) : (
          <a
            className="btn"
            href={`mailto:${CONTACT_EMAIL}?subject=Blackout%20PDF%20Pro%20waitlist`}
          >
            Pro launches soon — join the waitlist
          </a>
        )}
        {!KEYLESS_CHECKOUT && (
          <>
            <div className="license-row">
              <input
                placeholder="Already have a license key?"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && activate()}
              />
              <button className="mini-btn" disabled={busy} onClick={activate}>
                {busy ? "…" : "Activate"}
              </button>
            </div>
            {msg && <p className="meta">{msg}</p>}
          </>
        )}
        <button className="link-btn close" onClick={onClose}>
          Not now
        </button>
      </div>
    </div>
  );
}
