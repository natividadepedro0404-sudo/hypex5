const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../db/supabaseClient');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

// Register
router.post('/register', async (req, res) => {
  const { email, password, name, address } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const { data, error } = await supabase.from('users').insert([{ email, password_hash: hashed, name, address, role: 'customer' }]).select().single();
    if (error) return res.status(400).json({ error: error.message });
    const token = jwt.sign({ id: data.id, email: data.email, role: data.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: data.id, email: data.email, name: data.name, address: data.address }, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  try {
    const { data, error } = await supabase.from('users').select().eq('email', email).single();
    if (error || !data) return res.status(400).json({ error: 'Credenciais inválidas' });
    const ok = await bcrypt.compare(password, data.password_hash);
    if (!ok) return res.status(400).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign({ id: data.id, email: data.email, role: data.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: data.id, email: data.email, name: data.name, address: data.address }, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;