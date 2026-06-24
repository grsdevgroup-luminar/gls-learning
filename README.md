# SkillStream — Course Platform Prototype

A clickable, high-fidelity prototype of a full course-selling platform: a polished
student-facing **storefront**, a complete **student learning portal**, and an advanced
**admin / management panel**. Built to demo the end-to-end product to a client.

> This is a **prototype with realistic mock data** — no real backend, payments, video
> files, or SMS. Every "backend" feature is simulated in the UI, with notes on how it
> would work in production. See the table below.

## Tech stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (Base UI primitives)
- **Recharts** for analytics, **lucide-react** icons, **next-themes** (light/dark)
- State persisted in `localStorage` (cart, auth, progress) so the demo survives reloads

## Run it locally

```bash
npm install
npm run dev      # http://localhost:3000
# or a production build:
npm run build && npm start
```

## Demo accounts & controls

- A floating **Demo controls** button (bottom-left) lets you instantly switch between
  **Visitor**, **Student**, and **Admin** views, and reset the demo data.
- Login screen: use **Log in as student** / **Log in as admin** (any email/password works).
  - `student@demo.com` · `admin@demo.com`

## 5-minute demo script

1. **Browse** the landing page → **Courses** (try search / filters / sort) → open a course → read **reviews**.
2. On the course page, **change the country** in the price box (or header) → watch prices
   localize with regional (purchasing-power) discounts. **Add to cart**.
3. In the **cart**, apply coupon `LAUNCH40` or `WELCOME10` → totals update. **Checkout**
   (Stripe/PayPal UI) → success.
4. **Log in as student** → **Dashboard** → open a course → the **protected player**
   (moving watermark, DRM badge, disabled right-click) → mark lessons complete →
   watch **progress / streak** update → check **Certificates** and **Account → reminders**.
5. **Switch to Admin** → **Overview** (charts) → **Courses → New course**: the **drag-drop
   video upload** (upload → encoding → ready) + curriculum builder → **Students** (see the
   at-risk learner + send a reminder) → **Coupons** (create one) → **Pricing** (region tiers
   - per-country overrides, live price preview) → **Automation** (reminder rules + send log).

## Prototype vs. production

| Feature             | In this prototype                                                      | Production approach                                  |
| ------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| Video protection    | Moving per-user watermark, DRM badge, disabled context menu, no source | Signed HLS + Widevine/FairPlay, domain-locked player |
| Region pricing      | Country selector, PPP tiers + per-country overrides, live preview      | Geo-IP detection, live FX, server-enforced prices    |
| Coupons             | Real client-side validation (%, fixed, free, expiry, limits, scope)    | Server-validated, fraud limits                       |
| Payments            | Stripe/PayPal UI → simulated success                                   | Stripe Checkout + PayPal, webhooks, invoices         |
| Auth                | Role-based session in `localStorage`                                   | NextAuth/Clerk, JWT/session, RBAC                    |
| Progress            | Per-lesson completion in `localStorage`, streaks, charts               | DB events, resumable playback                        |
| Email/SMS reminders | Rule builder + templates + simulated send log                          | Cron/queue + Resend/SendGrid + Twilio                |

## Deploy a shareable link (Vercel)

This is a standard Next.js app — zero config to deploy:

```bash
npm i -g vercel
vercel            # first run links/creates the project
vercel --prod     # deploys and prints your live https URL
```

Or push to GitHub and "Import Project" at vercel.com — it auto-detects Next.js.

## Project structure

```
app/(storefront)/   landing, catalog, course detail, cart, checkout, auth
app/(student)/      dashboard, progress, certificates, billing, account
app/learn/[slug]/   the protected learning player
app/admin/          overview, courses + builder, students, orders, coupons,
                    pricing, reviews, automation, settings
components/         storefront/ student/ admin/ player/ charts/ shared/ ui/
lib/mock/           seeded data (courses, students, reviews, coupons, pricing, …)
lib/context/        the client store (cart, auth, region, progress)
```
