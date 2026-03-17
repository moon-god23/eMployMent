import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

// ──────────────────────────────────────────────────────────────
// Skill extractor helper — scans raw text for known tech skills
// ──────────────────────────────────────────────────────────────
const SKILLS = [
  'React','Vue','Angular','Node.js','Python','Java','TypeScript',
  'JavaScript','SQL','PostgreSQL','MongoDB','Redis','Docker','Kubernetes',
  'AWS','GCP','Azure','TensorFlow','PyTorch','Pandas','Django','Flask',
  'Spring','Kotlin','Swift','Flutter','Android','iOS','GraphQL','REST APIs',
  'Git','Linux','Go','Rust','C++','Figma','Tableau','Spark','Hadoop',
  'React Native','OpenAPI','Prometheus','Terraform','CUDA','NLP',
];

function extractSkillsFromText(text) {
  if (!text) return [];
  return SKILLS.filter(s => text.toLowerCase().includes(s.toLowerCase()));
}

// ──────────────────────────────────────────────────────────────
// Strategy 7 — Mock data (always works, permanent fallback)
// ──────────────────────────────────────────────────────────────
function getMockListings() {
  return [
    { title: 'Frontend Intern',       company: 'Razorpay',     location: 'Bengaluru', skills_required: ['React','TypeScript','Tailwind'],         source: 'mock', url: 'https://razorpay.com/careers' },
    { title: 'ML Intern',             company: 'Google',       location: 'Remote',    skills_required: ['Python','TensorFlow','Statistics'],      source: 'mock', url: 'https://careers.google.com' },
    { title: 'Backend Intern',        company: 'Zepto',        location: 'Mumbai',    skills_required: ['Node.js','PostgreSQL','Redis'],          source: 'mock', url: 'https://zepto.com/careers' },
    { title: 'Data Science Intern',   company: 'Flipkart',     location: 'Bengaluru', skills_required: ['Python','Pandas','SQL'],                 source: 'mock', url: 'https://careers.flipkart.com' },
    { title: 'DevOps Intern',         company: 'Swiggy',       location: 'Bengaluru', skills_required: ['Docker','Kubernetes','CI/CD'],           source: 'mock', url: 'https://careers.swiggy.com' },
    { title: 'Full Stack Intern',     company: 'CRED',         location: 'Bengaluru', skills_required: ['React','Node.js','MongoDB'],             source: 'mock', url: 'https://cred.club/careers' },
    { title: 'Android Intern',        company: 'Meesho',       location: 'Bengaluru', skills_required: ['Kotlin','Android'],                     source: 'mock', url: 'https://careers.meesho.com' },
    { title: 'UI/UX Intern',          company: 'Groww',        location: 'Remote',    skills_required: ['Figma','UX Research'],                  source: 'mock', url: 'https://careers.groww.in' },
    { title: 'iOS Intern',            company: 'PhonePe',      location: 'Pune',      skills_required: ['Swift','SwiftUI'],                      source: 'mock', url: 'https://careers.phonepe.com' },
    { title: 'Backend Intern',        company: 'Ola',          location: 'Bengaluru', skills_required: ['Java','Spring','SQL'],                  source: 'mock', url: 'https://careers.olacabs.com' },
    { title: 'ML Research Intern',    company: 'Microsoft',    location: 'Hyderabad', skills_required: ['PyTorch','NLP','Python'],               source: 'mock', url: 'https://careers.microsoft.com' },
    { title: 'Cloud Intern',          company: 'Amazon',       location: 'Hyderabad', skills_required: ['AWS','Terraform','Python'],             source: 'mock', url: 'https://amazon.jobs' },
    { title: 'Frontend Intern',       company: 'Zomato',       location: 'Gurugram',  skills_required: ['Vue','JavaScript'],                     source: 'mock', url: 'https://careers.zomato.com' },
    { title: 'Security Intern',       company: 'BrowserStack', location: 'Mumbai',    skills_required: ['Linux','Networking'],                   source: 'mock', url: 'https://www.browserstack.com/careers' },
    { title: 'API Intern',            company: 'Postman',      location: 'Bengaluru', skills_required: ['REST APIs','Node.js','OpenAPI'],        source: 'mock', url: 'https://www.postman.com/careers' },
    { title: 'Data Analyst Intern',   company: 'Juspay',       location: 'Bengaluru', skills_required: ['SQL','Python','Tableau'],              source: 'mock', url: 'https://juspay.in/careers' },
    { title: 'React Native Intern',   company: 'Dream11',      location: 'Mumbai',    skills_required: ['React Native','JavaScript'],           source: 'mock', url: 'https://dream11.com/careers' },
    { title: 'AI Intern',             company: 'NVIDIA',       location: 'Pune',      skills_required: ['CUDA','Python','Deep Learning'],       source: 'mock', url: 'https://nvidia.com/careers' },
    { title: 'Product Intern',        company: 'Notion',       location: 'Remote',    skills_required: ['Figma','Analytics'],                   source: 'mock', url: 'https://notion.so/careers' },
    { title: 'SRE Intern',            company: 'Atlassian',    location: 'Bengaluru', skills_required: ['Linux','Prometheus','Go'],             source: 'mock', url: 'https://atlassian.com/careers' },
  ];
}

