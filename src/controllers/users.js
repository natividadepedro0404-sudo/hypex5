const express = require('express');
const supabase = require('../db/supabaseClient');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Get current user
router.get('/me', authRequired, async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('id, email, name, address, role').eq('id', req.user.id).single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update current user's profile (name, address)
router.put('/me', authRequired, async (req, res) => {
  try {
    const { name, address } = req.body;
    const updates = {};
    if (typeof name !== 'undefined') updates.name = name;
    if (typeof address !== 'undefined') updates.address = address;

    const { data, error } = await supabase.from('users').update(updates).eq('id', req.user.id).select('id, email, name, address').single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
