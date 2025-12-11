# Performance Marketing Plan

## Objective
Create a unified performance marketing setup for bestpgindighi.in that aligns the public website, Google Business Profile, Google Analytics 4, Google Tag Manager, and Google Ads so we can measure funnel performance, optimize paid campaigns, and scale with confidence.

## Current Assets
- Website code: https://github.com/nishantsah08/bestpgindighi.in/tree/main/src/public_website (deployed on https://bestpgindighi.in/)
- Google Business Profile: https://maps.app.goo.gl/8UfAWvfpbe7ATxWAA
- Google Analytics 4, Google Tag Manager, Google Ads: provisioned under the shared Google account (credentials to be supplied for API access).
- Lead mix today: ~90% from Google Business Profile, remainder from property portals, referrals, and WhatsApp inquiries—treat the Business Profile as the top revenue source and confirm any edits with Nishant before execution.

## Working Principles
- Perform all website edits, tracking integrations, and automation scripts inside this repository via Codex CLI.
- Use Google APIs wherever possible; resort to the Google UIs only for one-time credential generation.
- Keep this document updated as the source of truth for scope, assumptions, and next steps.
- Treat inbound phone calls as the primary conversion; future page/design changes will prioritize call-driving UX and measurement.

## Immediate Next Steps
1. Inventory existing tracking snippets in `src/public_website` and document what is already deployed.
2. Gather/store required Google API credentials (service accounts or OAuth tokens) for Business Profile, Ads, Analytics, and Tag Manager access.
3. Define the measurement plan: key conversions, events, and data flows between the website, GA4, and Google Ads.
4. Align deployment workflow so tracking/tag updates can be shipped safely (local testing, build steps, deployment triggers).

## Tracking Inventory (2025-11-12)
- Each public page in `src/public_website/*.html` embeds the same Google Tag Manager container (ID kept privately in `config/secrets/performance-marketing-plan-private.txt`) in the `<head>` plus the corresponding `<noscript>` iframe immediately after the `<body>` tag.
- No standalone GA4, Google Ads, or other third-party tracking snippets appear in the codebase; all analytics is expected to flow through GTM.
- No custom `dataLayer.push` calls or inline event-tracking scripts are present—forms/CTAs will need tagging if we want to capture conversions reliably.
- There are no native web forms; the site relies on visible phone numbers, WhatsApp deep links, and email links for lead capture, so we will need alternative conversion definitions (click tracking, call tracking, or off-site form integrations).

## Credential Requirements (draft)
- **Google Tag Manager API**: OAuth client (web/desktop) with `https://www.googleapis.com/auth/tagmanager.edit.containers` scope; store client ID/secret and refresh token in `config/secrets/tagmanager.env`.
- **Google Analytics 4 (Data API & Admin API)**: Service account JSON (preferred) with property access, stored at `config/secrets/ga4-service-account.json`; alternatively reuse the OAuth client above with scopes `analytics.edit`, `analytics.readonly`.
- **Google Ads API**: Developer token, OAuth client ID/secret, refresh token for the manager account, and `login_customer_id`; keep them in `config/secrets/google-ads.env`.
- **Google Business Profile API**: OAuth client with `https://www.googleapis.com/auth/business.manage` scope; store client credentials and refresh token alongside the others (`config/secrets/business-profile.env`).
- **Secret management**: Commit the directory structure and `.env.example` templates, but never the actual secret files. Add entries to `.gitignore` to prevent accidental commits. Eventually automate loading via tooling scripts.
- **Access principle**: You (nishant) generate the initial credentials via Google Cloud Console. Once supplied, we automate API calls here without needing to reopen the GUI.

## Credential Onboarding Checklist
1. **Google Cloud project**  
   - Create or reuse the project that already hosts GA4/GTM if possible.  
   - Enable the following APIs: Tag Manager API, Analytics Data API, Analytics Admin API, Google Ads API, Business Profile API.  
   - Create an OAuth consent screen (internal) with scopes: `tagmanager.edit.containers`, `analytics.edit`, `analytics.readonly`, `https://www.googleapis.com/auth/business.manage`, and the Google Ads scope (`https://www.googleapis.com/auth/adwords`).
