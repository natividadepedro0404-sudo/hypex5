// user.js - manage header behavior based on login state
document.addEventListener('DOMContentLoaded', () => {
  const userEntry = document.getElementById('user-entry');
  const token = localStorage.getItem('hypex_token');
  const userJson = localStorage.getItem('hypex_user');
  let user = null;
  try { user = userJson ? JSON.parse(userJson) : null; } catch(e) { user = null; }

  if (user && userEntry) {
    userEntry.href = '/pages/profile.html';
    userEntry.innerHTML = '<i class="fas fa-user"></i> Perfil';

    // If admin, add admin link
    if (user.role === 'admin') {
      const nav = userEntry.closest('.user-nav');
      if (nav && !document.getElementById('admin-link')) {
        const a = document.createElement('a');
        a.id = 'admin-link';
        a.className = 'nav-link';
        a.href = '/pages/admin.html';
        a.innerHTML = '<i class="fas fa-tools"></i> Painel';
        nav.insertBefore(a, nav.children[1]);
      }
    }
  }

  // Update cart-count initial (if app.js not loaded yet)
  const cartCountEls = document.querySelectorAll('.cart-count');
  const cart = JSON.parse(localStorage.getItem('hypex_cart') || '[]');
  cartCountEls.forEach(el => el.textContent = cart.reduce((s,i) => s + (i.qty||0), 0));

  // If not logged, ensure link points to auth page
  if (!user && userEntry) {
    userEntry.href = '/pages/auth.html';
    userEntry.innerHTML = '<i class="fas fa-user"></i> Entrar';
  }
});
