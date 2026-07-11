# SAP CPI Deployer — Debug Guide

## 🆕 New Features

### 1. Service Key JSON Import
The Options page now accepts pasting your SAP BTP service key JSON directly:

1. Go to **Chrome extension Options** (⚙️ button in popup)
2. Look for **"Import from Service Key JSON"** section (top)
3. Paste your entire service key JSON:
   ```json
   {
     "clientid": "sb-...",
     "clientsecret": "...",
     "tokenurl": "https://...",
     "apiurl": "https://..."
   }
   ```
4. Click **"Parse & Import"**
5. Fields auto-populate; review and **Save**

The parser supports these field names (case-insensitive):
- `clientid` / `client_id` / `clientId`
- `clientsecret` / `client_secret` / `clientSecret`
- `tokenurl` / `token_url` / `tokenUrl`
- `apiurl` / `api_url` / `apiUrl`

If `apiurl` is missing, the parser derives it from the token URL hostname (e.g., `my-tenant.authentication.sap.hana.ondemand.com` → `https://my-tenant.it-cpi.cloud.sap`).

---

## 🐛 Debugging "Failed to Fetch"

If you see **"Failed to Fetch"** errors, use this guide to identify the root cause.

### Step 1: Open Service Worker Console

1. **Chrome** → Go to `chrome://extensions/`
2. Find **"SAP CPI Deployer"**
3. Click **"Inspect views: service worker"** (bottom left)
4. A DevTools window opens showing the **background service worker console**

### Step 2: Check Logs

The background worker logs all operations with prefixes:

- **`[TokenMgr]`** — OAuth token acquisition
- **`[CPIClient]`** — CPI API calls (GET, POST, DELETE)
- **`[BgWorker]`** — Message routing and operations
- **`[Popup]`** — UI actions (from popup console)

**Look for ERROR lines** in red:
```
[TokenMgr] OAuth failed (401): invalid_client
[CPIClient] GET https://my-tenant.it-cpi.cloud.sap/api/v1/IntegrationPackages failed (403): Forbidden
```

### Step 3: Common Issues & Solutions

#### 🔴 **OAuth Token Request Failed**

**Log:** `[TokenMgr] OAuth failed (401): ...` or `(400): ...`

**Likely Causes:**
- ❌ `clientId` / `clientSecret` are **invalid or expired**
- ❌ `tokenUrl` endpoint is **incorrect format**
- ❌ `tokenUrl` domain is **unreachable** (firewall/network)

**Fix:**
1. Verify credentials in SAP BTP Cockpit:
   - Go to Cloud Foundry → Space → Service Instances
   - Find your CPI service instance
   - Click → View Service Key
   - Copy the `clientid`, `clientsecret`, and `tokenurl`
2. Re-import via JSON paste (see above)
3. Try refreshing artifact list again

#### 🔴 **CPI API Call Failed (403 Forbidden)**

**Log:** `[CPIClient] GET https://my-tenant.it-cpi.cloud.sap/api/v1/... failed (403)`

**Likely Causes:**
- ❌ Service account **lacks CPI API permissions** in BTP
- ❌ `baseUrl` is **incorrect**

**Fix:**
1. In SAP BTP Cockpit, go to **Subscriptions** → **Cloud Integration**
2. Click **"Go to Application"** (opens CPI web UI)
3. Check **Settings** → **Tenant Roles** → Assign your service account appropriate CPI roles (e.g., "Administrator", "API User")
4. Wait ~1 minute for role assignment to propagate
5. Try again in the extension

#### 🔴 **CPI API Call Failed (404 Not Found)**

**Log:** `[CPIClient] GET https://my-tenant.it-cpi.cloud.sap/api/v1/... failed (404)`

**Likely Causes:**
- ❌ `baseUrl` is **wrong format**
- ❌ CPI **tenant domain is incorrect**

**Fix:**
- Ensure `baseUrl` format: `https://TENANT.it-cpi.cloud.sap` (no trailing slash)
- Check with CPI web UI URL: If your CPI URL is `https://my-dev.integ.cfapps.us10.hana.ondemand.com`, then:
  - Extract tenant prefix: `my-dev`
  - Standard OData base: `https://my-dev.it-cpi.cloud.sap` (for most SAP Cloud Integration instances)
  - Or if using regional CPI: `https://my-dev.integ.cfapps.us10.hana.ondemand.com` (use the web UI domain directly)

#### 🔴 **Network Error (CORS, Unreachable Host)**

**Log:** `[CPIClient] GET error: TypeError: Failed to fetch`

**Likely Causes:**
- ❌ **Hostname does not resolve** (typo in URL)
- ❌ **Network/firewall blocks the connection**
- ❌ **Host requires VPN or proxy**

**Fix:**
1. Test domain resolution:
   - Open browser DevTools (F12 → Console)
   - Type: `fetch('https://YOUR-TENANT.it-cpi.cloud.sap/api/v1/').then(r => console.log(r.status)).catch(e => console.error(e))`
   - If error, the domain is unreachable from your network
2. Check firewall/proxy settings
3. Verify VPN is active (if required)

---

## Step 3: Popup Console (Optional)

The popup also logs UI-level events. Open it:

1. **Right-click popup** → **Inspect** (or F12 in popup window)
2. Look for `[Popup]` prefixed logs

---

## 📋 Checklist Before Contacting Support

- [ ] Service key credentials (clientId, clientSecret) are **current and valid**
- [ ] `baseUrl` matches the CPI tenant domain format
- [ ] `tokenUrl` matches the SAP authentication endpoint (usually `*.authentication.sap.hana.ondemand.com/oauth/token`)
- [ ] Service account has **CPI API permissions** in BTP
- [ ] Network/firewall allows outbound HTTPS to SAP CPI and Auth domains
- [ ] Cleared browser cache & reloaded extension (chrome://extensions → reload)

---

## Still Not Working?

1. **Collect logs:**
   - Right-click service worker DevTools → Console → Select All → Copy
2. **Note the specific error message** from `[TokenMgr]` or `[CPIClient]`
3. **Share** the error message + your CPI domain (e.g., `my-dev.it-cpi.cloud.sap`)

Good luck! 🚀