2. **OAuth client + refresh token workflow**  
   - Create an OAuth client (Desktop App recommended) and download the client ID/secret.  
   - Use `gcloud auth application-default login` or a lightweight script to generate refresh tokens for: Tag Manager, Google Ads, and Business Profile.  
   - Copy the resulting values into `config/secrets/tagmanager.env`, `config/secrets/google-ads.env`, and `config/secrets/business-profile.env` (use the `.example` files as templates by running `cp file.example file`).
3. **Google Ads developer token**  
   - In Google Ads UI, request/approve a basic developer token and note the manager account ID.  
   - Populate `GOOGLE_ADS_DEVELOPER_TOKEN` and `GOOGLE_ADS_LOGIN_CUSTOMER_ID` in `config/secrets/google-ads.env`.
4. **GA4 service account**  
   - Create a dedicated service account, grant it the GA4 property role `Editor`, and download the JSON key.  
   - Save the JSON as `config/secrets/ga4-service-account.json` (keep the `.json.example` as a reference only).  
   - Optionally add the service account email as a read-only user in Google Ads if we later automate offline conversions.
5. **Hardening & sharing**  
   - Keep real credential files local; never commit them.  
   - When we need to automate commands, paste credentials directly into the correct files or share securely (1Password, GDrive restricted).  
   - Update this checklist whenever a new integration is added.

## Measurement Plan (draft)
- **Primary conversion (phone calls)**  
  - Track all `tel:` link clicks and call-to-action buttons via GTM using a `call_click` event; push to GA4 as a conversion and mirror into Google Ads.  
  - For onsite call tracking, explore dynamic number insertion or CallRail integration; if implemented, feed call outcomes back to GA4/Ads via Measurement Protocol.  
  - For Google Business Profile, pull call interaction metrics via Business Profile API for reporting only—no edits without explicit approval.
- **Secondary interactions**  
  - Track WhatsApp deep-link clicks (`wa.me`) as `whatsapp_click` events.  
  - Capture email link clicks or brochure downloads if present (`email_click`, `download_brochure`).  
  - Any future web forms should emit a `lead_submit` event with form metadata.
- **Data flow**  
  - GTM container manages client-side event dispatch to GA4 using recommended events and parameters (`event_category`, `event_label`, phone number).  
  - GA4 conversions synced to Google Ads for bidding; enhanced conversions possible if we capture hashed phone/email post-call follow-up.  
  - Offline and partner leads (property portals, referrals) appended via GA4 Measurement Protocol and Google Ads offline conversion uploads when data is available.
- **Reporting**  
  - Build Looker Studio or Sheets dashboards using GA4 + Business Profile API data.  
  - Maintain attribution notes in this repo so campaign experiments remain traceable.

## GTM Container Snapshot
- The current container/account identifiers are documented privately in `config/secrets/performance-marketing-plan-private.txt`; do not publish those values.
- Action required: obtain a container export (`.json`) so we can audit existing tags, triggers, variables. Two options:
  1. Manual export from the GTM UI (Workspace → Admin → Export Container). Upload the JSON to `config/gtm/exports/YYYY-MM-DD_gtm-container.json` (we’ll add `.gitignore` entries before committing).  
  2. Once OAuth credentials are dropped into `config/secrets/tagmanager.env`, run `python scripts/gtm_pull.py` (to be built) that calls the Tag Manager API to fetch the latest workspace and save it locally.
- Until we have the export, assume no GA4/Ads tags are configured and plan to add them during implementation.

## Upcoming Tasks (to be refined as we progress)
- Implement or update GTM/GA4/Ads tags in the website codebase.
- Configure conversion tracking in Google Ads and import from GA4.
- Set up server-side or enhanced conversions if needed for lead capture accuracy.
- Optimize landing pages/copy based on campaign requirements.
- Automate recurring performance reports once data connections are verified.

