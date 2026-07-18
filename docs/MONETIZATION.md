# Monetization playbook

Goal set at kickoff (2026-07-18): **first $100 revenue within 30 days.**
Running cost: **$0/month** (GitHub Pages). Everything below is a one-time
setup step or a marketing action.

## 1. Turn on payments (~20 minutes, the only blocking step)

The app is already wired for [Lemon Squeezy](https://lemonsqueezy.com)
(merchant of record — they handle VAT/sales tax, good for a solo operator):

1. Create a Lemon Squeezy account + store.
2. Add a product: **Blackout PDF Pro**, $29, one-time. Enable **license keys**
   (Product → Confirmation → generate license keys, activation limit 3).
3. Copy the product's checkout link.
4. In `src/config.ts`, set `CHECKOUT_URL = "<that link>"`.
5. Push to `main` — Pages redeploys automatically.

That's it: checkout is Lemon Squeezy-hosted, and the app validates keys
against their public `licenses/validate` endpoint (`src/license.ts`) — no
backend needed. Stripe Payment Links work too, but then license keys need
manual emailing; Lemon Squeezy automates it.

## 2. Point a domain at it (~10 minutes)

Pick whichever owned domain fits (something privacy/office-tools flavored).

1. Repo → Settings → Pages → Custom domain → enter it (this commits a `CNAME`
   file).
2. At the DNS provider: `CNAME` record, host `@` (or `www`), value
   `baybailz.github.io`. Apex domains: 4 `A` records to GitHub Pages IPs
   (185.199.108–111.153).
3. Wait for the cert, enable "Enforce HTTPS".

A real domain matters for this product: trust is the whole pitch.

## 3. Launch channels (free, do over week 1–2)

- **Product Hunt** — privacy tools do well; lead with the "black rectangle is
  not a redaction" story and the offline demo.
- **Hacker News (Show HN)** — same angle; the client-side/verifiable-privacy
  crowd is exactly HN.
- **Reddit**: r/privacy, r/selfhosted, r/paralegal, r/humanresources — answer
  real "how do I redact a PDF safely" posts, don't spam.
- **SEO**: the FAQ already targets "redact pdf without uploading", "is pdf
  redaction safe", "redact pdf free no watermark". Add a blog page per
  audience later (lawyers, HR, landlords) if traffic shows up.

## 4. Measure without breaking the privacy pitch

No analytics scripts are included (it's a selling point). Options that keep
the promise:
- Cloudflare in front of the custom domain → server-side request counts, zero
  client JS.
- GitHub traffic tab (Insights → Traffic) for a rough weekly view.
- Lemon Squeezy dashboard is the revenue source of truth.

## 5. Later levers (only if v1 gets traction)

- OCR for scanned PDFs (tesseract.js, still client-side) — big Pro feature.
- Batch mode (redact N files with saved pattern sets) — the "paralegal
  Tuesday afternoon" use case, justifies a $79 tier.
- Team licenses / invoicing for firms.
- A `/api` version (server-side, metered) only if businesses ask.
