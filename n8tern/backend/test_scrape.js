import axios from 'axios';
import * as cheerio from 'cheerio';

const SKILLS = [ 'React','Vue','Angular','Node.js','Python','Java','TypeScript', 'JavaScript','SQL','PostgreSQL','MongoDB','Redis','Docker' ];
function extractSkills(text) { return SKILLS.filter(s => text.toLowerCase().includes(s.toLowerCase())); }

async function scrapeUnstop() {
  const { data } = await axios.get('https://unstop.com/api/public/opportunity/search-result', {
    params: { opportunity: 'jobs', keyword: 'software intern', page: 0, per_page: 5 },
    headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000,
  });
  return (data?.data?.data || []).map(i => ({ title: i.title, company: i.organisation?.name }));
}

async function scrapeInternshala() {
  const { data: html } = await axios.get('https://internshala.com/internships/keywords-software', {
    headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000,
  });
  const $ = cheerio.load(html);
  const listings = [];
  $('.individual_internship').each((_, el) => {
    listings.push({ title: $(el).find('.profile').text().trim(), company: $(el).find('.company-name').text().trim() });
  });
  return listings;
}

async function run() {
  console.log("Unstop:", await scrapeUnstop().catch(e => "Error: " + e.message));
  console.log("Internshala:", await scrapeInternshala().catch(e => "Error: " + e.message));
}
run();
