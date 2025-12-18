# PG Wi‑Fi Authentication & Compliance System – v1.3 (Final, Locked)

---

## 1. Objective

Design and operate a **low‑cost, compliant, OTP‑based Wi‑Fi access system** for a Paying Guest (PG) business using:

* **MikroTik RB750Gr3** as the core router
* **3 wired Access Points (one per floor)**
* **WhatsApp Cloud API** for OTP delivery

The system must:

* Support **36 users**
* Allow **max 2 devices per user**
* Enforce **72 max concurrent devices**
* Limit bandwidth to **3 Mbps per user (not per device) with elastic redistribution when spare capacity exists**
* Maintain **identity‑centric, legally defensible logs**
* Provide **secure CCTV access inside /admin**
* Prevent **any deletion or tampering of logs or CCTV footage**

---

## 2. Core Design Principles (Non‑Negotiable)

* **Timezone**: IST only
* **Clock**: NTP‑synced (mandatory)
* **Compliance model**: Identity + time mapping (not content logging)
* **Privacy**: No browsing history, URLs, DNS, or payload logging
* **Immutability**: Logs and CCTV footage cannot be deleted by humans

---

## 3. High‑Level Architecture

**Internet (ISP)**
→ **MikroTik RB750Gr3 (Brain)**
→ **LAN Ports / Switch**
→ **Access Points (1 per floor)**
→ **Users (Wi‑Fi)**

Parallel systems:

* **Auth & Admin APIs** → Google Cloud Functions
* **OTP Delivery** → WhatsApp Cloud API
* **User Database** → Firestore
* **Compliance Logs** → Google Cloud Storage (GCS)
* **CCTV Network** → Isolated VLAN, surfaced inside /admin

---

## 4. Network & IP Addressing

### Subnet

* `192.168.1.0/24`

### Static IPs (Infrastructure)

| Device           | IP            |
| ---------------- | ------------- |
| Router (Gateway) | 192.168.1.1   |
| AP – Floor 1     | 192.168.1.11  |
| AP – Floor 2     | 192.168.1.22  |
| AP – Floor 3     | 192.168.1.33  |
| Local Admin PC   | 192.168.1.2   |
| CCTV / NVR       | Existing NVR LAN (MikroTik ether2 runs as DHCP client). Default NVR IP 192.168.1.64—update in /admin once installer confirms. |

### DHCP Pool (Users)

* `192.168.1.34 – 192.168.1.254`

### Mandatory Router Best Practices

1. **DHCP Reservations** for router, APs, CCTV, admin PC 
2. **DHCP Lease Time**: 8–12 hours
3. **Firewall Protection**:

   * Users blocked from `192.168.1.1 – 192.168.1.10`
   * Only admin network can reach infrastructure

---

## 5. Wi‑Fi & RF Design

### Access Points

* Quantity: 3 (one per floor)
* Mode: AP / Bridge
* Backhaul: Wired Ethernet

### SSID Strategy (Per AP)

Each AP broadcasts **two SSIDs**:

1. **Short‑Range SSID** – low TX power, same‑floor rooms
2. **Long‑Range SSID** – higher TX power, corridors & overlap

Same SSID names reused across floors for roaming; RF profiles differ.

---

## 6. User & Device Policy

### Capacity Rules

* Max users: 36
* Devices per user: 2
* **Max concurrent devices: 72 (hard enforced)**

### Bandwidth Policy

* **Elastic PCQ shaping**:
  * Parent queue on WAN = ISP link rate (e.g., 200 Mbps).  
  * Child PCQ per IP (queues tree) with `pcq-rate=3M`, `limit-at=3M`, `max-limit` left high (20M) and optional short burst.
  * When only a few tenants are active they can burst above 3 Mbps until the parent saturates; once many users demand bandwidth, each is clamped to ~3 Mbps for fairness.
  * Queue tree enforced on both directions (LAN→WAN and WAN→LAN) so uplink/downlink stay symmetrical.

---

## 7. Authentication Model (OTP‑Based)

### Key Concept

* **OTP establishes user identity & validity**
* **Network sessions are automatic within validity**