## SEO/Landing Page Expansion (men-only, ≤10km focus)
- Target higher-income male tenants (no women’s accommodations; no in-house food—vendors/market nearby; temp/short-term friendly).
- Prioritized employers/areas within ~10km: Tata Communications Dighi + tenants (Singtel STT GDC, NV5, other data/NOC/ops/security vendors), AIT, Vishrantwadi/Tingre Nagar/Lohegaon (airport), Yerwada/Commerzone, Viman Nagar retail/IT, Bhosari MIDC, Moshi industrial, Alandi (short ride), Kalas/Kalwad Rd.
- Additional focus: Dynamic Logistics Trade Park (Dighi) and onsite companies (logistics/warehouse staff within 10km).
- Add Robu.in (Dighi-area e-commerce/warehousing/tech staff) as a dedicated target.
- Proposed ~50-page set:
  - Tata Comm compound (10): Tata Comm Dighi; Singtel STT GDC; NV5; data center engineers; NOC/ops; network engineers; managed services; project/consulting staff; security/tech vendors; night-shift/short-term stays.
  - AIT/Institutions (4): AIT main; AIT interns/visitors; Alandi colleges; Vishrantwadi/Tingre Nagar hubs.
  - Airport/Yerwada/Viman Nagar (7): Airport staff; Viman Nagar retail/IT; Commerzone Yerwada staff; BPO/night-shift; airline/ground staff; sales/retail staff; short-stay consultants.
  - Industrial/Logistics (6): Bhosari MIDC supervisors/engineers; Moshi industrial supervisors/engineers; QA/inspection teams; maintenance/technician leads; turnaround/shutdown engineers; ops managers.
  - Locality/Commute (10): Dighi; Vishrantwadi; Tingre Nagar; Lohegaon; Yerwada; Viman Nagar; Moshi; Bhosari; Alandi; Kalas/Kalwad Rd.
  - Intent/Benefit/Shift (10): Night-shift pros; short-term/weekly stays; WFH/Wi-Fi; budget under ₹5k; balcony rooms; upper-bunk budget; double-sharing standard; quick move-in; parking; near market/food vendors.
- Content notes: men-only, temp-friendly; prices ₹4.5k/5k/5.5k, deposit ₹2,500; amenities (Wi‑Fi, RO, CCTV, geyser, parking); no in-house food (vendor/market options).

## Deployment Checklist
- Verify metadata integrity: page titles, meta descriptions, canonical tags, structured data (Rich Results test) stay intact.
- Confirm robots controls: production `robots.txt`, meta robots, and X-Robots-Tag headers match intended crawl strategy; no unintended `noindex`.
- Audit internal links: run link linting/crawl to catch broken links, orphan updates, and ensure sitemap entries reflect current navigation.
- Preserve URL/redirects: review any slug changes, enforce 301s for removed pages, and double-check canonical chains are clean.
- Check performance budgets: run Lighthouse (mobile/desktop) watching LCP, CLS, INP; ensure asset optimization and caching rules hold.
- Validate analytics firing: GTM preview/Tag Assistant confirms GA4 events, conversions, and pixels trigger as expected.
- Refresh sitemaps if structure/content changed; resubmit in Search Console only when necessary.
- Monitor post-release signals: track Search Console coverage, crawl stats, and server logs for 24–48 hours to spot 4xx/5xx spikes.
- Confirm accessibility/schema: headings, alt text, ARIA, and schema markup still pass automated checks.
- Document release notes: record changes, affected URLs, tests executed, and rollback plan for quick action if rankings drop.

## Key Identifiers
- Exact container/property/project/customer identifiers are stored privately in `config/secrets/performance-marketing-plan-private.txt`; update that file whenever IDs change so the public plan can remain sanitized.

