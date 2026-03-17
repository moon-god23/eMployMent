import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/applications
 * List all applications, optionally filtered by student_id.
 * Joins listing and student data.
 * Query: ?student_id=uuid
 */
router.get('/', async (req, res) => {
  try {
    const { student_id } = req.query;

    let query = supabaseAdmin
      .from('applications')
      .select(`
        *,
        listings ( id, title, company, url, skills_required, deadline, source ),
        students ( id, name, whatsapp )
      `)
      .order('applied_at', { ascending: false });

    if (student_id) {
      query = query.eq('student_id', student_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ applications: data });
  } catch (err) {
    console.error('[APPLICATIONS] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/applications
 * Save a listing for a student (creates an application in 'saved' status).
 * Body: { student_id, listing_id }
 */
router.post('/', async (req, res) => {
  try {
    const { student_id, listing_id } = req.body;

    if (!student_id || !listing_id) {
      return res.status(400).json({ error: 'student_id and listing_id are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('applications')
      .upsert(
        { student_id, listing_id, status: 'saved' },
        { onConflict: 'student_id,listing_id' }
      )
      .select()
      .single();

    if (error) throw error;

    console.log(`[APPLICATIONS] Saved listing ${listing_id} for student ${student_id}`);
    res.status(201).json({ success: true, application: data });
  } catch (err) {
    console.error('[APPLICATIONS] POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/applications/:id
 * Update the Kanban status of an application.
 * Body: { status: 'saved' | 'applied' | 'interview' | 'offer' }
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['saved', 'applied', 'interview', 'offer'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const { data, error } = await supabaseAdmin
      .from('applications')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Application not found' });

    console.log(`[APPLICATIONS] Updated ${id} → ${status}`);
    res.json({ success: true, application: data });
  } catch (err) {
    console.error('[APPLICATIONS] PUT error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/applications/clear
 * Bulk delete all applications for a given student.
 * Query: ?student_id=uuid
 */
router.delete('/clear', async (req, res) => {
  try {
    const { student_id } = req.query;
    if (!student_id) {
      return res.status(400).json({ error: 'student_id is required' });
    }

    const { error } = await supabaseAdmin
      .from('applications')
      .eq('student_id', student_id)
      .delete();

    if (error) throw error;

    console.log(`[APPLICATIONS] Cleared all applications for student ${student_id}`);
    res.json({ success: true, message: 'All saved applications cleared.' });
  } catch (err) {
    console.error('[APPLICATIONS] DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
