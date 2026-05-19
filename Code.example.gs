// ============================================================
// JOB SEARCH AUTOMATION WORKFLOW
// Google Apps Script | Runs daily at 7:00 AM
// ============================================================
// Free, no VPS, no servers. Runs entirely on Google's infrastructure.
//
// WHAT IT DOES:
//   - Searches LinkedIn + company career pages for fresh job postings
//   - Filters out jobs you've already seen (Google Sheet deduplication)
//   - Fetches the full job description for each new role
//   - Calls Gemini to tailor your resume bullets for each job
//   - Saves a tailored LaTeX .tex file to your Google Drive
//   - Calculates an ATS keyword match score
//   - Emails you a daily digest with everything ready to act on
//
// SETUP:
//   1. Fill in the CONFIG section below
//   2. Replace MASTER_RESUME with your own resume content
//   3. Adjust JOB_SEARCHES to match your target roles and locations
//   4. Run testEmailDelivery() to grant permissions
//   5. Run testFullWorkflowMock() to verify end-to-end
//   6. Run createDailyTrigger() once to schedule the 7am run
// ============================================================

// ─────────────────────────────────────────────
// CONFIG — Edit these values once, then forget
// ─────────────────────────────────────────────
const CONFIG = {
  // Your Gmail address (where the daily digest is sent)
  YOUR_EMAIL: "you@gmail.com",

  // Gemini API key — get free at https://aistudio.google.com
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY_HERE",

  // Google Drive folder ID where tailored resumes are saved
  // Create a folder in Drive, open it, copy the ID from the URL:
  // https://drive.google.com/drive/folders/THIS_PART_IS_THE_ID
  RESUME_FOLDER_ID: "YOUR_DRIVE_FOLDER_ID_HERE",

  // Google Sheet ID for deduplication (tracks seen jobs so no repeats)
  // Create a blank Google Sheet, copy ID from its URL:
  // https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
  SHEET_ID: "YOUR_GOOGLE_SHEET_ID_HERE",

  // Sheet tab name (leave as default unless you rename the tab)
  SHEET_TAB: "SeenJobs",

  // Max jobs to process per run (keeps API usage low; Apps Script limit is 6min/run)
  MAX_JOBS_PER_RUN: 8,
};

// ─────────────────────────────────────────────
// MASTER RESUME — Your base resume content
// Gemini uses this as the source for tailoring.
// Replace everything below with your own info.
// Keep the same structured text format — it is parsed by the tailoring logic.
// ─────────────────────────────────────────────
const MASTER_RESUME = `
NAME: Your Full Name
CONTACT: 555-555-5555 | you@gmail.com | linkedin: your-linkedin | github: your-github | yourwebsite.com

EDUCATION:
Your University — Degree, Major (Expected Month Year)
  Courses: Course 1, Course 2, Course 3, Course 4, Course 5

Your Previous University — Degree, Major (Start Year – End Year)

SKILLS:
Programming: Language1, Language2, Language3, Language4
Technologies: Framework1, Framework2, Tool1, Tool2, Tool3

EXPERIENCE:

Job Title | Company Name | City, State | Month Year – Month Year
- Accomplishment bullet using strong action verb and quantified result (e.g. reduced X by Y%)
- Accomplishment bullet using strong action verb and quantified result
- Accomplishment bullet using strong action verb and quantified result

Job Title | Company Name | City, State | Month Year – Month Year
- Accomplishment bullet using strong action verb and quantified result
- Accomplishment bullet using strong action verb and quantified result

PROJECTS:

Project Name | Tech Stack, Technologies Used
- What you built and the measurable result it achieved
- Key technical decision or challenge you solved

Project Name | Tech Stack, Technologies Used
- What you built and the measurable result it achieved
- Key technical decision or challenge you solved
`;