## Progress Log
- **2025-11-12**: Enabled Tag Manager, GA4 (Data/Admin), Google Ads, and Business Profile APIs inside the performance marketing Cloud project. Created a web OAuth client and generated a multi-scope refresh token; credentials now live in the private file. Next action: drop the GA4 service-account JSON and export the live GTM container for auditing.
- **2025-11-12 (later)**: Created the GA4 property and web data stream, provisioned the service account, downloaded the JSON key (stored privately), and granted GA4 Editor access to unblock Admin/Data API automation. Next action: pull/export the live GTM container before scripting tag updates.
- **2025-11-12 (status)**: Submitted the Google Ads API Basic access application; developer tokens and customer IDs will be finalized once Google's approval arrives and remain documented privately.
- **2025-11-25**: Google Ads developer token approved. Tokens, OAuth credentials, and customer IDs remain in the private file; Ads API sanity checks and offline conversion uploads are ready once tagging is live.
- **2025-11-25 (later)**: Regenerated the Ads refresh token (scope `adwords`) and validated Ads API connectivity via the client library; the accessible customer IDs are recorded privately.
- **2025-11-25 (later)**: Redesigned public website for call/WhatsApp conversions (sticky CTA, updated CTAs, deposit ₹2,500, geyser + parking), mobile hamburger nav, and proportionate imagery. Dev deployed to `https://fir-bestpg-development-public.web.app`. Audience landing links added inline (AIT/TCL/Boys/Students) for SEO without cluttering the header.
- **2025-11-25 (latest)**: Added on-page click tracker (`src/public_website/track.js`) that pushes call/WhatsApp/email clicks with label/target/page into `dataLayer`. All pages include it. Next: configure Tag Manager to listen to `data-cta="call"/"whatsapp"/"email"` clicks, send GA4 events (`call_click`, `whatsapp_click`, `email_click`), mark them as conversions in GA4, and import into Google Ads.
- **2025-11-25 (GTM/GA4)**: Tag Manager container now has `DLV - cta_label/cta_target/page_location`, triggers `CTA - Call` (`[data-cta="call"]`) and `CTA - WhatsApp` (`[data-cta="whatsapp"]`), and GA4 event tags `call_click`/`whatsapp_click` (measurement ID referenced privately). Built-in click variables were initially disabled, causing “unknown variable Click Element” validation errors; enabling all click built-ins fixed it. Workspace “web-prod” published manually.
- **2025-11-26**: Generated ~50 men-only, temp-friendly landing pages (Tata Comm Dighi tenants incl. STT GDC/NV5, Dynamic Logistics Trade Park, Robu.in, airport/Yerwada/Viman Nagar, Bhosari/Moshi, intent pages) with GTM + `track.js`. Added a light internal-link hub (`nearby-workplaces.html`) and a small “Nearby workplaces & areas” section on Home. Regenerated sitemap.xml covering all URLs. Deployed to dev (`fir-bestpg-development-public.web.app`) and prod (`fir-bestpg-production-public.web.app`). Next: submit sitemap in Search Console, verify Tag Assistant/GA4 events on prod, and confirm Ads import shows `call_click`/`whatsapp_click` as Primary conversions.
- **2025-11-26 (later)**: Added a clean WhatsApp tracking link (`https://bestpgindighi.in/en`) redirecting to the UTM’d site URL for chat shares. Documented GBP website UTM link and WhatsApp link in the plan. Provided GBP category guidance (primary: Hostel; avoid hotel/guest house), men-only description, and amenity/crowd/parking recommendations for manual GBP edits.

### Link tracking shortcuts (live)
- GBP Website URL (for the “Website” field): `https://www.bestpgindighi.in/?utm_source=google&utm_medium=gbp&utm_campaign=profile`
- WhatsApp share link for chats you initiate: `https://bestpgindighi.in/en` (301 redirects to the UTM’d site URL for tracking without showing a long string)

_Last updated: 2025-11-25 20:35 IST_