// ──────────────────────────────────────────────────────────────
// Strategy 1 — RapidAPI LinkedIn Jobs
// ──────────────────────────────────────────────────────────────
async function scrapeRapidAPILinkedIn(keyword = 'software intern') {
  if (!process.env.RAPIDAPI_KEY) return [];
  try {
    const { data } = await axios.get('https://linkedin-jobs-search.p.rapidapi.com/', {
      params: { query: keyword, location: 'India', page: '1', datePosted: 'anyTime', jobType: 'internship' },
      headers: {
        'X-RapidAPI-Key':  process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': process.env.RAPIDAPI_HOST || 'linkedin-jobs-search.p.rapidapi.com',
      },
      timeout: 10000,
    });

    return (data || []).map(job => ({
      title:           job.title || 'Internship',
      company:         job.company || 'Unknown',
      location:        job.location || 'India',
      url:             job.linkedin_job_url_cleaned || job.job_url || null,
      skills_required: extractSkillsFromText(job.description || ''),
      deadline:        null,
      source:          'rapidapi',
    }));
  } catch (err) {
    console.error('[SCRAPE] RapidAPI error:', err.message);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────
// Strategy 2 — Unstop public API (no key needed, best for India)
// ──────────────────────────────────────────────────────────────
async function scrapeUnstop(keyword = 'software intern') {
  try {
    const { data } = await axios.get('https://unstop.com/api/public/opportunity/search-result', {
      params: { opportunity: 'jobs', keyword, page: 0, per_page: 20 },
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; n8tern-scraper/1.0)' },
      timeout: 10000,
    });

    const items = data?.data?.data || [];
    return items.map(item => ({
      title:           item.title || 'Internship',
      company:         item.organisation?.name || 'Unknown',
      location:        item.job_location || item.locations?.[0]?.name || 'India',
      url:             `https://unstop.com/jobs/${item.slug}`,
      skills_required: (item.skills || []).map(s => s.name || s).filter(Boolean),
      deadline:        item.end_date ? item.end_date.split('T')[0] : null,
      source:          'unstop',
    }));
  } catch (err) {
    console.error('[SCRAPE] Unstop error:', err.message);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────
// Strategy 3 — Internshala (cheerio scrape)
// ──────────────────────────────────────────────────────────────
async function scrapeInternshala(keyword = 'software') {
  try {
    const url = `https://internshala.com/internships/keywords-${encodeURIComponent(keyword)}`;
    const { data: html } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; n8tern-scraper/1.0)' },
      timeout: 12000,
    });

    const $ = cheerio.load(html);
    const listings = [];

    $('.individual_internship').each((_, el) => {
      const title   = $(el).find('.profile').text().trim();
      const company = $(el).find('.company-name').text().trim();
      const href    = $(el).find('a.view_detail_button').attr('href') || '';
      const loc     = $(el).find('.location_link').first().text().trim() || 'India';

      if (title) {
        listings.push({
          title,
          company: company || 'Unknown',
          location: loc,
          url:     href ? `https://internshala.com${href}` : null,
          skills_required: extractSkillsFromText($(el).text()),
          deadline: null,
          source:   'internshala',
        });
      }
    });

    return listings;
  } catch (err) {
    console.error('[SCRAPE] Internshala error:', err.message);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────
// Strategy 4 — Naukri JSON API
// ──────────────────────────────────────────────────────────────
async function scrapeNaukri(keyword = 'software intern') {
  try {
    const { data } = await axios.get('https://www.naukri.com/jobapi/v3/search', {
      params: { noOfResults: 20, urlType: 'search_by_keyword', searchType: 'adv', keyword, k: keyword },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; n8tern-scraper/1.0)',
        'appid':      '109',
        'systemid':   '109',
      },
      timeout: 10000,
    });

    const jobs = data?.jobDetails || [];
    return jobs.map(job => ({
      title:           job.title || 'Internship',
      company:         job.companyName || 'Unknown',
      url:             job.jdURL || null,
      skills_required: extractSkillsFromText((job.tagsAndSkills || '') + ' ' + (job.jobDescription || '')),
      deadline:        null,
      source:          'naukri',
    }));
  } catch (err) {
    console.error('[SCRAPE] Naukri error:', err.message);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────
// Strategy 5 — Wellfound startup internships (cheerio)
// ──────────────────────────────────────────────────────────────
async function scrapeWellfound() {
  try {
    const { data: html } = await axios.get('https://wellfound.com/jobs?role=intern&locations[]=India', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; n8tern-scraper/1.0)' },
      timeout: 12000,
    });

    const $ = cheerio.load(html);
    const listings = [];

    $('[class*="jobCard"], [class*="job-card"], [class*="JobCard"]').each((_, el) => {
      const title   = $(el).find('[class*="title"], h2, h3').first().text().trim();
      const company = $(el).find('[class*="company"], [class*="startup"]').first().text().trim();

      if (title) {
        listings.push({
          title,
          company: company || 'Startup',
          url:     null,
          skills_required: extractSkillsFromText($(el).text()),
          deadline: null,
          source:   'wellfound',
        });
      }
    });

    return listings;
  } catch (err) {
    console.error('[SCRAPE] Wellfound error:', err.message);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────
// Strategy 6 — Puppeteer (demo only, falls back to mock)
// ──────────────────────────────────────────────────────────────
async function scrapePuppeteer(keyword = 'software intern') {
  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
      headless: true,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&f_JT=I&location=India`,
      { waitUntil: 'networkidle2', timeout: 20000 }
    );

    const jobs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.job-search-card')).map(card => ({
        title:   card.querySelector('.base-search-card__title')?.textContent?.trim() || '',
        company: card.querySelector('.base-search-card__subtitle')?.textContent?.trim() || '',
        url:     card.querySelector('a')?.href || null,
      }));
    });

    await browser.close();

    if (!jobs || jobs.length === 0) {
      console.log('[SCRAPE] Puppeteer returned 0 results, falling through');
      return [];
    }

    return jobs.map(j => ({
      ...j,
      skills_required: extractSkillsFromText(j.title),
      deadline: null,
      source: 'puppeteer',
    }));
  } catch (err) {
    console.error('[SCRAPE] Puppeteer error:', err.message);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────
// Deduplication — remove duplicate title+company pairs
// ──────────────────────────────────────────────────────────────
function deduplicate(listings) {
  const seen = new Set();
  return listings.filter(l => {
    const key = `${l.title?.toLowerCase()}|${l.company?.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ──────────────────────────────────────────────────────────────
// Insert listings into Supabase (skip duplicates via upsert strategy)
// ──────────────────────────────────────────────────────────────
async function saveListings(listings) {
  if (!listings || listings.length === 0) return [];

  const unique = deduplicate(listings);
  const saved = [];

  for (const listing of unique) {
    try {
      const { data, error } = await supabaseAdmin
        .from('listings')
        .insert({
          title:           listing.title || 'Untitled',
          company:         listing.company || 'Unknown',
          location:        listing.location || 'India',
          url:             listing.url || null,
          skills_required: listing.skills_required || [],
          deadline:        listing.deadline || null,
          source:          listing.source || 'scraper',
        })
        .select()
        .single();

      // Ignore unique-constraint errors (duplicate row — that's fine)
      if (!error) saved.push(data);
    } catch (err) {
      // Swallow per-row errors — log and continue
      console.error('[SCRAPE] Insert error:', err.message);
    }
  }

  return saved;
}

// ──────────────────────────────────────────────────────────────
// POST /api/scrape
// Runs one or more scraping strategies and saves results.
// Body: { strategy: 'auto' | 'puppeteer' | 'unstop' | 'internshala' | 'naukri', keyword? }
// ──────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { strategy = 'auto', keyword = 'software intern' } = req.body;
  let listings = [];
  const strategiesUsed = [];

  try {
    if (strategy === 'puppeteer') {
      listings = await scrapePuppeteer(keyword);
      strategiesUsed.push('puppeteer');
    } else if (strategy === 'unstop') {
      listings = await scrapeUnstop(keyword);
      strategiesUsed.push('unstop');
    } else if (strategy === 'internshala') {
      listings = await scrapeInternshala(keyword);
      strategiesUsed.push('internshala');
    } else if (strategy === 'naukri') {
      listings = await scrapeNaukri(keyword);
      strategiesUsed.push('naukri');
    } else {
      // strategy === 'auto' — try all
      if (process.env.RAPIDAPI_KEY) {
        const r = await scrapeRapidAPILinkedIn(keyword);
        if (r.length) { listings.push(...r); strategiesUsed.push('rapidapi'); }
      }

      const u = await scrapeUnstop(keyword);
      if (u.length) { listings.push(...u); strategiesUsed.push('unstop'); }

      const i = await scrapeInternshala(keyword);
      if (i.length) { listings.push(...i); strategiesUsed.push('internshala'); }
    }

    const saved = await saveListings(listings);
    console.log(`[SCRAPE] Saved ${saved.length} listings via [${strategiesUsed.join(', ')}]`);

    res.json({
      success:       true,
      total:         saved.length,
      strategies:    strategiesUsed,
      listings:      saved,
    });
  } catch (err) {
    console.error('[SCRAPE] Fatal error:', err.message);
    res.json({
      success:    false,
      total:      0,
      strategies: ['error'],
      listings:   [],
      error:      err.message
    });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /api/scrape/strategies
// Shows which scraping strategies are available based on env vars
// ──────────────────────────────────────────────────────────────
router.get('/strategies', (_, res) => {
  res.json({
    strategies: {
      rapidapi:    { available: !!process.env.RAPIDAPI_KEY,       description: 'LinkedIn via RapidAPI (100 req/month free)' },
      unstop:      { available: true,                              description: 'Unstop public API (no key needed)' },
      internshala: { available: true,                              description: 'Internshala cheerio scraper' },
      naukri:      { available: true,                              description: 'Naukri JSON API scraper' },
      wellfound:   { available: true,                              description: 'Wellfound startup internships' },
      puppeteer:   { available: true,                              description: 'Puppeteer headless (demo only, slow)' },
      mock:        { available: true,                              description: '20 hardcoded listings — always works' },
    },
  });
});

export default router;
