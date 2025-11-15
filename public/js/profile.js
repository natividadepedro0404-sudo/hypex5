document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('hypex_token');
  const userSpan = document.getElementById('user-name');
  const emailSpan = document.getElementById('user-email');
  const ordersList = document.getElementById('orders-list');
  const logoutBtn = document.getElementById('logout-btn');

  if (!token) {
    window.location.href = '/pages/auth.html?redirect=/pages/profile.html';
    return;
  }

  // Load profile info from localStorage first
  try {
    const user = JSON.parse(localStorage.getItem('hypex_user') || 'null');
    if (user) {
      userSpan.textContent = user.name || '-';
      emailSpan.textContent = user.email || '-';
    }
  } catch (e) {}

  // Fetch latest profile
  fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` }})
    .then(r => r.json())
    .then(data => {
      if (data.user) {
        userSpan.textContent = data.user.name || '-';
        emailSpan.textContent = data.user.email || '-';
        localStorage.setItem('hypex_user', JSON.stringify(data.user));
      }
    }).catch(console.error);

  // Load user orders
  function loadOrders() {
    ordersList.innerHTML = '<p>Carregando pedidos...</p>';
    fetch('/api/orders/mine', { headers: { Authorization: `Bearer ${token}` }})
      .then(r => r.json())
      .then(data => {
        if (!data.orders || !data.orders.length) {
          ordersList.innerHTML = '<p>Você ainda não fez pedidos.</p>';
          return;
        }

        ordersList.innerHTML = '';
        data.orders.forEach(o => {
          const el = document.createElement('div');
          el.className = 'order-card';
          el.innerHTML = `
            <h4>Pedido #${o.id} — <small>${o.status}</small></h4>
            <div><strong>Total:</strong> R$ ${Number(o.total).toFixed(2)}</div>
            <div><strong>Criado:</strong> ${new Date(o.created_at).toLocaleString()}</div>
            <div class="order-items">${(o.items||[]).map(i => `
              <div class="order-item">
                ${i.image ? `<img src="${i.image}" alt="${i.name}" class="order-item-image">` : ''}
                <div class="order-item-details">
                  <div>${i.qty}x ${i.name}</div>
                  <div>R$ ${Number(i.price).toFixed(2)} cada</div>
                  <div><strong>Total: R$ ${(i.qty * i.price).toFixed(2)}</strong></div>
                </div>
              </div>
            `).join('')}</div>
          `;
          ordersList.appendChild(el);
        });
      }).catch(err => {
        ordersList.innerHTML = '<p>Erro ao carregar pedidos.</p>';
        console.error(err);
      });
  }

  loadOrders();

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('hypex_token');
    localStorage.removeItem('hypex_user');
    window.location.href = '/';
  });
});