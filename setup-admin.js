require('dotenv').config();
const bcrypt = require('bcrypt');
const supabase = require('./src/db/supabaseClient');

// Admin credentials
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@hypex.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function setupAdmin() {
  try {
    // Check if admin exists
    const { data: existing } = await supabase
      .from('users')
      .select()
      .eq('email', ADMIN_EMAIL)
      .single();

    if (existing) {
      // Update to admin role if not already
      if (existing.role !== 'admin') {
        await supabase
          .from('users')
          .update({ role: 'admin' })
          .eq('id', existing.id);
        console.log('Existing user upgraded to admin:', ADMIN_EMAIL);
      } else {
        console.log('Admin already exists:', ADMIN_EMAIL);
      }
      return;
    }

    // Create new admin user
    const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const { data, error } = await supabase
      .from('users')
      .insert([{
        email: ADMIN_EMAIL,
        password_hash: hashed,
        name: 'Admin',
        role: 'admin'
      }])
      .select()
      .single();

    if (error) throw error;
    console.log('Admin user created:', ADMIN_EMAIL);
    console.log('Please login with these credentials:');
    console.log('Email:', ADMIN_EMAIL);
    console.log('Password:', ADMIN_PASSWORD);

  } catch (err) {
    console.error('Error setting up admin:', err.message);
    process.exit(1);
  }
}

setupAdmin();