### First Login / Post‑Expiry Flow

1. Connect to Wi‑Fi
2. Captive portal redirect
3. Enter WhatsApp mobile number (format: `91XXXXXXXXXX`)
4. Whitelist + expiry validation
5. OTP generated
6. OTP sent via WhatsApp Cloud API
7. OTP verified
8. User authorized until expiry

### Subsequent Sessions

* No OTP required
* Sessions auto‑created on reconnect

### Captive Portal Deployment

* The MikroTik hEX hosts the captive portal bundle locally: `flash/login.html`, `flash/style.css`, and `flash/script.js`. RouterOS hotspot automatically serves these files to unauthenticated users.
* Use `sync-hotspot.sh` from `/home/nishant/wifi` whenever you change the portal. It copies the latest files into `flash/` via SCP; override `ROUTER_PATH` if you later keep them under `flash/hotspot/`.

### Validity Rules

* All OTPs are six-digit numeric codes, regardless of delivery method.
* Optional expiry per user; default validity window remains **30 days** once a user is approved.
* When WhatsApp delivery is online, OTPs expire in 5 minutes (configurable via `OTP_TTL_SECONDS`).
* When WhatsApp delivery is offline, admins generate six-digit codes manually from `/admin`; these codes never expire until WhatsApp mode is re-enabled, so only verified tenants should receive them.

---

## 8. Backend Services (Google Cloud)

### Platform

* **Google Cloud Functions** (stateless, low cost)

### Responsibilities

* OTP generation & verification
* Whitelist enforcement
* Session authorization
* OTP counters / WhatsApp API usage
* Daily log upload orchestration
* Each HTTP endpoint also emits `Access-Control-Allow-Origin: *` and is deployed with `--allow-unauthenticated` so browser preflights complete; every operational request still runs `enforceAdmin` (Firebase ID token validation) before any state change, preserving security while letting the UI reach the function.

### Messaging Service (WhatsApp Cloud API)

* Provider: **Meta WhatsApp Cloud API*
* WhatsApp coexistence 
* OTP template messages sent via WhatsApp instead of SMS

**Configurable in /admin**:

* WhatsApp access token / app ID
* Sender phone number (default `+917559421424`) + Meta phone number ID
* Template name `pg_wifi_otp` (body: “Your PG Wi‑Fi OTP is {{1}}. Do not share it. Valid for 5 minutes.”) and template language code (`en` by default)
* Cost per message (₹) for accounting
* Manual fallback: `/admin` exposes a “Generate tenant OTP” button that issues six-digit codes when WhatsApp is down. These are stored in Firestore with the tenant record and must be shared manually over WhatsApp/call.

### Deployment Notes

* Cloud Functions `requestWhatsappOtp` / `verifyWhatsappOtp` run in `asia-south1`
* Required environment variables:
  * `WHATSAPP_ACCESS_TOKEN` – long-lived token from Meta
  * `WHATSAPP_PHONE_ID` – phone number ID used to send OTPs
  * `WHATSAPP_TEMPLATE` – approved WhatsApp template name
  * `WHATSAPP_TEMPLATE_LANG` – template language code (e.g., `en`)
  * `OTP_TTL_SECONDS` (optional) – defaults to 300 seconds
* OTP records are stored hashed in Firestore (`otp_requests`) with nickname/project tags

### User Database (Firestore)

* Mobile number (primary key)
* Whitelisted flag
* Expiry date
* OTP vault: hashed OTP, nickname (if provided), expiry, project tag (`wifi` default)

---

## 9. Compliance Logging (Authoritative)

### What Is Logged (Minimum Required)

* Mobile number (OTP‑verified identity)
* Session start timestamp (IST)
* Session end timestamp (IST)
* Internal IP address
* MAC address
* Auth result (success / failure)
* Failure reason (e.g. not whitelisted)

### What Is NOT Logged

* Browsing history
* URLs
* DNS queries
* Payload / content

---

## 10. Daily Log Lifecycle

### Log Roll

* **Daily at 02:00 AM IST**
* Format: **CSV**
* One immutable file per day

**Filename**:

```
session_report_YYYYMMDD.csv
```