// ─────────────────────────────────────────────
// JOB SEARCH QUERIES
// LinkedIn search URLs — last 24 hours, entry-level
// Customize keywords and locations for your target roles.
// ─────────────────────────────────────────────
// LinkedIn URL parameter reference:
//   f_TPR=r86400   → posted in last 24 hours (86400 seconds)
//   f_E=1%2C2      → Entry Level (1) + Associate (2)
//   f_JT=F         → Full-time only
//   location=Remote → Remote jobs
// ─────────────────────────────────────────────
const JOB_SEARCHES = [
  // Backend
  {
    label: "Backend Engineer - Remote",
    url: "https://www.linkedin.com/jobs/search/?keywords=backend+engineer+new+grad&location=Remote&f_TPR=r86400&f_E=1%2C2&f_JT=F",
    rss: "https://www.linkedin.com/jobs/search/?keywords=backend+engineer+new+grad&location=Remote&f_TPR=r86400&f_E=1%2C2&f_JT=F"
  },
  {
    label: "Backend Engineer - US",
    url: "https://www.linkedin.com/jobs/search/?keywords=junior+backend+software+engineer&location=United+States&f_TPR=r86400&f_E=1%2C2&f_JT=F",
    rss: "https://www.linkedin.com/jobs/search/?keywords=junior+backend+software+engineer&location=United+States&f_TPR=r86400&f_E=1%2C2&f_JT=F"
  },
  // Full Stack
  {
    label: "Full Stack Engineer - Remote/US",
    url: "https://www.linkedin.com/jobs/search/?keywords=full+stack+engineer+entry+level&location=United+States&f_TPR=r86400&f_E=1%2C2&f_JT=F",
    rss: "https://www.linkedin.com/jobs/search/?keywords=full+stack+engineer+entry+level&location=United+States&f_TPR=r86400&f_E=1%2C2&f_JT=F"
  },
  // Infrastructure / Platform / SRE
  {
    label: "Infrastructure / Platform Engineer - Remote",
    url: "https://www.linkedin.com/jobs/search/?keywords=infrastructure+engineer+new+grad&location=Remote&f_TPR=r86400&f_E=1%2C2&f_JT=F",
    rss: "https://www.linkedin.com/jobs/search/?keywords=infrastructure+engineer+new+grad&location=Remote&f_TPR=r86400&f_E=1%2C2&f_JT=F"
  },
  // SWE New Grad
  {
    label: "Software Engineer New Grad - US",
    url: "https://www.linkedin.com/jobs/search/?keywords=software+engineer+new+grad&location=United+States&f_TPR=r86400&f_E=1%2C2&f_JT=F",
    rss: "https://www.linkedin.com/jobs/search/?keywords=software+engineer+new+grad&location=United+States&f_TPR=r86400&f_E=1%2C2&f_JT=F"
  },
  // Software Engineer I
  {
    label: "Software Engineer I - US",
    url: "https://www.linkedin.com/jobs/search/?keywords=software+engineer+I&location=United+States&f_TPR=r86400&f_E=1%2C2&f_JT=F",
    rss: "https://www.linkedin.com/jobs/search/?keywords=software+engineer+I&location=United+States&f_TPR=r86400&f_E=1%2C2&f_JT=F"
  },
];

// ============================================================
// CORE FUNCTIONS — No need to edit below this line
// ============================================================

/**
 * MAIN ENTRY POINT
 * Called by the time-based trigger every morning at 7am
 */
function runDailyJobSearch() {
  Logger.log("=== Job Search Automation Starting ===");

  try {
    // 1. Initialize deduplication sheet
    const sheet = getOrCreateSheet();

    // 2. Fetch fresh jobs from all search queries
    const allJobs = fetchJobsFromLinkedIn();
    Logger.log(`Fetched ${allJobs.length} total jobs before dedup`);

    // 3. Filter out already-seen jobs
    const newJobs = filterNewJobs(allJobs, sheet);
    Logger.log(`${newJobs.length} new jobs after deduplication`);

    if (newJobs.length === 0) {
      Logger.log("No new jobs found today. Sending empty digest.");
      sendEmptyDigest();
      return;
    }

    // 4. Process each job: tailor resume + calculate ATS score
    const processedJobs = [];
    const jobsToProcess = newJobs.slice(0, CONFIG.MAX_JOBS_PER_RUN);

    for (let i = 0; i < jobsToProcess.length; i++) {
      const job = jobsToProcess[i];
      Logger.log(`Processing job ${i + 1}/${jobsToProcess.length}: ${job.title} at ${job.company}`);

      try {
        const result = processJob(job);
        processedJobs.push(result);

        // Mark as seen in sheet
        markJobAsSeen(sheet, job);

        // Small delay to avoid rate limiting
        Utilities.sleep(2000);
      } catch (e) {
        Logger.log(`Error processing ${job.title}: ${e.message}`);
      }
    }

    // 5. Send morning digest email
    sendDailyDigest(processedJobs);

    Logger.log("=== Job Search Automation Complete ===");

  } catch (e) {
    Logger.log("FATAL ERROR: " + e.message);
    GmailApp.sendEmail(
      CONFIG.YOUR_EMAIL,
      "Job Search Automation Error",
      `The daily job search script encountered an error:\n\n${e.message}\n\nCheck Apps Script logs for details.`
    );
  }
}

/**
 * Fetch jobs from LinkedIn search URLs
 * Uses multiple search queries defined in JOB_SEARCHES
 */
