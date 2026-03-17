import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/listings
 * Returns all listings. Query filters:
 *   ?skills=React,Node.js  → overlaps filter
 *   ?source=unstop          → exact match
 *   ?min_score=50           → for use with joined application data
 */
router.get('/', async (req, res) => {
  try {
    const { skills, source } = req.query;

    let query = supabaseAdmin
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false });

    if (source) {
      query = query.eq('source', source);
    }

    if (skills) {
      const skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);
      // overlaps: returns rows where skills_required contains any of the given skills
      query = query.overlaps('skills_required', skillsArray);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ listings: data });
  } catch (err) {
    console.error('[LISTINGS] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/listings
 * Manually add a listing.
 * Body: { title, company, url, skills_required (string|array), deadline, source }
 */
router.post('/', async (req, res) => {
  try {
    let { title, company, url, skills_required, deadline, source } = req.body;

    if (!title || !company) {
      return res.status(400).json({ error: 'title and company are required' });
    }

    const toArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(s => s.trim()).filter(Boolean);
      return val.split(',').map(s => s.trim()).filter(Boolean);
    };

    const { data, error } = await supabaseAdmin
      .from('listings')
      .insert({
        title,
        company,
        url: url || null,
        skills_required: toArray(skills_required),
        deadline: deadline || null,
        source: source || 'manual',
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[LISTINGS] Added: ${data.title} @ ${data.company}`);
    res.status(201).json({ success: true, listing: data });
  } catch (err) {
    console.error('[LISTINGS] POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
