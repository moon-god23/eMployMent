import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * POST /api/students
 * Create or update student profile. Upserts on whatsapp field to avoid duplicates.
 * Body: { name, whatsapp, branch, cgpa, skills (string|array), preferred_roles (string|array) }
 */
router.post('/', async (req, res) => {
  try {
    let { name, whatsapp, branch, cgpa, skills, preferred_roles } = req.body;

    if (!name || !whatsapp) {
      return res.status(400).json({ error: 'name and whatsapp are required' });
    }

    // Normalise phone: prepend + if missing
    if (!whatsapp.startsWith('+')) whatsapp = '+' + whatsapp;

    // Normalise skills and preferred_roles — accept comma string or array
    const toArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(s => s.trim()).filter(Boolean);
      return val.split(',').map(s => s.trim()).filter(Boolean);
    };

    const payload = {
      name,
      whatsapp,
      branch: branch || null,
      cgpa: cgpa ? parseFloat(cgpa) : null,
      skills: toArray(skills),
      preferred_roles: toArray(preferred_roles),
    };

    const { data, error } = await supabaseAdmin
      .from('students')
      .upsert(payload, { onConflict: 'whatsapp' })
      .select()
      .single();

    if (error) throw error;

    console.log(`[STUDENT] Upserted: ${data.name} (${data.whatsapp})`);
    res.status(201).json({ success: true, student: data });
  } catch (err) {
    console.error('[STUDENT] POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/students
 * List all students ordered by creation date.
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ students: data });
  } catch (err) {
    console.error('[STUDENT] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