function fetchJobsFromLinkedIn() {
  const jobs = [];
  const seenUrls = new Set();

  for (const search of JOB_SEARCHES) {
    try {
      Logger.log(`Fetching: ${search.label}`);

      const response = UrlFetchApp.fetch(search.rss, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        muteHttpExceptions: true,
      });

      if (response.getResponseCode() !== 200) {
        Logger.log(`HTTP ${response.getResponseCode()} for ${search.label}`);
        continue;
      }

      const html = response.getContentText();
      const extracted = extractJobsFromHTML(html, search.label);

      for (const job of extracted) {
        if (!seenUrls.has(job.url)) {
          seenUrls.add(job.url);
          jobs.push(job);
        }
      }

      Utilities.sleep(1500); // Be polite to LinkedIn
    } catch (e) {
      Logger.log(`Error fetching ${search.label}: ${e.message}`);
    }
  }

  // Also fetch from supplementary company career pages
  const supplementaryJobs = fetchSupplementaryJobs();
  for (const job of supplementaryJobs) {
    if (!seenUrls.has(job.url)) {
      seenUrls.add(job.url);
      jobs.push(job);
    }
  }

  return jobs;
}

/**
 * Extract job listings from LinkedIn HTML
 */
function extractJobsFromHTML(html, sourceLabel) {
  const jobs = [];

  const jobCardPattern = /<div[^>]*class="[^"]*job-search-card[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const titlePattern = /<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i;
  const companyPattern = /<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/i;
  const locationPattern = /<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i;
  const linkPattern = /href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"?]+)/i;
  const datePattern = /<time[^>]*datetime="([^"]+)"/i;

  let match;
  while ((match = jobCardPattern.exec(html)) !== null) {
    const card = match[1];

    const titleMatch = titlePattern.exec(card);
    const companyMatch = companyPattern.exec(card);
    const locationMatch = locationPattern.exec(card);
    const linkMatch = linkPattern.exec(card);
    const dateMatch = datePattern.exec(card);

    if (titleMatch && companyMatch && linkMatch) {
      const title = stripHtml(titleMatch[1]).trim();
      const company = stripHtml(companyMatch[1]).trim();
      const location = locationMatch ? stripHtml(locationMatch[1]).trim() : "Unknown";
      const url = linkMatch[1].split("?")[0];
      const postedDate = dateMatch ? dateMatch[1] : new Date().toISOString();

      jobs.push({
        title,
        company,
        location,
        url,
        postedDate,
        source: sourceLabel,
        description: "",
      });
    }
  }

  Logger.log(`Extracted ${jobs.length} jobs from ${sourceLabel}`);
  return jobs;
}

/**
 * Fetch jobs from supplementary sources (company career pages, Greenhouse, Lever)
 * Add or remove companies from the sources array to customize.
 */
function fetchSupplementaryJobs() {
  const jobs = [];
  const sources = [
    // ── Greenhouse-based (reliable scraping) ──
    { name: "Cloudflare Careers",  url: "https://boards.greenhouse.io/cloudflare",  company: "Cloudflare" },
    { name: "Notion Careers",      url: "https://boards.greenhouse.io/notion",       company: "Notion" },
    { name: "Robinhood Careers",   url: "https://boards.greenhouse.io/robinhood",    company: "Robinhood" },
    { name: "Twitch Careers",      url: "https://boards.greenhouse.io/twitch",       company: "Twitch" },
    { name: "Ramp Careers",        url: "https://boards.greenhouse.io/ramp",         company: "Ramp" },
    { name: "Adobe Careers",       url: "https://boards.greenhouse.io/adobe",        company: "Adobe" },

    // ── Lever-based ──
    { name: "StubHub Careers",     url: "https://jobs.lever.co/stubhub",             company: "StubHub" },

    // ── Custom career pages ──
    { name: "Stripe Careers",      url: "https://stripe.com/jobs/search?query=software+engineer&office=remote-us", company: "Stripe" },
    { name: "Spotify Careers",     url: "https://jobs.spotify.com/home",             company: "Spotify" },
    { name: "Uber Careers",        url: "https://www.uber.com/us/en/careers/",       company: "Uber" },
    { name: "Vercel Careers",      url: "https://vercel.com/careers",                company: "Vercel" },

    // ── Big-corp pages (may 403 on scraping, but still show as quick-links in email) ──
    { name: "Google Careers",      url: "https://careers.google.com/",               company: "Google" },
    { name: "Amazon Careers",      url: "https://www.amazon.jobs/en/search?base_query=software+engineer+new+grad", company: "Amazon" },
    { name: "Apple Careers",       url: "https://jobs.apple.com/",                   company: "Apple" },
    { name: "Microsoft Careers",   url: "https://jobs.microsoft.com/",               company: "Microsoft" },
  ];

  for (const source of sources) {
    try {
      const response = UrlFetchApp.fetch(source.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
        muteHttpExceptions: true,
      });

      if (response.getResponseCode() === 200) {
        const html = response.getContentText();
        const sourceJobs = extractGreenhouseLeverJobs(html, source.company, source.url);
        jobs.push(...sourceJobs);
      }
    } catch (e) {
      Logger.log(`Supplementary source error (${source.name}): ${e.message}`);
    }
    Utilities.sleep(1000);
  }

  return jobs;
}