### Upload to GCS

* Once per day after roll
* Deterministic filename → no duplication
* Upload only if object does not exist
* Bucket: **`gs://pg-session-logs`** (Asia-South1, immutable, dd-mm-yyyy summaries shown inside `/admin`)

### Failure & Catch‑Up

* Failed days marked pending
* Next success uploads **all missing days sequentially**

### Retention

* **GCS**: Max **12 months** (lifecycle auto‑delete)

### Local Log Retention

* If uploaded successfully → **prune after 10 days**
* If uploads fail → **hard prune after 90 days**

GCS is the long‑term source of truth.

### Automation reminder

* Cloud Scheduler job `trigger-session-report-daily` calls `triggerSessionReport` at 02:00 IST so the CSV upload happens automatically; keep that job enabled and use the same service account `fir-bestpg@appspot.gserviceaccount.com` for the OIDC token.
* The `/admin` compliance tab calls `listComplianceReports`, which now succeeds because the scheduler/service account holds `roles/cloudfunctions.invoker`.

---

## 11. NAT, IP Sharing & Attribution

### Key Fact

* All users share **one public IP** (NAT)

### Your Responsibility

* Map **Public IP + Timestamp → User session**

### Attribution Chain

```
Time → Internal IP → MAC → Mobile Number
```

### Boundary of Responsibility

* You identify **WHO had access at time T**
* You do **NOT** log or identify **WHAT they did**

This is legally sufficient and industry‑standard.

---

## 12. Admin Portal (/admin)

### Roles (Equal Access)

* Owner
* Sales Manager
* Caretaker

### Access Model

* All roles have **identical operational access**
* Portal is protected by Google / Firebase Sign-In (OAuth). **Only `nishantsah@outlook.in` can unlock `/admin` today.**
* Dates & timestamps always render as **dd-mm-yyyy HH:MM IST** to match compliance records.
* UI split into two tabs: **Wi‑Fi & OTP** (whitelist, WhatsApp settings, compliance table) and **CCTV & VLAN** (NVR IP + health probes).
* A top-right “Sign out” button drops your Firebase session and immediately re-displays the Google gate whenever you want to lock the portal again.

### All Roles CAN

* Manage whitelist tenants per mobile number (toggle WhatsApp vs manual mode per tenant)
* Configure WhatsApp Cloud API credentials (key, phone ID, sender, template) via secure modal; values persist in Firestore and status shows last save time.
* Generate six-digit manual OTPs per tenant (never expire until WhatsApp mode resumes; shown inline in the table).
* Review compliance CSV inventory with date filters and multi-select download (data served from `gs://pg-session-logs`).
* Manage captive portal files (2-step OTP form with DoT logging + zero-sharing checkboxes)
* Launch CCTV stream helper (`/admin/cctv`), save/update NVR IP, and run VLAN health pings.
* View live CCTV
* View historical CCTV recordings

### Hard Restrictions (System‑Enforced)

* ❌ No deletion of logs
* ❌ No modification of historical logs
* ❌ No deletion of CCTV footage
* ❌ No modification of CCTV retention

Deletion is **technically impossible**, not just restricted by UI.

---

## 13. CCTV Integration

* MikroTik ether2 joins the installer’s CCTV LAN as a DHCP client (no need to re-address cameras/NVR)
* Default NVR target `192.168.1.64` (change in `/admin` when you know the actual NVR IP)
* Firewall/NAT only allow the admin subnet (VPN + Google SSO) to reach the CCTV LAN; everyone else is blocked
* Live + recorded playback supported inside `/admin`
* Retention controlled by the NVR storage policy

---

## 14. Security Controls

* Client isolation on APs
* Inter-client traffic allowed for LAN games/sharing, but firewall blocks access to infrastructure (`192.168.1.1–33`)
* OTP rate limiting
* Session idle timeout
* Admin-only CCTV access
* `/admin` gated behind Google Workspace SSO/VPN (L2TP/IPsec live with pool `192.168.1.25–30`; upgrade to RouterOS 7 later for WireGuard)
* Router management locked to `192.168.1.2` (change firewall once permanent admin subnet is chosen)

---
