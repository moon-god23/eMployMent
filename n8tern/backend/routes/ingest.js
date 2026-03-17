import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * POST /api/ingest-listing
 * Webhook receiver for n8n Cloud workflows.
 * Accepts a scraped listing, saves it to DB, then asynchronously triggers AI matching.
 *
 * Security: Validates x-n8n-secret header to prevent unauthorized posts.
 * Body: { title, company, url, skills_required, deadline, source }
 */
router.post('/', async (req, res) => {
  // Validate shared secret header
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret && req.headers['x-n8n-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorised — invalid x-n8n-secret header' });
  }

  try {
    let { title, company, url, skills_required, deadline, source } = req.body;

    if (!title || !company) {
      return res.status(400).json({ error: 'title and company are required' });
    }

    // Normalise skills_required to array
    const toArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(s => s.trim()).filter(Boolean);
      return String(val).split(',').map(s => s.trim()).filter(Boolean);
    };

    const { data: listing, error } = await supabaseAdmin
      .from('listings')
      .insert({
        title,
        company,
        url: url || null,
        skills_required: toArray(skills_required),
        deadline: deadline || null,
        source: source || 'n8n',
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[INGEST] Saved: ${listing.title} @ ${listing.company} (${listing.source})`);

    // Respond 201 immediately — n8n Cloud has a tight timeout
    res.status(201).json({ success: true, listing_id: listing.id });

    // Fire match async — don't await, don't block the response
    const baseURL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
    fetch(`${baseURL}/api/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing }),
    }).catch(err => console.error('[INGEST] Match trigger failed:', err.message));
  } catch (err) {
    console.error('[INGEST] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