/**
 * Extract jobs from Greenhouse/Lever-style boards
 */
function extractGreenhouseLeverJobs(html, company, baseUrl) {
  const jobs = [];
  const pattern = /<a[^>]*href="([^"]*\/jobs\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1];
    const text = stripHtml(match[2]).trim();

    if (text.length > 5 && text.length < 100 && isRelevantRole(text)) {
      const url = href.startsWith("http") ? href : baseUrl + href;
      jobs.push({
        title: text,
        company: company,
        location: "See listing",
        url: url,
        postedDate: new Date().toISOString(),
        source: company + " Careers",
        description: "",
      });
    }
  }

  return jobs.slice(0, 5); // Cap per source
}

/**
 * Check if a job title is relevant to your search.
 * Customize the include/exclude keyword lists for your target roles.
 */
function isRelevantRole(title) {
  const t = title.toLowerCase();
  const include = [
    "software engineer", "backend", "full stack", "fullstack",
    "infrastructure", "platform engineer", "sre", "site reliability",
    "new grad", "junior", "associate engineer", "developer",
    "node", "java", "python", "typescript"
  ];
  const exclude = [
    "senior", "staff", "principal", "director", "manager",
    "designer", "product manager", "marketing", "sales", "recruiter",
    "vp", "c-level", "lead"
  ];

  const hasInclude = include.some(kw => t.includes(kw));
  const hasExclude = exclude.some(kw => t.includes(kw));

  return hasInclude && !hasExclude;
}

/**
 * Fetch the job description from the listing URL
 */
function fetchJobDescription(url) {
  try {
    const response = UrlFetchApp.fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html",
      },
      muteHttpExceptions: true,
      followRedirects: true,
    });

    if (response.getResponseCode() !== 200) return "Job description unavailable.";

    const html = response.getContentText();

    const patterns = [
      /<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]{200,3000}?)<\/div>/i,
      /<div[^>]*class="[^"]*job-details[^"]*"[^>]*>([\s\S]{200,3000}?)<\/div>/i,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]{200,3000}?)<\/div>/i,
      /<section[^>]*>([\s\S]{200,3000}?)<\/section>/i,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(html);
      if (match) {
        return stripHtml(match[1]).replace(/\s+/g, " ").trim().substring(0, 2500);
      }
    }

    const bodyMatch = /<body[^>]*>([\s\S]+?)<\/body>/i.exec(html);
    if (bodyMatch) {
      return stripHtml(bodyMatch[1]).replace(/\s+/g, " ").trim().substring(0, 2500);
    }

    return "Job description unavailable — visit listing directly.";
  } catch (e) {
    return "Could not fetch job description: " + e.message;
  }
}

/**
 * Process a single job:
 *   1. Fetch full job description
 *   2. Tailor resume via Gemini
 *   3. Save tailored .tex file to Google Drive
 *   4. Calculate ATS match score
 */
function processJob(job) {
  job.description = fetchJobDescription(job.url);

  const tailoredContent = tailorResumeWithGemini(job);
  const driveLink = generateAndSaveTex(job, tailoredContent);
  const atsScore = calculateATSScore(job.description, tailoredContent);

  return {
    ...job,
    tailoredContent,
    driveLink,
    atsScore,
  };
}

/**
 * Call Gemini to tailor the master resume for this specific job.
 * Outputs a plain-text structured resume that is then compiled into LaTeX.
 */
function tailorResumeWithGemini(job) {
  const prompt = `You are an expert resume tailoring specialist for software engineering roles.

MASTER RESUME:
${MASTER_RESUME}

JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Job Description:
${job.description}

TASK:
Rewrite the resume to maximize ATS keyword match for this specific job.
The output MUST fit on exactly ONE page when compiled as a LaTeX document.

ONE-PAGE CONSTRAINTS (enforce strictly):
- Keep ALL work experience entries — never drop any role
- Include ONLY 2 projects (pick the 2 most relevant to this job)
- Include ONLY 3 courses in the Education section (most relevant to this job)
- Max 4 bullet points per work experience entry (keep the strongest)
- Max 2 bullet points per project
- Max ~100 characters per bullet point

TAILORING RULES:
1. Mirror EXACT keywords, tools, and frameworks mentioned in the job description
2. NEVER invent experience — only reword existing bullets to surface matching terminology
3. Reorder bullets within each role to lead with the most relevant work for THIS job
4. Naturally add keywords from the JD into existing bullets where truthful (e.g. "RESTful APIs", "microservices", "CI/CD")
5. Keep all metrics and numbers from the original bullets
6. Output ONLY the tailored resume in the same structured text format as the input — no commentary, no markdown

Output the full tailored resume text.`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1200,
    }
  };

  try {
    const response = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
      {
        method: "POST",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      }
    );

    const data = JSON.parse(response.getContentText());
    if (data.candidates && data.candidates[0]) {
      return data.candidates[0].content.parts[0].text;
    }
    Logger.log("Gemini error: " + JSON.stringify(data));
  } catch (e) {
    Logger.log("Gemini call failed: " + e.message);
  }

  return MASTER_RESUME; // Fallback: use master resume unchanged
}

