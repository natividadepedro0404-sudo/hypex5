const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('Supabase variables not set. Some features will fail until configured.');
} else {
  console.log('Supabase configured with URL:', SUPABASE_URL);
  console.log('Supabase key type:', SUPABASE_KEY.includes('eyJ') ? (SUPABASE_KEY.length > 200 ? 'Service Role Key (correct!)' : 'Anon Key') : 'Invalid key');
  console.log('Key length:', SUPABASE_KEY.length, 'characters');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase;