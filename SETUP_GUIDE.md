# 🚀 Job Search Automation — Setup Guide
### Anant Goyal | Daily 7am Job Digest | Free, no VPS needed

Everything runs on Google's servers. No monthly fees. No VPS. Fully automated.

---

## What You'll Have When Done

Every morning at **7:00 AM CT**, your inbox receives an email with:
- ✅ **8 fresh jobs** posted in the last 24 hours (backend, full stack, infra roles)
- ✅ **Tailored LaTeX resume** saved to your Drive for each job
- ✅ **ATS match score** per job so you know which ones to prioritize
- ✅ **Copy-paste application answers** for all 4 common questions, customized per company
- ✅ **Direct "Apply Now" link** — you click, you read, you apply

---

## Prerequisites (all free)

| What | Where | Cost |
|---|---|---|
| Google account (Gmail + Drive) | Already have it | Free |
| Gemini API key | aistudio.google.com | Free (60 req/min) |
| Google Apps Script | script.google.com | Free |
| Google Sheets (deduplication) | sheets.google.com | Free |
| Google Drive folder (resumes) | drive.google.com | Free |

---

## Step 1 — Create Your Drive Folder

1. Go to [drive.google.com](https://drive.google.com)
2. Click **New → Folder**
3. Name it: `Job Applications - Automated`
4. Open the folder
5. Copy the **Folder ID** from the URL:
   ```
   https://drive.google.com/drive/folders/THIS_LONG_STRING_IS_YOUR_ID
   ```
6. Save this ID — you'll paste it into the script CONFIG

---

## Step 2 — Create Your Deduplication Sheet

1. Go to [sheets.google.com](https://sheets.google.com)
2. Click **Blank spreadsheet**
3. Name it: `Job Search Tracker`
4. Copy the **Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/THIS_LONG_STRING_IS_YOUR_ID/edit
   ```
5. Save this ID — you'll paste it into the script CONFIG
6. Leave the sheet blank — the script creates the `SeenJobs` tab automatically

---

## Step 3 — Get Your Free Gemini API Key

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account
3. Click **Get API key** (top left)
4. Click **Create API key**
5. Copy the key
6. Save it — you'll paste it into the script CONFIG

> The free Gemini tier gives you 60 requests/minute and 1,500 requests/day.
> Processing 8 jobs/day uses ~16 API calls. You're well within free limits.

---

## Step 4 — Set Up Google Apps Script

1. Go to [script.google.com](https://script.google.com)
2. Click **New project**
3. Name it: `Job Search Automation`
4. Delete the existing code in the editor (the `function myFunction()` stub)
5. Open the `Code.gs` file from this package
6. **Copy ALL of it** and paste it into the Apps Script editor
7. Click **Save** (Ctrl+S / Cmd+S)

---

## Step 5 — Fill in Your CONFIG

At the top of the script, find the `CONFIG` block and fill in your values:

```javascript
const CONFIG = {
  YOUR_EMAIL: "example@gmail.com",               // ← your Gmail
  GEMINI_API_KEY: "Key...",                   // ← from Step 3
  RESUME_FOLDER_ID: "1abc...xyz",                // ← from Step 1
  SHEET_ID: "1def...uvw",                        // ← from Step 2
  SHEET_TAB: "SeenJobs",                         // ← leave as-is
  MAX_JOBS_PER_RUN: 8,                           // ← adjust if you want more/fewer
};
```

---

## Step 6 — Grant Permissions

The script needs permission to access Gmail, Drive, and Sheets. Here's how:

1. In the Apps Script editor, click **Run → testEmailDelivery** from the dropdown
2. A popup appears: click **Review permissions**
3. Choose your Google account
4. Click **Advanced → Go to Job Search Automation (unsafe)**
   *(This is your own script — "unsafe" just means it's not published to the store)*
5. Click **Allow**

Google will now trust this script to run on your behalf.

---

## Step 7 — Run the Tests (in order)

Run each test from **Run → [function name]** in the Apps Script editor:

### Test 1: Email delivery
```
Function: testEmailDelivery
Expected: You receive a test email in your Gmail inbox
```

### Test 2: Gemini API
```
Function: testGeminiAPI
Expected: Logs show "✅ Gemini API is working!"
Check: View → Logs (or Ctrl+Enter after running)
```

### Test 3: Drive access
```
Function: testDriveAccess
Expected: Logs show "✅ Drive folder found: Job Applications - Automated"
```

### Test 4: Full mock run
```
Function: testFullWorkflowMock
Expected: You receive a full digest email with:
  - A mock Stripe job
  - Link to .tex file in Drive
  - ATS score
  - 4 application question answers
```

If all 4 tests pass, you're ready.

---

## Step 8 — Create the Daily Trigger

Run this function **once** to schedule the 7am automation:

```
Function: createDailyTrigger
```

After running, verify it worked:
1. Click **Triggers** (clock icon in left sidebar, or Edit → Triggers)
2. You should see `runDailyJobSearch` with:
   - Event source: Time-driven
   - Type: Day timer
   - Time: 7am to 8am
   - Timezone: America/Chicago

**That's it. The system is live.**

---

## What Happens Every Morning at 7am

```
7:00 AM  Script wakes up on Google's servers
         ↓
         Searches LinkedIn for fresh jobs matching your queries:
         • backend engineer new grad (remote + US)
         • junior backend software engineer (US)
         • full stack engineer entry level (US)
         • infrastructure engineer new grad (remote)
         • software engineer new grad 2025 (Canada)
         • Also checks: Cloudflare, Stripe, Vercel career pages
         ↓
         Filters out jobs already seen (checks Google Sheet)
         ↓
         For each new job (up to 8):
           → Fetches full job description
           → Calls Gemini to tailor your resume bullets
           → Generates LaTeX .tex file → saves to Drive
           → Generates plain text resume → saves to Drive
           → Calls Gemini to write 4 application answers
           → Calculates ATS keyword match score
         ↓
7:05 AM  Sends you the digest email
         ↓
         You wake up, open email, pick your 3-5 best matches
         Copy answers, click Apply, paste tailored resume
```

---

## Your Morning Routine (5-10 minutes)

1. Open the digest email
2. Sort by ATS score — apply to the 75%+ matches first
3. Click "Apply Now" on a job
4. Click the ".tex" Drive link → copy into Overleaf → compile to PDF
5. Paste the application answers, lightly edit the [COMPANY] specifics
6. Submit

> **On Overleaf:** Go to overleaf.com → New Project → Upload → drag the .tex file → click Compile → Download PDF

---

## Customizing Your Job Searches

To add/remove search queries, edit the `JOB_SEARCHES` array in the script.

**Adding a new city:**
```javascript
{
  label: "Backend Engineer - Austin",
  rss: "https://www.linkedin.com/jobs/search/?keywords=backend+engineer&location=Austin%2C+Texas&f_TPR=r86400&f_E=1%2C2&f_JT=F"
}
```

**LinkedIn URL parameters explained:**
- `f_TPR=r86400` → posted in last 24 hours (86400 seconds)
- `f_E=1%2C2` → Entry Level (1) + Associate (2)
- `f_JT=F` → Full-time only
- `location=Remote` → Remote jobs

**To change time window to 48 hours:**
```
f_TPR=r86400  →  f_TPR=r172800
```

---

## Updating Your Resume

When you add new experience or projects:
1. Open `Code.gs` in Apps Script
2. Find the `MASTER_RESUME` constant
3. Update the relevant section
4. Save (Ctrl+S)

The next morning's run will use your updated resume.

---

## Updating Application Question Answers

Open `Code.gs`, find `RESPONSE_BANK`, and edit any of the 4 answers.
The AI uses these as the base and customizes them per company.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| No email received | Check spam folder; run `testEmailDelivery` again |
| "Gemini API error" | Verify your API key in CONFIG; check aistudio.google.com quota |
| "Drive folder not found" | Double-check RESUME_FOLDER_ID — copy from the URL again |
| "0 jobs found" | LinkedIn may be blocking — the script will retry tomorrow; check logs |
| Jobs repeating | The Sheet dedup is working — if same job appears twice, delete its row from the SeenJobs tab |
| Script timeout | Reduce MAX_JOBS_PER_RUN to 5 (Apps Script has a 6min limit per run) |

**Viewing logs:**
- In Apps Script editor: click **Executions** (left sidebar)
- Find today's run, click it, read the logs

---

## Cost Summary

| Item | Cost |
|---|---|
| Google Apps Script | Free (6min/run, 90min/day limit — you use ~5min/run) |
| Gemini 1.5 Flash API | Free (1,500 req/day — you use ~16/day) |
| Google Drive storage | Free (15GB — .tex files are tiny) |
| Google Sheets | Free |
| Gmail sending | Free |
| **Total** | **$0/month** |

---

## Files in This Package

```
job_search_workflow/
├── Code.gs              ← Main script (paste into Apps Script)
├── resume_master.tex    ← Your base LaTeX resume (upload to Overleaf to test)
└── SETUP_GUIDE.md       ← This file
```

---

## Future Upgrades (optional, still free)

- **Add Slack notification** instead of email using incoming webhooks
- **Auto-track applications** in the Google Sheet with status (Applied/Interview/Rejected)
- **Add more company career pages** to the supplementary sources
- **Weekly summary email** with stats (how many jobs, avg ATS score, how many you applied to)

---

*Built with Google Apps Script + Gemini API. Runs entirely on Google's free infrastructure.*
