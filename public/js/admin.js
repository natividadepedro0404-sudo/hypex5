document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('hypex_token');
  const user = JSON.parse(localStorage.getItem('hypex_user') || '{}');

  if (!token || user.role !== 'admin') {
    document.querySelectorAll('.admin-section').forEach(section => {
      section.innerHTML = '<p>Você precisa estar logado como admin para acessar esta área.</p>';
    });
    return;
  }

  // Nav Tabs
  document.querySelectorAll('.admin-nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-section');
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.admin-nav-link').forEach(l => l.classList.remove('active'));
      document.getElementById(section).classList.add('active');
      link.classList.add('active');
    });
  });

  // Load Orders
  const ordersList = document.getElementById('orders-list');
  fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` }})
    .then(r => r.json())
    .then(data => {
      if (!data.orders) {
        ordersList.innerHTML = '<p>Sem pedidos ou acesso negado.</p>';
        return;
      }

      // Organizar pedidos por status
      const ordersByStatus = {
        'pedido feito': [],
        'em separacao': [],
        'enviado': [],
        'entregue': [],
        'outros': []
      };

      data.orders.forEach(o => {
        const status = o.status || 'pedido feito';
        if (ordersByStatus[status]) {
          ordersByStatus[status].push(o);
        } else {
          ordersByStatus['outros'].push(o);
        }
      });

      // Ordem de exibição: pedido feito primeiro (destacado), depois os outros
      const statusOrder = ['pedido feito', 'em separacao', 'enviado', 'entregue', 'outros'];
      const statusLabels = {
        'pedido feito': 'Pedidos Feitos',
        'em separacao': 'Em Separação',
        'enviado': 'Enviados',
        'entregue': 'Entregues',
        'outros': 'Outros Status'
      };

      ordersList.innerHTML = '';

      // Renderizar pedidos agrupados por status
      statusOrder.forEach(status => {
        const orders = ordersByStatus[status];
        if (orders.length === 0) return;

        // Criar seção de status
        const statusSection = document.createElement('div');
        statusSection.className = 'orders-status-section';
        if (status === 'pedido feito') {
          statusSection.classList.add('status-highlighted');
        }

        const statusTitle = document.createElement('h4');
        statusTitle.className = 'status-section-title';
        statusTitle.textContent = `${statusLabels[status]} (${orders.length})`;
        statusSection.appendChild(statusTitle);

        const statusContainer = document.createElement('div');
        statusContainer.className = 'status-orders-container';
        statusSection.appendChild(statusContainer);

        orders.forEach(o => {
  const el = document.createElement('div');
  el.className = 'order-card';
  // Destacar pedidos com status "pedido feito"
  if ((o.status || 'pedido feito') === 'pedido feito') {
    el.classList.add('order-highlighted');
  }

  // Monta HTML dos itens (usa name se existir, senão mostra product_id)
  const itemsHtml = (Array.isArray(o.items) ? o.items : []).map(i => {
    const prodName = i.name || i.product_id || 'Produto';
    const qty = Number(i.qty || 1);
    const price = Number(i.price || 0);
    return `<li>${prodName} — ${qty} x R$ ${price.toFixed(2)} <small>(subtotal R$ ${(qty * price).toFixed(2)})</small></li>`;
  }).join('');

  // Formatar endereço do pedido ou do usuário
  function formatAddress(address) {
    if (!address) return '<em class="text-muted">— sem endereço cadastrado —</em>';
    
    // Se for string, retornar como está (pode ser endereço simples)
    if (typeof address === 'string') {
      return address.trim() || '<em class="text-muted">— endereço vazio —</em>';
    }
    
    // Se for objeto, formatar de forma estruturada
    if (typeof address === 'object') {
      const parts = [];
      
      // Verificar se é o novo formato com firstName, lastName, etc.
      if (address.firstName || address.lastName) {
        // Formato novo com dados completos
        const fullName = [address.firstName, address.lastName].filter(Boolean).join(' ');
        if (fullName) parts.push(`<strong>${fullName}</strong>`);
        
        // Endereço completo
        const streetAddress = [address.rua, address.numero].filter(Boolean).join(', ');
        if (streetAddress) parts.push(streetAddress);
        
        if (address.complemento) parts.push(address.complemento);
        
        const cityState = [address.cidade, address.estado].filter(Boolean).join(' - ');
        if (cityState) parts.push(cityState);
        
        if (address.cep) parts.push(`CEP: ${address.cep}`);
        
        // Contato
        if (address.telefone) parts.push(`📞 ${address.telefone}`);
        if (address.email) parts.push(`📧 ${address.email}`);
        
        return parts.join('<br>');
      }
      
      // Formato antigo (compatibilidade)
      // Rua e número
      if (address.street || address.rua) {
        const street = address.street || address.rua;
        const number = address.number || address.numero;
        if (number) {
          parts.push(`${street}, ${number}`);
        } else {
          parts.push(street);
        }
      }
      
      // Complemento
      if (address.complement || address.complemento) {
        parts.push(address.complement || address.complemento);
      }
      
      // Bairro
      if (address.neighborhood || address.bairro) {
        parts.push(address.neighborhood || address.bairro);
      }
      
      // Cidade e Estado
      if (address.city || address.cidade) {
        const city = address.city || address.cidade;
        const state = address.state || address.estado || address.uf;
        if (state) {
          parts.push(`${city} - ${state}`);
        } else {
          parts.push(city);
        }
      }
      
      // CEP
      if (address.zipcode || address.cep || address.zip) {
        const cep = address.zipcode || address.cep || address.zip;
        parts.push(`CEP: ${cep}`);
      }
      
      // Se não encontrou nenhum campo conhecido, tentar exibir como JSON formatado
      if (parts.length === 0) {
        // Tentar outros formatos possíveis
        if (address.address) {
          return formatAddress(address.address);
        }
        return '<em class="text-muted">— formato de endereço não reconhecido —</em>';
      }
      
      return parts.join(', ');
    }
    
    return '<em class="text-muted">— endereço inválido —</em>';
  }

  // Priorizar endereço do pedido, senão usar do usuário
  const deliveryAddress = o.address || o.user_address;
  const formattedAddress = formatAddress(deliveryAddress);

  el.innerHTML = `
    <div class="order-header">
      <h4>Pedido #${o.id.substring(0, 8)}... — <small>${o.status}</small></h4>
      <div class="order-meta">
        <div><strong>Cliente:</strong> ${o.user_name || 'Usuário'} ${o.user_email ? `(${o.user_email})` : ''}</div>
        <div><strong>Total:</strong> R$ ${Number(o.total || 0).toFixed(2)}</div>
        <div><strong>Data:</strong> ${new Date(o.created_at).toLocaleString('pt-BR')}</div>
      </div>
    </div>

    <div class="order-address-section">
      <h5><i class="fas fa-map-marker-alt"></i> Endereço de Entrega</h5>
      <div class="address-display">${formattedAddress}</div>
    </div>

    <div class="order-items">
      <h5><i class="fas fa-shopping-bag"></i> Itens do Pedido</h5>
      <ul>
        ${itemsHtml || '<li>(nenhum item)</li>'}
      </ul>
    </div>

    <div class="admin-actions">
      <select data-order-id="${o.id}" class="status-select">
        <option value="pedido feito">Pedido feito</option>
        <option value="em separacao">Em separação</option>
        <option value="enviado">Enviado</option>
        <option value="entregue">Entregue</option>
      </select>
      <button data-order-id="${o.id}" class="save-status btn btn-outline">Salvar Status</button>
    </div>
  `;

  // setar o valor atual do select (pois as opções são estáticas)
  const statusSelect = el.querySelector('.status-select');
  if (statusSelect) statusSelect.value = o.status || 'pedido feito';

  statusContainer.appendChild(el);
        });

        ordersList.appendChild(statusSection);
      });

      // Set current statuses
      document.querySelectorAll('.status-select').forEach(sel => {
        const id = sel.getAttribute('data-order-id');
        const order = data.orders.find(x => String(x.id) === String(id));
        if (order) sel.value = order.status;
      });

      document.querySelectorAll('.save-status').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = btn.getAttribute('data-order-id');
          const sel = document.querySelector(`.status-select[data-order-id="${id}"]`);
          const status = sel.value;
          try {
            const res = await fetch(`/api/orders/${id}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ status })
            });
            const json = await res.json();
            if (res.ok) {
              alert('Status atualizado');
              // Recarregar pedidos para reorganizar por status
              location.reload();
            } else {
              throw new Error(json.error || 'Erro');
            }
          } catch (err) {
            alert(err.message);
          }
        });
      });
    }).catch(err => {
      ordersList.innerHTML = '<p>Erro ao carregar pedidos.</p>';
      console.error(err);
    });

  // Products Management
  const productModal = document.getElementById('product-modal');
  const productForm = document.getElementById('product-form');
  const addProductBtn = document.getElementById('add-product');
  const productsGrid = document.querySelector('#products-list .products-grid');
  let currentProduct = null;

  // Load Products
  async function loadProducts() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (!data.products) throw new Error('Sem produtos.');

      productsGrid.innerHTML = '';
      data.products.forEach(p => {
        const el = document.createElement('div');
        el.className = 'product-card';
        const img = p.image || (p.images && p.images.length ? p.images[0] : null) || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E';
        const sizesText = p.sizes && Array.isArray(p.sizes) && p.sizes.length > 0 
          ? p.sizes.join(', ') 
          : 'N/A';
        const typeText = p.type || 'N/A';
        const colorText = p.color || 'N/A';
        const brandText = p.brand || 'N/A';
        
        el.innerHTML = `
          <img src="${img}" alt="${p.name}">
          <div class="product-info">
            <h4>${p.name}</h4>
            <p>R$ ${Number(p.price).toFixed(2)}</p>
            <p><small>Em estoque: ${p.stock}</small></p>
            <p><small><strong>Marca:</strong> ${brandText} | <strong>Tipo:</strong> ${typeText} | <strong>Cor:</strong> ${colorText}</small></p>
            <p><small><strong>Tamanhos:</strong> ${sizesText}</small></p>
            <div class="admin-actions">
              <button class="btn btn-outline edit-product" data-id="${p.id}">Editar</button>
              <button class="btn btn-outline delete-product" data-id="${p.id}">Excluir</button>
            </div>
          </div>
        `;
        productsGrid.appendChild(el);

        // Edit button
        el.querySelector('.edit-product').addEventListener('click', () => editProduct(p));
        
        // Delete button
        el.querySelector('.delete-product').addEventListener('click', async () => {
          if (!confirm('Tem certeza que deseja excluir este produto?')) return;
          try {
            const res = await fetch(`/api/products/${p.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              el.remove();
              alert('Produto excluído com sucesso.');
            } else {
              throw new Error('Erro ao excluir produto.');
            }
          } catch (err) {
            alert(err.message);
          }
        });
      });
    } catch (err) {
      productsGrid.innerHTML = '<p>Erro ao carregar produtos.</p>';
      console.error(err);
    }
  }

  // Product Variations Functions
  let productVariations = [];

  function addVariation() {
    // Generate a temporary ID for new variations
    const variationId = 'new_' + Date.now().toString();
    const variation = {
      id: variationId, // Temporary ID for new variations
      name: '',
      color: '',
      size: '',
      price: '',
      stock: '',
      images: []
    };
    
    productVariations.push(variation);
    renderVariation(variation);
  }

  function removeVariation(variationId) {
    productVariations = productVariations.filter(v => v.id !== variationId);
    const variationElement = document.querySelector(`[data-variation-id="${variationId}"]`);
    if (variationElement) {
      variationElement.remove();
    }
  }

  function renderVariation(variation) {
    const container = document.getElementById('variations-container');
    const variationElement = document.createElement('div');
    variationElement.className = 'variation-item';
    variationElement.dataset.variationId = variation.id;
    variationElement.innerHTML = `
      <div style="border: 1px solid #ddd; border-radius: 4px; padding: 1rem; margin-bottom: 1rem; background: #f9f9f9;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <h5 style="margin: 0;">Variação</h5>
          <button type="button" class="btn btn-outline remove-variation" data-variation-id="${variation.id}" style="padding: 0.25rem 0.5rem; font-size: 0.875rem;">
            <i class="fas fa-trash"></i> Remover
          </button>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Nome da Variação</label>
            <input type="text" class="variation-name" data-variation-id="${variation.id}" value="${variation.name}" placeholder="Ex: Camisa Azul M">
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Cor</label>
            <input type="text" class="variation-color" data-variation-id="${variation.id}" value="${variation.color}" placeholder="Ex: Azul">
          </div>
          <div class="form-group">
            <label>Tamanho</label>
            <input type="text" class="variation-size" data-variation-id="${variation.id}" value="${variation.size}" placeholder="Ex: M">
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Preço (R$)</label>
            <input type="number" class="variation-price" data-variation-id="${variation.id}" value="${variation.price}" min="0" step="0.01" placeholder="Preço da variação">
          </div>
          <div class="form-group">
            <label>Estoque</label>
            <input type="number" class="variation-stock" data-variation-id="${variation.id}" value="${variation.stock}" min="0" placeholder="Quantidade em estoque">
          </div>
        </div>
        
        <div class="form-group">
          <label>Imagens da Variação</label>
          <input type="file" class="variation-images" data-variation-id="${variation.id}" multiple accept="image/*">
          <div class="variation-image-preview" data-variation-id="${variation.id}" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
            ${variation.images && Array.isArray(variation.images) ? variation.images.map(img => `
              <img src="${img}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">
            `).join('') : ''}
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(variationElement);
    
    // Add event listeners for the new variation
    variationElement.querySelector('.remove-variation').addEventListener('click', (e) => {
      const id = e.target.closest('.remove-variation').dataset.variationId;
      removeVariation(id);
    });
    
    // Add event listeners for input changes
    variationElement.querySelector('.variation-name').addEventListener('input', (e) => {
      const id = e.target.dataset.variationId;
      const variation = productVariations.find(v => v.id === id);
      if (variation) variation.name = e.target.value;
    });
    
    variationElement.querySelector('.variation-color').addEventListener('input', (e) => {
      const id = e.target.dataset.variationId;
      const variation = productVariations.find(v => v.id === id);
      if (variation) variation.color = e.target.value;
    });
    
    variationElement.querySelector('.variation-size').addEventListener('input', (e) => {
      const id = e.target.dataset.variationId;
      const variation = productVariations.find(v => v.id === id);
      if (variation) variation.size = e.target.value;
    });
    
    variationElement.querySelector('.variation-price').addEventListener('input', (e) => {
      const id = e.target.dataset.variationId;
      const variation = productVariations.find(v => v.id === id);
      if (variation) variation.price = e.target.value;
    });
    
    variationElement.querySelector('.variation-stock').addEventListener('input', (e) => {
      const id = e.target.dataset.variationId;
      const variation = productVariations.find(v => v.id === id);
      if (variation) variation.stock = e.target.value;
    });
    
    // Add event listener for image upload
    const imageInput = variationElement.querySelector('.variation-images');
    imageInput.addEventListener('change', (e) => {
      const id = e.target.dataset.variationId;
      const variation = productVariations.find(v => v.id === id);
      if (variation) {
        // Store the selected files in the variation object
        variation.imageFiles = e.target.files;
        
        // Preview the selected images
        const previewContainer = variationElement.querySelector(`.variation-image-preview[data-variation-id="${id}"]`);
        previewContainer.innerHTML = '';
        
        if (e.target.files.length > 0) {
          Array.from(e.target.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
              const img = document.createElement('img');
              img.src = event.target.result;
              img.style.width = '60px';
              img.style.height = '60px';
              img.style.objectFit = 'cover';
              img.style.borderRadius = '4px';
              previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
          });
        }
      }
    });
  }

  function clearVariations() {
    productVariations = [];
    document.getElementById('variations-container').innerHTML = '';
  }

  function loadVariationsForProduct(productId) {
    // Fetch existing variations from the API
    fetch(`/api/variations/product/${productId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.variations && Array.isArray(data.variations)) {
        // Clear existing variations
        clearVariations();
        
        // Add each variation to the UI
        data.variations.forEach(variation => {
          // Add to our variations array with the proper ID
          productVariations.push({
            id: variation.id,
            name: variation.name,
            color: variation.color || '',
            size: variation.size || '',
            price: variation.price || '',
            stock: variation.stock || '',
            images: variation.images || []
          });
          
          // Render the variation in the UI
          renderVariation({
            id: variation.id,
            name: variation.name,
            color: variation.color || '',
            size: variation.size || '',
            price: variation.price || '',
            stock: variation.stock || '',
            images: variation.images || []
          });
        });
      }
    })
    .catch(err => {
      console.error('Erro ao carregar variações:', err);
      // Clear variations on error
      clearVariations();
    });
  }

  // Função para atualizar contador de tamanhos e validar limite
  function updateSizesCounter() {
    const checkboxes = productForm.querySelectorAll('.size-checkbox');
    const checked = productForm.querySelectorAll('.size-checkbox:checked');
    const count = checked.length;
    const maxSizes = 9;
    
    const counter = document.getElementById('sizes-counter');
    const limitMessage = document.getElementById('sizes-limit-message');
    
    if (counter) {
      counter.textContent = `(${count}/${maxSizes} selecionados)`;
      if (count >= maxSizes) {
        counter.style.color = '#dc3545';
        counter.style.fontWeight = '600';
      } else {
        counter.style.color = '#666';
        counter.style.fontWeight = 'normal';
      }
    }
    
    if (limitMessage) {
      if (count >= maxSizes) {
        limitMessage.style.display = 'block';
      } else {
        limitMessage.style.display = 'none';
      }
    }
    
    // Desabilitar checkboxes não selecionados quando o limite for atingido
    checkboxes.forEach(cb => {
      if (count >= maxSizes && !cb.checked) {
        cb.disabled = true;
      } else {
        cb.disabled = false;
      }
    });
  }

  // Adicionar event listeners para os checkboxes de tamanhos
  // Usar delegação de eventos para garantir que funcione mesmo se os elementos forem recriados
  productForm.addEventListener('change', (e) => {
    if (e.target.classList.contains('size-checkbox')) {
      const checked = productForm.querySelectorAll('.size-checkbox:checked');
      const maxSizes = 9;
      
      // Se tentar marcar e já tiver 9 selecionados, desmarcar
      if (e.target.checked && checked.length > maxSizes) {
        e.target.checked = false;
        alert('Você pode selecionar no máximo 9 tamanhos.');
        updateSizesCounter(); // Atualizar contador mesmo após desmarcar
        return;
      }
      
      updateSizesCounter();
    }
  });

  // Atualizar contador quando o formulário for resetado
  productForm.addEventListener('reset', () => {
    setTimeout(() => updateSizesCounter(), 0); // Usar setTimeout para garantir que o reset aconteceu
  });

  // Inicializar contador ao carregar
  updateSizesCounter();

  // Open modal to add product
  addProductBtn.addEventListener('click', () => {
    currentProduct = null;
    productForm.reset();
    productForm.querySelector('[name=id]').value = '';
    productForm.querySelector('.image-preview').innerHTML = '';
    productForm.querySelector('[name=images]').value = ''; // Limpar input de imagens
    updateSizesCounter(); // Resetar contador
    clearVariations(); // Clear variations
    
    // Ensure modal can scroll
    const modalContent = productModal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.scrollTop = 0;
    }
    
    productModal.style.display = 'flex';
  });

  // Close modal
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      productModal.style.display = 'none';
    });
  });

  // Add variation button
  document.getElementById('add-variation').addEventListener('click', addVariation);

  // Edit product
  function editProduct(product) {
    currentProduct = product;
    productForm.querySelector('[name=id]').value = product.id;
    productForm.querySelector('[name=name]').value = product.name;
    productForm.querySelector('[name=description]').value = product.description;
    productForm.querySelector('[name=price]').value = product.price;
    productForm.querySelector('[name=stock]').value = product.stock;
    productForm.querySelector('[name=type]').value = product.type || '';
    productForm.querySelector('[name=color]').value = product.color || '';
    productForm.querySelector('[name=brand]').value = product.brand || '';

    // Limpar checkboxes de tamanhos
    productForm.querySelectorAll('[name=sizes]').forEach(cb => {
      cb.checked = false;
    });

    // Marcar tamanhos selecionados
    if (product.sizes && Array.isArray(product.sizes)) {
      product.sizes.forEach(size => {
        const checkbox = productForm.querySelector(`[name=sizes][value="${size}"]`);
        if (checkbox) checkbox.checked = true;
      });
    }

    // Atualizar contador de tamanhos após marcar
    updateSizesCounter();

    // Limpar input de arquivo e mostrar imagens existentes
    productForm.querySelector('[name=images]').value = '';
    const preview = productForm.querySelector('.image-preview');
    preview.innerHTML = '';
    if (product.images && product.images.length > 0) {
      preview.innerHTML += '<p style="margin-bottom: 0.5rem; font-size: 0.875rem; color: #666;"><strong>Imagens atuais:</strong></p>';
      product.images.forEach(img => {
        preview.innerHTML += `<img src="${img}" alt="Preview">`;
      });
      preview.innerHTML += '<p style="margin-top: 0.5rem; font-size: 0.875rem; color: #666;">Selecione novos arquivos para adicionar mais imagens ao produto.</p>';
    }

    // Load variations for this product
    loadVariationsForProduct(product.id);
    
    // Ensure modal can scroll
    const modalContent = productModal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.scrollTop = 0;
    }

    productModal.style.display = 'flex';
  }

  // Preview de imagens ao selecionar arquivos
  const imageInput = productForm.querySelector('[name=images]');
  const imagePreview = productForm.querySelector('.image-preview');
  
  imageInput.addEventListener('change', (e) => {
    const files = e.target.files;
    imagePreview.innerHTML = '';
    
    if (files.length > 0) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = document.createElement('img');
          img.src = event.target.result;
          img.style.width = '100px';
          img.style.height = '100px';
          img.style.objectFit = 'cover';
          img.style.borderRadius = '4px';
          imagePreview.appendChild(img);
        };
        reader.readAsDataURL(file);
      });
    }
  });

  // Function to handle variations creation/update
  async function handleVariations(productId) {
    // Create variations for the product
    for (const variation of productVariations) {
      // Check if this variation has image files to upload
      if (variation.imageFiles && variation.imageFiles.length > 0) {
        // Create FormData for this variation
        const variationFormData = new FormData();
        variationFormData.append('product_id', productId);
        variationFormData.append('name', variation.name);
        variationFormData.append('color', variation.color || '');
        variationFormData.append('size', variation.size || '');
        variationFormData.append('price', Number(variation.price || 0));
        variationFormData.append('stock', Number(variation.stock || 0));
        
        // Add image files
        for (let i = 0; i < variation.imageFiles.length; i++) {
          variationFormData.append('images', variation.imageFiles[i]);
        }
        
        if (variation.id && !variation.id.startsWith('new_')) {
          // Update existing variation with images
          const updateRes = await fetch(`/api/variations/${variation.id}`, {
            method: 'PUT',
            headers: { 
              Authorization: `Bearer ${token}` 
            },
            body: variationFormData
          });
          
          if (!updateRes.ok) {
            console.error('Erro ao atualizar variação:', await updateRes.json());
          }
        } else {
          // Create new variation with images
          const createRes = await fetch('/api/variations', {
            method: 'POST',
            headers: { 
              Authorization: `Bearer ${token}` 
            },
            body: variationFormData
          });
          
          if (!createRes.ok) {
            console.error('Erro ao criar variação:', await createRes.json());
          }
        }
      } else {
        // No images to upload, use JSON
        const variationData = {
          product_id: productId,
          name: variation.name,
          color: variation.color || '',
          size: variation.size || '',
          price: Number(variation.price || 0),
          stock: Number(variation.stock || 0)
        };
        
        if (variation.id && !variation.id.startsWith('new_')) {
          // Update existing variation
          const updateRes = await fetch(`/api/variations/${variation.id}`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify(variationData)
          });
          
          if (!updateRes.ok) {
            console.error('Erro ao atualizar variação:', await updateRes.json());
          }
        } else {
          // Create new variation
          const createRes = await fetch('/api/variations', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify(variationData)
          });
          
          if (!createRes.ok) {
            console.error('Erro ao criar variação:', await createRes.json());
          }
        }
      }
    }
  }

  // Handle form submit
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(productForm);
    const id = formData.get('id');
    const isEdit = id && currentProduct;

    // Processar tamanhos selecionados
    const selectedSizes = [];
    productForm.querySelectorAll('[name=sizes]:checked').forEach(cb => {
      selectedSizes.push(cb.value);
    });

    // Validar limite de tamanhos antes de enviar
    if (selectedSizes.length > 9) {
      alert('Você pode selecionar no máximo 9 tamanhos. Por favor, desmarque alguns tamanhos.');
      return;
    }

    try {
      // Verificar se há novas imagens sendo enviadas
      const imageFiles = imageInput.files;
      const hasNewImages = imageFiles && imageFiles.length > 0;

      // Prepare product data
      const productData = {
        name: formData.get('name'),
        description: formData.get('description'),
        price: Number(formData.get('price') || 0),
        stock: Number(formData.get('stock') || 0),
        type: formData.get('type') || null,
        color: formData.get('color') || null,
        brand: formData.get('brand') || null,
        sizes: selectedSizes.length > 0 ? selectedSizes : []
      };

      // Handle main product images upload
      if (hasNewImages) {
        // Create a new FormData object to handle file uploads
        const productFormData = new FormData();
        
        // Add all the product data fields
        Object.keys(productData).forEach(key => {
          if (key === 'sizes') {
            // Handle array field
            productData[key].forEach(size => {
              productFormData.append('sizes', size);
            });
          } else {
            productFormData.append(key, productData[key]);
          }
        });
        
        // Add image files
        for (let i = 0; i < imageFiles.length; i++) {
          productFormData.append('images', imageFiles[i]);
        }
        
        if (isEdit) {
          // Update existing product with images
          const res = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 
              Authorization: `Bearer ${token}` 
            },
            body: productFormData
          });
          
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Erro ao salvar produto.');
          }
          
          // Handle variations for the existing product
          await handleVariations(id);
        } else {
          // Create new product with images
          const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 
              Authorization: `Bearer ${token}` 
            },
            body: productFormData
          });
          
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Erro ao criar produto.');
          }
          
          const productResult = await res.json();
          const productId = productResult.product.id;
          
          // Handle variations for the new product
          await handleVariations(productId);
        }
      } else {
        // No images to upload, use JSON
        if (isEdit) {
          // Update existing product without images
          const res = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify(productData)
          });
          
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Erro ao salvar produto.');
          }
          
          // Handle variations for the existing product
          await handleVariations(id);
        } else {
          // Create new product without images
          const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify(productData)
          });
          
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Erro ao criar produto.');
          }
          
          const productResult = await res.json();
          const productId = productResult.product.id;
          
          // Handle variations for the new product
          await handleVariations(productId);
        }
      }
      
      productModal.style.display = 'none';
      loadProducts();
      if (isEdit) {
        alert('Produto atualizado com sucesso!');
      } else {
        alert('Produto criado com sucesso!');
      }
    } catch (err) {
      alert(err.message);
    }
  });

  // Coupons Management
  const couponsList = document.getElementById('coupons-list');

  async function loadCoupons() {
    try {
      const res = await fetch('/api/coupons', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const coupons = data.coupons || [];

      // Sempre mostrar o botão de adicionar cupom
      couponsList.innerHTML = `
        <div class="section-header">
          <button class="btn btn-primary" id="add-coupon">
            <i class="fas fa-plus"></i> Novo Cupom
          </button>
        </div>
        <div class="coupons-grid"></div>
      `;

      const grid = couponsList.querySelector('.coupons-grid');
      
      if (coupons.length === 0) {
        grid.innerHTML = '<p>Nenhum cupom cadastrado. Clique em "Novo Cupom" para adicionar um.</p>';
      } else {
        coupons.forEach(c => {
        const expires = new Date(c.expires_at).toLocaleDateString();
        const el = document.createElement('div');
        el.className = 'coupon-card';
        el.innerHTML = `
          <div class="coupon-info">
            <h4>${c.code}</h4>
            <p>${c.type === 'percentage' ? c.value + '%' : 'R$ ' + Number(c.value).toFixed(2)} de desconto</p>
            <p><small>Expira em: ${expires}</small></p>
            <p><small>Limite de uso: ${c.usage_limit === null || typeof c.usage_limit === 'undefined' ? 'Ilimitado' : c.usage_limit}</small></p>
            <div class="admin-actions">
              <button class="btn btn-outline edit-coupon" data-id="${c.id}">Editar</button>
              <button class="btn btn-outline delete-coupon" data-id="${c.id}">Excluir</button>
            </div>
          </div>
        `;
        grid.appendChild(el);

        // Delete button
        el.querySelector('.delete-coupon').addEventListener('click', async () => {
          if (!confirm('Tem certeza que deseja excluir este cupom?')) return;
          try {
            const res = await fetch(`/api/coupons/${c.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              el.remove();
              alert('Cupom excluído com sucesso.');
            } else {
              throw new Error('Erro ao excluir cupom.');
            }
          } catch (err) {
            alert(err.message);
          }
        });

        // Edit button
        el.querySelector('.edit-coupon').addEventListener('click', () => {
          showCouponModal(c);
        });
      });
      }

      const addBtn = document.getElementById('add-coupon');
      addBtn.addEventListener('click', () => showCouponModal());
    } catch (err) {
      couponsList.innerHTML = `
        <div class="section-header">
          <button class="btn btn-primary" id="add-coupon">
            <i class="fas fa-plus"></i> Novo Cupom
          </button>
        </div>
        <p>Erro ao carregar cupons.</p>
      `;
      const addBtn = document.getElementById('add-coupon');
      if (addBtn) {
        addBtn.addEventListener('click', () => showCouponModal());
      }
      console.error(err);
    }
  }

  function showCouponModal(coupon = null) {
    const modal = document.createElement('div');
    modal.className = 'admin-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h4>${coupon ? 'Editar' : 'Novo'} Cupom</h4>
          <button class="close-modal">&times;</button>
        </div>
        <form id="coupon-form" class="admin-form">
          <input type="hidden" name="id" value="${coupon?.id || ''}">
          <div class="form-group">
            <label for="code">Código do Cupom</label>
            <input type="text" id="code" name="code" required value="${coupon?.code || ''}"
              pattern="[A-Za-z0-9]+" title="Apenas letras e números">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="type">Tipo de Desconto</label>
              <select id="type" name="type" required>
                <option value="percentage" ${coupon?.type === 'percentage' ? 'selected' : ''}>Porcentagem</option>
                <option value="fixed" ${coupon?.type === 'fixed' ? 'selected' : ''}>Valor Fixo</option>
              </select>
            </div>
            <div class="form-group">
              <label for="value">Valor do Desconto</label>
              <input type="number" id="value" name="value" required min="0" step="0.01" 
                value="${coupon?.value || ''}">
            </div>
          </div>
          <div class="form-group">
            <label for="expires">Data de Expiração</label>
            <input type="date" id="expires" name="expires_at" required 
              value="${coupon?.expires_at ? coupon.expires_at.split('T')[0] : ''}">
          </div>
          <div class="form-group">
            <label for="usage_limit">Limite de Uso (opcional)</label>
            <input type="number" id="usage_limit" name="usage_limit" min="0" step="1"
              value="${typeof coupon?.usage_limit !== 'undefined' && coupon?.usage_limit !== null ? coupon.usage_limit : ''}">
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Salvar Cupom</button>
            <button type="button" class="btn btn-outline close-modal">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Close modal
    modal.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => modal.remove());
    });

    // Handle form submit
    const form = modal.querySelector('#coupon-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = Object.fromEntries(formData);
      const isEdit = data.id;

      try {
        // Construir payload apenas com campos válidos
        const payload = {
          code: data.code?.trim(),
          type: data.type,
          value: Number(data.value),
          expires_at: data.expires_at // Já vem no formato YYYY-MM-DD do input type="date"
        };
        
        // Incluir usage_limit apenas se tiver um valor válido
        const usageLimit = data.usage_limit?.trim();
        if (usageLimit && usageLimit !== '' && !isNaN(Number(usageLimit)) && Number(usageLimit) >= 0) {
          payload.usage_limit = Number(usageLimit);
        }
        
        const res = await fetch(isEdit ? `/api/coupons/${data.id}` : '/api/coupons', {
          method: isEdit ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (res.ok) {
          modal.remove();
          loadCoupons();
          alert(isEdit ? 'Cupom atualizado com sucesso!' : 'Cupom criado com sucesso!');
        } else {
          // Mostrar detalhes da validação se disponíveis
          let errorMsg = json.error || 'Erro ao salvar cupom.';
          
          // Se houver mensagens formatadas, usar elas
          if (json.messages && Array.isArray(json.messages) && json.messages.length > 0) {
            errorMsg = json.messages.join('\n');
          } else if (json.details && Array.isArray(json.details) && json.details.length > 0) {
            // Fallback para detalhes não formatados
            const details = json.details.map(d => {
              const field = d.param || d.path || '';
              const msg = d.msg || d.message || '';
              return field ? `${field}: ${msg}` : msg;
            }).join('\n');
            errorMsg = `Erro de validação:\n${details}`;
          }
          
          throw new Error(errorMsg);
        }
      } catch (err) {
        alert(err.message);
        console.error('Erro ao salvar cupom:', err);
      }
    });
  }

  // Load Site Settings
  async function loadSiteSettings() {
    const settingsList = document.getElementById('site-settings-list');
    if (!settingsList) return;

    try {
      const response = await fetch('/api/site-settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Verificar status da resposta
      if (!response.ok) {
        const text = await response.text();
        console.error('Erro HTTP:', response.status, text.substring(0, 500));
        settingsList.innerHTML = `
          <div style="padding: 1rem; background: #fee; border: 1px solid #fcc; border-radius: 4px;">
            <p><strong>Erro ao carregar configurações (Status ${response.status}):</strong></p>
            <p>A tabela 'site_settings' pode não existir no banco de dados.</p>
            <p>Por favor, execute o SQL em <code>sql/add_site_settings_table.sql</code> no Supabase.</p>
            <details style="margin-top: 0.5rem;">
              <summary style="cursor: pointer; color: #666;">Detalhes do erro</summary>
              <pre style="margin-top: 0.5rem; padding: 0.5rem; background: #f5f5f5; border-radius: 4px; overflow-x: auto; font-size: 0.75rem;">${text.substring(0, 500)}</pre>
            </details>
          </div>
        `;
        return;
      }
      
      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Resposta não é JSON. Content-Type:', contentType);
        console.error('Resposta:', text.substring(0, 500));
        settingsList.innerHTML = `
          <div style="padding: 1rem; background: #fee; border: 1px solid #fcc; border-radius: 4px;">
            <p><strong>Erro ao carregar configurações:</strong></p>
            <p>A resposta não é JSON (Content-Type: ${contentType || 'não especificado'}).</p>
            <p>A tabela 'site_settings' pode não existir no banco de dados.</p>
            <p>Por favor, execute o SQL em <code>sql/add_site_settings_table.sql</code> no Supabase.</p>
            <details style="margin-top: 0.5rem;">
              <summary style="cursor: pointer; color: #666;">Detalhes da resposta</summary>
              <pre style="margin-top: 0.5rem; padding: 0.5rem; background: #f5f5f5; border-radius: 4px; overflow-x: auto; font-size: 0.75rem;">${text.substring(0, 500)}</pre>
            </details>
          </div>
        `;
        return;
      }
      
      const data = await response.json();

      if (!data.settings) {
        settingsList.innerHTML = '<p>Erro ao carregar configurações.</p>';
        return;
      }

      const settings = data.settings;
      settingsList.innerHTML = `
        <div class="settings-form">
          <div class="setting-item">
            <label for="announcement_text">
              <strong>Texto do Anúncio (Frete Grátis)</strong>
              <small>Texto exibido no banner superior do site</small>
            </label>
            <input type="text" id="announcement_text" value="${(settings.announcement_text?.value || '').replace(/"/g, '&quot;')}" 
              placeholder="Frete grátis em compras acima de R$ 199">
            <button type="button" class="btn btn-primary save-setting" data-key="announcement_text">Salvar</button>
          </div>

          <div class="setting-item">
            <label for="hero_banner_title">
              <strong>Título do Banner Principal</strong>
              <small>Título exibido no banner hero (ex: "Nova Coleção")</small>
            </label>
            <input type="text" id="hero_banner_title" value="${(settings.hero_banner_title?.value || '').replace(/"/g, '&quot;')}" 
              placeholder="Nova Coleção">
            <button type="button" class="btn btn-primary save-setting" data-key="hero_banner_title">Salvar</button>
          </div>

          <div class="setting-item">
            <label for="hero_banner_subtitle">
              <strong>Subtítulo do Banner Principal</strong>
              <small>Subtítulo exibido no banner hero (ex: "Até 70% OFF + 20% no primeiro pedido")</small>
            </label>
            <input type="text" id="hero_banner_subtitle" value="${(settings.hero_banner_subtitle?.value || '').replace(/"/g, '&quot;')}" 
              placeholder="Até 70% OFF + 20% no primeiro pedido">
            <button type="button" class="btn btn-primary save-setting" data-key="hero_banner_subtitle">Salvar</button>
          </div>

          <!-- Nova seção para configuração de fundo do site -->
          <div class="setting-item">
            <label>
              <strong>Fundo do Site</strong>
              <small>Escolha o tipo de fundo e configure o valor</small>
            </label>
            
            <!-- Tipo de fundo -->
            <div style="margin-bottom: 1rem;">
              <label style="display: block; margin-bottom: 0.5rem;"><strong>Tipo de Fundo:</strong></label>
              <select id="site_background_type" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;">
                <option value="color" ${settings.site_background_type?.value === 'color' ? 'selected' : ''}>Cor Sólida</option>
                <option value="image" ${settings.site_background_type?.value === 'image' ? 'selected' : ''}>Imagem</option>
                <option value="gif" ${settings.site_background_type?.value === 'gif' ? 'selected' : ''}>GIF</option>
                <option value="video" ${settings.site_background_type?.value === 'video' ? 'selected' : ''}>Vídeo</option>
              </select>
            </div>
            
            <!-- Valor do fundo (cor ou URL) -->
            <div style="margin-bottom: 1rem;">
              <label style="display: block; margin-bottom: 0.5rem;" for="site_background_value"><strong>Valor do Fundo:</strong></label>
              <input type="text" id="site_background_value" value="${(settings.site_background_value?.value || '#f5f5f5').replace(/"/g, '&quot;')}" 
                placeholder="Cor (#f5f5f5) ou URL da imagem/gif" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;">
              
              <!-- Preview da cor -->
              <div id="color-preview" style="display: ${settings.site_background_type?.value === 'color' || !settings.site_background_type?.value ? 'block' : 'none'}; margin-bottom: 0.5rem;">
                <div style="width: 50px; height: 30px; border: 1px solid #ddd; border-radius: 4px; background-color: ${settings.site_background_value?.value || '#f5f5f5'};"></div>
              </div>
              
              <!-- Preview da imagem/gif -->
              <div id="image-preview" style="display: ${settings.site_background_type?.value === 'image' || settings.site_background_type?.value === 'gif' ? 'block' : 'none'}; margin-bottom: 0.5rem;">
                ${settings.site_background_value?.value ? `
                  <img src="${settings.site_background_value.value}" alt="Preview" 
                    style="max-width: 100%; max-height: 200px; border-radius: 4px; border: 1px solid #ddd;">
                ` : '<p>Nenhuma imagem selecionada</p>'}
              </div>
            </div>
            
            <!-- Upload de imagem/gif -->
            <div style="margin-bottom: 1rem;">
              <input type="file" id="site_background_file" accept="image/*" style="margin-bottom: 0.5rem; width: 100%;">
              <button type="button" class="btn btn-outline upload-image" data-key="site_background">Fazer Upload de Imagem/GIF</button>
            </div>
            
            <!-- Upload de vídeo -->
            <div style="margin-bottom: 1rem;">
              <input type="file" id="site_background_video_file" accept="video/*" style="margin-bottom: 0.5rem; width: 100%;">
              <button type="button" class="btn btn-outline upload-video" data-key="site_background_video">Fazer Upload de Vídeo</button>
            </div>
            
            <!-- URL do vídeo -->
            <div id="video-url-section" style="display: ${settings.site_background_type?.value === 'video' ? 'block' : 'none'}; margin-bottom: 1rem;">
              <label style="display: block; margin-bottom: 0.5rem;" for="site_background_video_url"><strong>URL do Vídeo:</strong></label>
              <input type="text" id="site_background_video_url" value="${(settings.site_background_video_url?.value || '').replace(/"/g, '&quot;')}" 
                placeholder="https://exemplo.com/video.mp4" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;">
              
              <!-- Preview do vídeo -->
              ${settings.site_background_video_url?.value ? `
                <video src="${settings.site_background_video_url.value}" controls 
                  style="max-width: 100%; max-height: 200px; border-radius: 4px; border: 1px solid #ddd;"></video>
              ` : '<p>Nenhum vídeo selecionado</p>'}
            </div>
            
            <button type="button" class="btn btn-primary save-setting" data-key="site_background">Salvar Configurações de Fundo</button>
          </div>
        </div>
      `;

      // Event listeners para salvar configurações
      document.querySelectorAll('.save-setting').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const key = btn.getAttribute('data-key');
          let value = '';

          if (key === 'site_background') {
            // Salvar todas as configurações de fundo
            const type = document.getElementById('site_background_type').value;
            const backgroundValue = document.getElementById('site_background_value').value.trim();
            const videoUrl = document.getElementById('site_background_video_url').value.trim();
            
            // Salvar tipo de fundo
            await saveSetting('site_background_type', type);
            
            // Salvar valor do fundo
            await saveSetting('site_background_value', backgroundValue);
            
            // Salvar URL do vídeo se for do tipo vídeo
            if (type === 'video') {
              await saveSetting('site_background_video_url', videoUrl);
            }
            
            alert('Configurações de fundo salvas com sucesso!');
            loadSiteSettings(); // Recarregar para atualizar previews
            return;
          } else {
            const input = document.getElementById(key);
            value = input ? input.value.trim() : '';
          }

          if (!value) {
            alert('Por favor, preencha o campo antes de salvar.');
            return;
          }

          try {
            const response = await fetch(`/api/site-settings/${key}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ value })
            });

            const result = await response.json();
            if (response.ok) {
              alert('Configuração salva com sucesso!');
              loadSiteSettings(); // Recarregar para atualizar preview
            } else {
              alert(`Erro: ${result.error || 'Falha ao salvar configuração'}`);
            }
          } catch (err) {
            alert(`Erro ao salvar: ${err.message}`);
            console.error('Erro ao salvar configuração:', err);
          }
        });
      });

      // Função auxiliar para salvar uma configuração
      async function saveSetting(key, value) {
        const response = await fetch(`/api/site-settings/${key}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ value })
        });
        
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Falha ao salvar configuração');
        }
        
        return await response.json();
      }

      // Event listener para mudanças no tipo de fundo
      const backgroundTypeSelect = document.getElementById('site_background_type');
      if (backgroundTypeSelect) {
        backgroundTypeSelect.addEventListener('change', function() {
          const type = this.value;
          const colorPreview = document.getElementById('color-preview');
          const imagePreview = document.getElementById('image-preview');
          const videoUrlSection = document.getElementById('video-url-section');
          
          // Mostrar/ocultar seções apropriadas
          if (colorPreview) colorPreview.style.display = type === 'color' ? 'block' : 'none';
          if (imagePreview) imagePreview.style.display = (type === 'image' || type === 'gif') ? 'block' : 'none';
          if (videoUrlSection) videoUrlSection.style.display = type === 'video' ? 'block' : 'none';
        });
      }

      // Event listener para mudanças no valor da cor
      const colorValueInput = document.getElementById('site_background_value');
      if (colorValueInput) {
        colorValueInput.addEventListener('input', function() {
          const colorPreview = document.getElementById('color-preview');
          if (colorPreview) {
            const previewBox = colorPreview.querySelector('div');
            if (previewBox) {
              previewBox.style.backgroundColor = this.value;
            }
          }
        });
      }

      // Event listener para upload de imagem
      document.querySelectorAll('.upload-image').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const key = btn.getAttribute('data-key');
          let fileInputId = '';
          
          if (key === 'site_background') {
            fileInputId = 'site_background_file';
          }
          
          const fileInput = document.getElementById(fileInputId);
          const file = fileInput?.files[0];

          if (!file) {
            alert('Por favor, selecione uma imagem antes de fazer upload.');
            return;
          }

          const formData = new FormData();
          formData.append('image', file);

          try {
            btn.disabled = true;
            btn.textContent = 'Enviando...';

            const response = await fetch(`/api/site-settings/${key === 'site_background' ? 'site_background_value' : key}/upload`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`
              },
              body: formData
            });

            const result = await response.json();
            if (response.ok) {
              alert('Imagem enviada com sucesso!');
              
              // Atualizar o campo de valor com a URL da imagem
              if (key === 'site_background') {
                const valueInput = document.getElementById('site_background_value');
                if (valueInput) {
                  valueInput.value = result.image_url;
                }
              }
              
              loadSiteSettings(); // Recarregar para atualizar preview
            } else {
              alert(`Erro: ${result.error || 'Falha ao enviar imagem'}`);
            }
          } catch (err) {
            alert(`Erro ao enviar: ${err.message}`);
            console.error('Erro ao enviar imagem:', err);
          } finally {
            btn.disabled = false;
            btn.textContent = 'Fazer Upload';
          }
        });
      });
      
      // Event listener para upload de vídeo
      document.querySelectorAll('.upload-video').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const key = btn.getAttribute('data-key');
          const fileInputId = 'site_background_video_file';
          
          const fileInput = document.getElementById(fileInputId);
          const file = fileInput?.files[0];

          if (!file) {
            alert('Por favor, selecione um vídeo antes de fazer upload.');
            return;
          }

          const formData = new FormData();
          formData.append('video', file);

          try {
            btn.disabled = true;
            btn.textContent = 'Enviando...';

            const response = await fetch('/api/site-settings/site_background_video/upload', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`
              },
              body: formData
            });

            const result = await response.json();
            if (response.ok) {
              alert('Vídeo enviado com sucesso!');
              
              // Atualizar o campo de URL do vídeo
              const videoUrlInput = document.getElementById('site_background_video_url');
              if (videoUrlInput) {
                videoUrlInput.value = result.video_url;
              }
              
              loadSiteSettings(); // Recarregar para atualizar preview
            } else {
              alert(`Erro: ${result.error || 'Falha ao enviar vídeo'}`);
            }
          } catch (err) {
            alert(`Erro ao enviar: ${err.message}`);
            console.error('Erro ao enviar vídeo:', err);
          } finally {
            btn.disabled = false;
            btn.textContent = 'Fazer Upload';
          }
        });
      });

    } catch (err) {
      settingsList.innerHTML = `<p>Erro ao carregar configurações: ${err.message}</p>`;
      console.error('Erro ao carregar configurações:', err);
    }
  }

  // Carregar configurações quando a seção for ativada
  let settingsLoaded = false;
  document.querySelectorAll('.admin-nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const section = link.getAttribute('data-section');
      if (section === 'site-settings' && !settingsLoaded) {
        loadSiteSettings();
        settingsLoaded = true;
      }
    });
  });

  // Initial loads
  loadProducts();
  loadCoupons();
});
