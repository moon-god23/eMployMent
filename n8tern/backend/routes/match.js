import express from 'express';
import Groq from 'groq-sdk';
import twilio from 'twilio';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

// Lazy-init Groq and Twilio so missing keys don't crash startup
const getGroq = () => new Groq({ apiKey: process.env.GROQ_API_KEY });
const getTwilio = () =>
  twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * scoreStudentForListing
 * Calls Groq llama3-70b-8192 to score how well a student matches a listing.
 * Returns { score: number, reason: string }
 */
async function scoreStudentForListing(student, listing) {
  try {
    if (!process.env.GROQ_API_KEY) throw new Error('No Groq API key');
    
    const groq = getGroq();
    const prompt = `
You are an AI recruiter. Score how well this B.Tech student matches this internship listing.
Respond ONLY with valid JSON, no markdown fences, no explanation:
{"score": <integer 0-100>, "reason": "<one sentence>"}

Student:
- Name: ${student.name}
- Branch: ${student.branch || 'Not specified'}
- CGPA: ${student.cgpa || 'Not specified'}
- Skills: ${(student.skills || []).join(', ') || 'None listed'}
- Preferred Roles: ${(student.preferred_roles || []).join(', ') || 'None listed'}

Listing:
- Title: ${listing.title}
- Company: ${listing.company}
- Skills Required: ${(listing.skills_required || []).join(', ') || 'Not specified'}
`.trim();

    const completion = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 150,
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error(`[MATCH] Groq failing or missing key. Using basic heuristics for ${student.name}.`, err.message);
    
    // Fallback heuristic scoring
    const sSkills = (student.skills || []).map(s => s.toLowerCase());
    const lSkills = (listing.skills_required || []).map(s => s.toLowerCase());
    
    let matchCount = 0;
    for (const ls of lSkills) {
      if (sSkills.some(ss => ss.includes(ls) || ls.includes(ss))) matchCount++;
    }
    
    let score = 30; // base score
    if (lSkills.length > 0) {
      score += Math.round((matchCount / lSkills.length) * 60);
    } else {
      score = 50; // no skills listed means generic match
    }
    
    // Boost if role title matches preferred roles
    const titleLower = (listing.title || '').toLowerCase();
    const prefMatch = (student.preferred_roles || []).some(r => titleLower.includes(r.toLowerCase()));
    if (prefMatch) score = Math.min(100, score + 15);
    
    return {
      score,
      reason: matchCount > 0 
        ? `Matched ${matchCount} overlap skills (${Math.min(100, score)}% synergy)` 
        : "Matches based on general technical background via local heuristics."
    };
  }
}

/**
 * sendWhatsAppAlert — sends a WhatsApp notification via Twilio sandbox
 */
async function sendWhatsAppAlert(student, listing, score, reason) {
  try {
    const client = getTwilio();
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${student.whatsapp}`,
      body:
        `🎯 n8tern Match Alert!\n\n` +
        `*${listing.title}* at *${listing.company}*\n` +
        `Match Score: *${score}%*\n` +
        `Why: ${reason}\n\n` +
        `Apply: ${listing.url || 'Check the n8tern app'}`,
    });
    console.log(`[TWILIO] Sent alert to ${student.whatsapp} — score ${score}`);
  } catch (err) {
    console.error(`[TWILIO] Failed for ${student.whatsapp}:`, err.message);
  }
}

/**
 * runMatchingInBackground
 * Processes Groq scoring for each student and upserts results into applications table.
 * High scores (>70) trigger a WhatsApp alert.
 * Processes asynchronously after the HTTP response is sent.
 */
async function runMatchingInBackground(listing, students) {
  for (const student of students) {
    try {
      const { score, reason } = await scoreStudentForListing(student, listing);

      // Upsert into applications — match_score lives here, not on listings
      const { error } = await supabaseAdmin
        .from('applications')
        .upsert(
          {
            student_id: student.id,
            listing_id: listing.id,
            match_score: score,
            match_reason: reason,
            status: 'saved',
          },
          { onConflict: 'student_id,listing_id' }
        );

      if (error) {
        console.error(`[MATCH] Upsert failed for ${student.name}:`, error.message);
        continue;
      }

      console.log(`[MATCH] ${student.name} × ${listing.title}: ${score}%`);

      // Send WhatsApp alert only for high matches
      if (score > 70) {
        await sendWhatsAppAlert(student, listing, score, reason);
      }
    } catch (err) {
      // Don't crash the whole batch if one student fails
      console.error(`[MATCH] Error for student ${student.name}:`, err.message);
    }
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/match
// Triggers Groq AI matching for all students against a listing.
// Body: { listing_id } — fetch listing from DB
//    OR { listing }    — inline listing object (from ingest route)
//    OR { listing_id, student_id } — match one student only
// Query: ?sync=true — return the exact score and reason immediately (used by n8n)
// ──────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { listing_id, listing: inlineListing, student_id } = req.body;
    const isSync = req.query.sync === 'true';

    let listing = inlineListing;

    // Fetch listing from DB if ID provided
    if (listing_id && !listing) {
      const { data, error } = await supabaseAdmin
        .from('listings')
        .select('*')
        .eq('id', listing_id)
        .single();
      if (error) return res.status(404).json({ error: 'Listing not found' });
      listing = data;
    }

    if (!listing) {
      return res.status(400).json({ error: 'Provide listing_id or listing object' });
    }

    // Fetch students — all or just one
    let studentsQuery = supabaseAdmin.from('students').select('*');
    if (student_id) studentsQuery = studentsQuery.eq('id', student_id);
    const { data: students, error: studentsError } = await studentsQuery;

    if (studentsError) throw studentsError;
    if (!students || students.length === 0) {
      return res.json({ success: true, message: 'No students to match', matched: 0 });
    }

    // If sync=true AND dealing with exactly one student, process it directly and return the score
    if (isSync && students.length === 1) {
      const student = students[0];
      const matchResult = await scoreStudentForListing(student, listing);
      
      // Upsert the application record so it shows up in Tracker
      await supabaseAdmin.from('applications').upsert(
        { student_id: student.id, listing_id: listing.id, match_score: matchResult.score, match_reason: matchResult.reason, status: 'saved' },
        { onConflict: 'student_id,listing_id' }
      );

      return res.json({ success: true, match: matchResult });
    }

    // Default: Respond first — then process async. Prevents UI/Render timeouts for big batches.
    res.json({ success: true, message: 'Matching triggered', students: students.length });

    // Process in background (fire and forget)
    runMatchingInBackground(listing, students).catch(err =>
      console.error('[MATCH] Background error:', err.message)
    );
  } catch (err) {
    console.error('[MATCH] POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