/**
 * Build a LaTeX resume from tailored plain-text content and save to Google Drive.
 * Returns an object with the Drive URL and filename.
 */
function generateAndSaveTex(job, tailoredContent) {
  try {
    const latex = buildLatexResume(tailoredContent, job);
    const folder = DriveApp.getFolderById(CONFIG.RESUME_FOLDER_ID);

    const dateStr = Utilities.formatDate(new Date(), "America/Chicago", "yyyy-MM-dd");
    const safeName = `${dateStr}_${job.company.replace(/[^a-zA-Z0-9]/g, "_")}_${job.title.replace(/[^a-zA-Z0-9]/g, "_")}`;

    const texFile = folder.createFile(`${safeName}.tex`, latex, MimeType.PLAIN_TEXT);
    texFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return { texUrl: texFile.getUrl(), fileName: safeName };
  } catch (e) {
    Logger.log("Drive save error: " + e.message);
    return { texUrl: "#", fileName: "error" };
  }
}

/**
 * Build a full LaTeX resume document from the structured plain-text tailored content.
 * Uses a clean single-column format compatible with Overleaf.
 * Customize the heading section (name, contact) with your own details.
 */
function buildLatexResume(tailoredContent, job) {
  const sections = parseTailoredContent(tailoredContent);

  return `\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\input{glyphtounicode}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

\\pdfgentounicode=1

\\newcommand{\\resumeItem}[1]{\\item\\small{#1 \\vspace{-2pt}}}
\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}
\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

\\begin{document}

%----------HEADING — replace with your own name and contact----------
\\begin{center}
    \\textbf{\\Huge \\scshape Your Name} \\\\ \\vspace{1pt}
    \\small 555-555-5555 $|$
    \\href{mailto:you@gmail.com}{\\underline{you@gmail.com}} $|$
    \\href{https://linkedin.com/in/your-profile}{\\underline{linkedin.com/in/your-profile}} $|$
    \\href{https://github.com/your-github}{\\underline{github.com/your-github}}
\\end{center}

%-----------EDUCATION-----------
\\section{Education}
  \\resumeSubHeadingListStart
    \\resumeSubheading
      {Your University}{City, State}
      {Your Degree in Your Major}{Expected: Month Year}
  \\resumeSubHeadingListEnd

%-----------SKILLS-----------
\\section{Technical Skills}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
     \\textbf{Languages}{: Language1, Language2, Language3} \\\\
     \\textbf{Technologies}{: Framework1, Framework2, Tool1, Tool2}
    }}
 \\end{itemize}

%-----------EXPERIENCE-----------
\\section{Experience}
  \\resumeSubHeadingListStart
${sections.experience}
  \\resumeSubHeadingListEnd

%-----------PROJECTS-----------
\\section{Projects}
    \\resumeSubHeadingListStart
${sections.projects}
    \\resumeSubHeadingListEnd

\\end{document}`;
}

/**
 * Parse the plain-text tailored resume content into LaTeX-formatted sections.
 * Expected format for experience entries:
 *   Job Title | Company | Location | Date Range
 *   - bullet point
 *   - bullet point
 *
 * Expected format for project entries:
 *   Project Name | Tech Stack
 *   - bullet point
 */
function parseTailoredContent(content) {
  const expMatch = /EXPERIENCE:([\s\S]+?)(?:PROJECTS:|$)/i.exec(content);
  const projMatch = /PROJECTS:([\s\S]+?)$/i.exec(content);

  let experienceLatex = "";
  let projectsLatex = "";

  if (expMatch) {
    const jobs = expMatch[1].split(/\n(?=[A-Z][^:]+\|)/);
    for (const jobBlock of jobs) {
      if (!jobBlock.trim()) continue;
      const lines = jobBlock.trim().split("\n");
      if (lines.length < 2) continue;

      const parts = lines[0].split("|").map(s => s.trim());
      if (parts.length < 4) continue;

      const [role, company, location, dates] = parts;
      const bullets = lines.slice(1).filter(l => l.trim().startsWith("-"));
      const bulletLatex = bullets.map(b =>
        `        \\resumeItem{${escapeLatex(b.replace(/^-\s*/, "").trim())}}`
      ).join("\n");

      experienceLatex += `    \\resumeSubheading
      {${escapeLatex(role)}}{${escapeLatex(dates)}}
      {${escapeLatex(company)}}{${escapeLatex(location)}}
      \\resumeItemListStart
${bulletLatex}
      \\resumeItemListEnd\n`;
    }
  }

  if (projMatch) {
    const projects = projMatch[1].split(/\n(?=[A-Z])/);
    for (const projBlock of projects) {
      if (!projBlock.trim()) continue;
      const lines = projBlock.trim().split("\n");
      const pipeIdx = lines[0].indexOf("|");
      const projName = pipeIdx > -1 ? lines[0].substring(0, pipeIdx).trim() : lines[0].trim();
      const techStack = pipeIdx > -1 ? lines[0].substring(pipeIdx + 1).trim() : "";

      const bullets = lines.slice(1).filter(l => l.trim().startsWith("-"));
      const bulletLatex = bullets.map(b =>
        `        \\resumeItem{${escapeLatex(b.replace(/^-\s*/, "").trim())}}`
      ).join("\n");

      projectsLatex += `      \\resumeProjectHeading
          {\\textbf{${escapeLatex(projName)}} $|$ \\emph{${escapeLatex(techStack)}}}{}
      \\resumeItemListStart
${bulletLatex}
      \\resumeItemListEnd\n`;
    }
  }

  return { experience: experienceLatex, projects: projectsLatex };
}

/**
 * Calculate ATS keyword match score between a job description and resume content.
 * Returns a percentage string (e.g. "82%").
 */
function calculateATSScore(jobDescription, resumeContent) {
  if (!jobDescription || jobDescription.length < 50) return "N/A";

  const jdWords = new Set(
    jobDescription.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3)
  );
  const resumeWords = new Set(
    resumeContent.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3)
  );

  const techKeywords = [
    "java", "python", "javascript", "typescript", "node", "react", "spring",
    "backend", "frontend", "fullstack", "api", "rest", "microservices",
    "distributed", "cloud", "aws", "gcp", "docker", "kubernetes", "ci/cd",
    "sql", "database", "postgresql", "mysql", "testing", "agile", "git",
    "scalable", "performance", "reliability", "infrastructure", "platform"
  ];

  let matched = 0;
  let total = 0;

  for (const kw of techKeywords) {
    if (jdWords.has(kw) || [...jdWords].some(w => w.includes(kw))) {
      total++;
      if (resumeWords.has(kw) || [...resumeWords].some(w => w.includes(kw))) {
        matched++;
      }
    }
  }

  if (total === 0) return "75%";
  return Math.round((matched / total) * 100) + "%";
}

/**
 * Send the morning digest email with all processed jobs
 */
function sendDailyDigest(processedJobs) {
  const date = Utilities.formatDate(new Date(), "America/Chicago", "MMMM dd, yyyy");
  const subject = `Job Digest — ${processedJobs.length} curated roles for ${date}`;

  let htmlBody = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 0 auto; background: #f8f9fa; }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 32px; border-radius: 12px 12px 0 0; }
  .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 700; }
  .header p { margin: 0; opacity: 0.75; font-size: 14px; }
  .stats { display: flex; gap: 16px; background: white; padding: 20px 32px; border-bottom: 1px solid #e9ecef; }
  .stat { text-align: center; }
  .stat-num { font-size: 28px; font-weight: 700; color: #1a1a2e; }
  .stat-label { font-size: 12px; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px; }
  .job-card { background: white; margin: 12px 0; border-radius: 10px; border-left: 4px solid #4361ee; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
  .job-header { padding: 20px 24px 12px; }
  .job-title { font-size: 18px; font-weight: 700; color: #1a1a2e; margin: 0 0 4px 0; }
  .job-company { font-size: 15px; color: #4361ee; font-weight: 600; margin: 0 0 4px 0; }
  .job-meta { font-size: 13px; color: #6c757d; margin: 0; }
  .ats-badge { display: inline-block; background: #e8f4fd; color: #0077b6; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-top: 8px; }
  .section { padding: 0 24px 16px; }
  .btn { display: inline-block; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-right: 8px; margin-top: 4px; }
  .btn-primary { background: #4361ee; color: white; }
  .btn-secondary { background: #f8f9fa; color: #495057; border: 1px solid #dee2e6; }
  .footer { background: #1a1a2e; color: rgba(255,255,255,0.5); padding: 20px 32px; text-align: center; font-size: 12px; border-radius: 0 0 12px 12px; }
</style>
</head>
<body>
<div class="header">
  <h1>Good morning!</h1>
  <p>${date} · Your daily job digest is ready · ${processedJobs.length} new roles found</p>
</div>

<div class="stats">
  <div class="stat"><div class="stat-num">${processedJobs.length}</div><div class="stat-label">New Roles</div></div>
  <div class="stat"><div class="stat-num">${processedJobs.filter(j => parseInt(j.atsScore) >= 70).length}</div><div class="stat-label">Strong ATS Match (70%+)</div></div>
  <div class="stat"><div class="stat-num">${processedJobs.filter(j => parseInt(j.atsScore) >= 80).length}</div><div class="stat-label">Excellent Match (80%+)</div></div>
</div>

<div style="background:white;padding:20px 32px;border-bottom:1px solid #e9ecef;">
  <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6c757d;margin:0 0 12px 0;">Career Pages — Check Manually</p>
  <div style="display:flex;flex-wrap:wrap;gap:8px;">
    <a href="https://jobs.spotify.com/home" style="display:inline-block;padding:7px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;text-decoration:none;color:#212529;font-size:13px;font-weight:600;">Spotify</a>
    <a href="https://boards.greenhouse.io/notion" style="display:inline-block;padding:7px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;text-decoration:none;color:#212529;font-size:13px;font-weight:600;">Notion</a>
    <a href="https://stripe.com/jobs/search?query=software+engineer" style="display:inline-block;padding:7px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;text-decoration:none;color:#212529;font-size:13px;font-weight:600;">Stripe</a>
    <a href="https://boards.greenhouse.io/robinhood" style="display:inline-block;padding:7px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;text-decoration:none;color:#212529;font-size:13px;font-weight:600;">Robinhood</a>
    <a href="https://www.uber.com/us/en/careers/" style="display:inline-block;padding:7px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;text-decoration:none;color:#212529;font-size:13px;font-weight:600;">Uber</a>
    <a href="https://boards.greenhouse.io/twitch" style="display:inline-block;padding:7px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;text-decoration:none;color:#212529;font-size:13px;font-weight:600;">Twitch</a>
    <a href="https://boards.greenhouse.io/ramp" style="display:inline-block;padding:7px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;text-decoration:none;color:#212529;font-size:13px;font-weight:600;">Ramp</a>
    <a href="https://careers.google.com/" style="display:inline-block;padding:7px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;text-decoration:none;color:#212529;font-size:13px;font-weight:600;">Google</a>
    <a href="https://www.amazon.jobs/en/search?base_query=software+engineer+new+grad" style="display:inline-block;padding:7px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;text-decoration:none;color:#212529;font-size:13px;font-weight:600;">Amazon</a>
    <a href="https://boards.greenhouse.io/adobe" style="display:inline-block;padding:7px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;text-decoration:none;color:#212529;font-size:13px;font-weight:600;">Adobe</a>
    <a href="https://jobs.lever.co/stubhub" style="display:inline-block;padding:7px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;text-decoration:none;color:#212529;font-size:13px;font-weight:600;">StubHub</a>
    <a href="https://jobs.apple.com/" style="display:inline-block;padding:7px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;text-decoration:none;color:#212529;font-size:13px;font-weight:600;">Apple</a>
    <a href="https://jobs.microsoft.com/" style="display:inline-block;padding:7px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;text-decoration:none;color:#212529;font-size:13px;font-weight:600;">Microsoft</a>
  </div>
</div>
`;

  for (let i = 0; i < processedJobs.length; i++) {
    const job = processedJobs[i];
    const atsColor = parseInt(job.atsScore) >= 75 ? "#2ecc71" : parseInt(job.atsScore) >= 60 ? "#f39c12" : "#e74c3c";
    const atsBg = parseInt(job.atsScore) >= 75 ? "#eafaf1" : parseInt(job.atsScore) >= 60 ? "#fef9e7" : "#fdedec";

    htmlBody += `
<div class="job-card">
  <div class="job-header">
    <p class="job-title">${i + 1}. ${escapeHtml(job.title)}</p>
    <p class="job-company">${escapeHtml(job.company)}</p>
    <p class="job-meta">${escapeHtml(job.location)} · ${formatDate(job.postedDate)} · ${escapeHtml(job.source)}</p>
    <span class="ats-badge" style="background:${atsBg};color:${atsColor};">ATS Match: ${job.atsScore}</span>
  </div>
  <div class="section">
    <a href="${job.driveLink.texUrl}" class="btn btn-secondary">LaTeX Source (.tex)</a>
    <a href="${job.url}" class="btn btn-primary" target="_blank">Apply Now</a>
  </div>
</div>`;
  }

  htmlBody += `
<div class="footer">
  Generated automatically by your Job Search Automation · Running daily at 7:00 AM CT<br>
  <a href="https://script.google.com" style="color:rgba(255,255,255,0.5);">Manage in Google Apps Script</a>
</div>
</body>
</html>`;

  GmailApp.sendEmail(CONFIG.YOUR_EMAIL, subject, "Your daily job digest is ready. Enable HTML to view.", {
    htmlBody: htmlBody,
    name: "Job Search Automation",
  });

  Logger.log(`Digest sent to ${CONFIG.YOUR_EMAIL} with ${processedJobs.length} jobs`);
}

/**
 * Send a short email when no new jobs are found
 */
function sendEmptyDigest() {
  const date = Utilities.formatDate(new Date(), "America/Chicago", "MMMM dd, yyyy");
  GmailApp.sendEmail(
    CONFIG.YOUR_EMAIL,
    `Job Digest — No new roles found (${date})`,
    `No new jobs matched your criteria today. The workflow checked all your search queries and found no postings in the last 24 hours that haven't been seen before.\n\nThe search will run again tomorrow at 7:00 AM.`,
    { name: "Job Search Automation" }
  );
}

// ─────────────────────────────────────────────
// DEDUPLICATION — Google Sheet tracking
// ─────────────────────────────────────────────

function getOrCreateSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_TAB);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_TAB);
    sheet.appendRow(["job_url", "job_title", "company", "processed_at"]);
    sheet.getRange(1, 1, 1, 4).setFontWeight("bold");
  }

  return sheet;
}

function filterNewJobs(jobs, sheet) {
  const data = sheet.getDataRange().getValues();
  const seenUrls = new Set(data.slice(1).map(row => row[0]));
  return jobs.filter(job => !seenUrls.has(job.url));
}

function markJobAsSeen(sheet, job) {
  sheet.appendRow([job.url, job.title, job.company, new Date().toISOString()]);
}

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeLatex(text) {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return Utilities.formatDate(d, "America/Chicago", "MMM dd, yyyy");
  } catch (e) {
    return "Recently";
  }
}

// ─────────────────────────────────────────────
// TEST FUNCTIONS — Run these manually first
// ─────────────────────────────────────────────

/**
 * Test 1: Verify email delivery works.
 * Run this first — it also triggers the permissions grant flow.
 */
function testEmailDelivery() {
  GmailApp.sendEmail(
    CONFIG.YOUR_EMAIL,
    "Job Search Automation — Email Test",
    "Your email delivery is working correctly. The daily digest will arrive at 7:00 AM."
  );
  Logger.log("Test email sent to " + CONFIG.YOUR_EMAIL);
}

/**
 * Test 2: Verify Gemini API key works.
 */
function testGeminiAPI() {
  const payload = {
    contents: [{ parts: [{ text: "Say 'API working' in exactly 2 words." }] }]
  };

  const response = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
    {
      method: "POST",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    }
  );

  const data = JSON.parse(response.getContentText());
  if (data.candidates) {
    Logger.log("✅ Gemini API is working!");
  } else {
    Logger.log("❌ Gemini API error: " + JSON.stringify(data));
  }
}

/**
 * Test 3: Verify Drive folder access.
 */
function testDriveAccess() {
  try {
    const folder = DriveApp.getFolderById(CONFIG.RESUME_FOLDER_ID);
    Logger.log("✅ Drive folder found: " + folder.getName());
    const testFile = folder.createFile("test_delete_me.txt", "test", MimeType.PLAIN_TEXT);
    Logger.log("✅ Can write to folder");
    testFile.setTrashed(true);
  } catch (e) {
    Logger.log("❌ Drive error: " + e.message);
  }
}

/**
 * Test 4: Run the full workflow end-to-end with a mock job.
 * No LinkedIn scraping — uses a hardcoded job description.
 * Check your email and Drive after running this.
 */
function testFullWorkflowMock() {
  const mockJob = {
    title: "Backend Software Engineer",
    company: "Stripe",
    location: "Remote - US",
    url: "https://stripe.com/jobs/listing/backend-engineer",
    postedDate: new Date().toISOString(),
    source: "Test",
    description: "We are looking for a Backend Software Engineer to join our Payments Infrastructure team. You'll build and maintain distributed systems that process millions of transactions per day. Requirements: Java or Python, microservices architecture, RESTful API design, SQL databases, experience with distributed systems, CI/CD pipelines, high code coverage and testing culture. Nice to have: experience with financial systems, AWS or GCP, Kubernetes."
  };

  Logger.log("Processing mock job: " + mockJob.title);
  const result = processJob(mockJob);
  Logger.log("ATS Score: " + result.atsScore);
  Logger.log("Drive link: " + result.driveLink.texUrl);

  sendDailyDigest([result]);
  Logger.log("✅ Full mock workflow complete — check your email and Drive!");
}

/**
 * Set up the daily 7am trigger (run once).
 * Re-run this if you change the trigger time.
 */
function createDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "runDailyJobSearch") {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  ScriptApp.newTrigger("runDailyJobSearch")
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .inTimezone("America/Chicago")
    .create();

  Logger.log("✅ Daily trigger created — workflow runs at 7:00 AM CT every day");
}
