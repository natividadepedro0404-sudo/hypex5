const api = (p, opts) => fetch(`/api/${p}`, opts).then(r => {
  if (!r.ok) {
    throw new Error(`API request failed with status ${r.status}`);
  }
  return r.json();
});

// Carrinho Modal
let cartModal = document.getElementById('cart-modal');
let cartIcon = document.querySelector('.cart-icon');
let closeModal = document.querySelector('.close-modal');

// Função para criar o conteúdo do carrinho modal dinamicamente
function createCartModalContent() {
  if (!cartModal) return;
  
  // Verificar se o conteúdo já foi criado
  if (cartModal.querySelector('.modal-content')) return;
  
  cartModal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Seu Carrinho</h3>
        <button class="close-modal">&times;</button>
      </div>
      <div id="cart-items"></div>
      <div class="cart-footer">
        <div class="coupon-section" style="padding: 1rem; border-top: 1px solid #eee; margin-bottom: 1rem;">
          <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
            <input type="text" id="coupon-code-input" placeholder="Código do cupom" 
              style="flex: 1; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
            <button type="button" id="apply-coupon-btn" class="btn btn-outline" 
              style="padding: 0.5rem 1rem; white-space: nowrap;">
              Aplicar
            </button>
          </div>
          <div id="coupon-message" style="font-size: 0.875rem; min-height: 1.5rem;"></div>
        </div>
        <div class="shipping-section" style="padding: 1rem; border-top: 1px solid #eee; margin-bottom: 1rem;">
          <h4 style="margin: 0 0 1rem 0; font-size: 1rem;">Opções de Recebimento</h4>
          
          <!-- Opção 1: CEP (Correios/Melhor Envio) -->
          <label style="display: block; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 0.5rem; cursor: pointer;">
            <input type="radio" name="delivery-option" value="cep" checked style="margin-right: 0.5rem;">
            <strong>Entrega via Correios/Transportadora</strong>
          </label>
          <div id="cep-section" style="padding: 0.75rem; background: #f9f9f9; border-radius: 4px; margin-bottom: 0.75rem;">
            <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
              <input type="text" id="shipping-cep-input" placeholder="Digite seu CEP" maxlength="8" inputmode="numeric" pattern="[0-9]*"
                style="flex: 1; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
              <button type="button" id="calc-shipping-btn" class="btn btn-outline"
                style="padding: 0.5rem 1rem; white-space: nowrap;">Calcular Frete</button>
            </div>
            <div id="shipping-results" style="font-size: 0.9rem; color: var(--text-secondary); min-height: 1.25rem;"></div>
          </div>
          
          <!-- Opção 2: Retirada no Local -->
          <label style="display: block; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 0.5rem; cursor: pointer;">
            <input type="radio" name="delivery-option" value="pickup" style="margin-right: 0.5rem;">
            <strong>Retirada no Local (Grátis)</strong>
          </label>
          <div id="pickup-section" style="display: none; padding: 0.75rem; background: #f0f8ff; border-radius: 4px; margin-bottom: 0.75rem; border-left: 3px solid #007bff;">
            <p style="margin: 0 0 0.5rem 0; font-size: 0.9rem;">🛑️ Retirar seu pedido pessoalmente no endereço abaixo:</p>
            <p style="margin: 0 0 0.25rem 0; font-size: 0.9rem;"><strong>📍 Rua Camboja, nº 133 – Bairro Petrovale, Betim</strong></p>
            <p style="margin: 0; font-size: 0.9rem;">📞 Telefone: (31) 97507-4666</p>
          </div>
          
          <!-- Opção 3: Moto-Uber -->
          <label style="display: block; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 0.5rem; cursor: pointer;">
            <input type="radio" name="delivery-option" value="moto-uber" style="margin-right: 0.5rem;">
            <strong>Entrega via Moto/Uber (A combinar)</strong>
          </label>
          <div id="moto-uber-section" style="display: none; padding: 0.75rem; background: #fff8e1; border-radius: 4px; margin-bottom: 0.75rem; border-left: 3px solid #ffc107;">
            <p style="margin: 0 0 0.5rem 0; font-size: 0.9rem;">📦 Entregamos por moto-Uber, com o valor a combinar diretamente pelo WhatsApp.</p>
            <p style="margin: 0; font-size: 0.9rem;"><strong>📲 Contato: (31) 97507-4666</strong></p>
          </div>
        </div>
        <div class="cart-total" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <span>Subtotal:</span>
          <strong id="cart-subtotal-value">R$ 0,00</strong>
        </div>
        <div id="shipping-total" style="display: none; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; font-size: 0.95rem;">
          <span>Frete:</span>
          <strong id="shipping-total-value">R$ 0,00</strong>
        </div>
        <div id="coupon-discount" style="display: none; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; color: #28a745; font-size: 0.9rem;">
          <span>Desconto:</span>
          <strong id="coupon-discount-value">-R$ 0,00</strong>
        </div>
        <div class="cart-total" style="display: flex; justify-content: space-between; align-items: center; font-size: 1.2rem; font-weight: bold; padding-top: 0.5rem; border-top: 2px solid #333; margin-bottom: 1rem;">
          <span>Total:</span>
          <strong id="cart-total-value">R$ 0,00</strong>
        </div>
        <button type="button" id="checkout-btn" class="checkout-button">
          Finalizar Compra
          <small>(apenas itens selecionados)</small>
        </button>
      </div>
    </div>
  `;
  
  // Adicionar evento ao botão de fechar
  const newCloseModal = cartModal.querySelector('.close-modal');
  if (newCloseModal) {
    newCloseModal.addEventListener('click', () => {
      if (cartModal) cartModal.style.display = 'none';
    });
  }
  
  // Adicionar event listeners para elementos do carrinho
  setupCartEventListeners();
}

if (cartIcon) {
  cartIcon.addEventListener('click', (e) => {
    e.preventDefault();
    // Atualizar referências aos elementos do DOM
    cartModal = document.getElementById('cart-modal');
    if (cartModal) {
      // Criar conteúdo do carrinho se necessário
      createCartModalContent();
      cartModal.style.display = 'block';
      // Renderizar o carrinho após abrir o modal
      setTimeout(() => renderCart(), 0); // Use setTimeout to ensure DOM is updated
    }
  });
}

if (closeModal) {
  closeModal.addEventListener('click', () => {
    if (cartModal) cartModal.style.display = 'none';
  });
}

// Event listener for ESC key to close modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && cartModal && cartModal.style.display === 'block') {
    cartModal.style.display = 'none';
  }
});

// Event listener for clicking outside modal to close it
document.addEventListener('click', (e) => {
  if (cartModal && cartModal.style.display === 'block' && e.target === cartModal) {
    cartModal.style.display = 'none';
  }
});

// Produtos
async function loadProducts() {
  const list = document.getElementById('product-list');
  if (!list) return; // Se o elemento não existe na página, não fazer nada
  
  try {
    console.log('Loading products...');
    const res = await api('products');
    console.log('Products API response:', res);
    
    // Clear the list first
    list.innerHTML = '';
    
    // Collect all variations from all products
    const allVariations = [];
    const productsWithoutVariations = [];
    
    (res.products || []).forEach(p => {
      console.log('Processing product:', p);
      console.log('Product image data:', { image: p.image, images: p.images });
      console.log('Product variations:', p.variations);
      
      // Only include products that have variations
      if (p.variations && Array.isArray(p.variations) && p.variations.length > 0) {
        console.log('Product has variations:', p.variations);
        // According to project requirements, when a product has variations, 
        // we should display the first variation's image by default
        p.variations.forEach((variation, index) => {
          console.log('Variation data:', variation);
          console.log('Variation image data:', { image: variation.image, images: variation.images });
          // Add product info to each variation for display purposes
          allVariations.push({
            ...variation,
            product_id: p.id,
            product_name: p.name,
            product_price: p.price,
            product_original_price: p.original_price,
            product_stock: p.stock,
            is_first_variation: index === 0 // Mark the first variation
          });
        });
      } else {
        // Keep track of products without variations
        productsWithoutVariations.push(p);
      }
    });
    
    console.log('All variations to display:', allVariations);
    console.log('Products without variations:', productsWithoutVariations);
    
    // Display all variations if available
    if (allVariations.length > 0) {
      allVariations.forEach(variation => {
        const hasDiscount = variation.price < variation.product_price;
        const discount = hasDiscount ? Math.round((1 - variation.price / variation.product_price) * 100) : 0;
        
        // Use variation image if available, otherwise fallback to a placeholder
        // Handle both single image and images array
        let displayImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E';
        let hasImage = false;
        console.log('Variation data:', variation);
        if (variation.image) {
          // Single image property
          displayImage = variation.image;
          hasImage = true;
          console.log('Using single image for variation:', variation.image);
        } else if (variation.images && Array.isArray(variation.images) && variation.images.length > 0) {
          // Images array
          displayImage = variation.images[0];
          hasImage = true;
          console.log('Using first image from array for variation:', variation.images[0]);
        } else {
          console.log('No image found for variation, using clean placeholder');
          // Even if no image is found, we should still try to get an image from the product
          // if this is the first variation
          if (variation.is_first_variation) {
            console.log('This is the first variation, checking parent product for images');
            // We would need access to the parent product data here to get its images
            // This would require passing the parent product data to the variation
          }
        }
        
        const card = document.createElement('article');
        card.className = 'product-card';
        card.dataset.productId = variation.product_id;
        card.dataset.variationId = variation.id;
        
        // Imagem principal
        const imgWrap = document.createElement('div');
        imgWrap.className = 'product-image';
        if (!hasImage) {
          imgWrap.classList.add('placeholder');
        }
        
        const img = document.createElement('img');
        img.alt = `${variation.product_name} - ${variation.name}`;
        img.src = displayImage;
        console.log('Setting variation image src to:', displayImage);
        // Add error handling for image loading
        img.onerror = function() {
          console.log('Variation image failed to load, using clean placeholder');
          this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E';
        };
        imgWrap.appendChild(img);
        
        if (hasDiscount) {
          const discountBadge = document.createElement('span');
          discountBadge.className = 'discount-badge';
          discountBadge.textContent = `-${discount}%`;
          imgWrap.appendChild(discountBadge);
        }
        
        // Quick actions
        const actions = document.createElement('div');
        actions.className = 'quick-actions';
        
        const favorite = document.createElement('button');
        favorite.innerHTML = '<i class="far fa-heart"></i>';
        favorite.title = 'Adicionar aos favoritos';
        favorite.className = 'action-btn favorite';
        favorite.addEventListener('click', (e) => {
          e.stopPropagation();
          // Pass the product ID, not the variation ID for favorites
          toggleFavorite(variation.product_id, favorite);
        });
        
        const addToCart = document.createElement('button');
        addToCart.innerHTML = '<i class="fas fa-shopping-cart"></i>';
        const stock = Number(variation.stock || 0);
        if (stock <= 0) {
          addToCart.title = 'Variação fora de estoque';
          addToCart.disabled = true;
          addToCart.className = 'action-btn add-cart';
        } else {
          addToCart.title = 'Adicionar ao carrinho';
          addToCart.className = 'action-btn add-cart';
          addToCart.addEventListener('click', (e) => {
            e.stopPropagation();
            // Pass variation-specific data to cart
            addItemToCart({
              id: variation.product_id,
              name: `${variation.product_name} - ${variation.name}`,
              price: variation.price,
              images: variation.images,
              stock: variation.stock,
              variation_id: variation.id,
              size: variation.size,
              color: variation.color
            });
          });
        }
        
        actions.appendChild(favorite);
        actions.appendChild(addToCart);
        imgWrap.appendChild(actions);
        
        card.appendChild(imgWrap);
        
        // Info da variação
        const info = document.createElement('div');
        info.className = 'product-info';
        
        const name = document.createElement('h3');
        name.className = 'product-name';
        name.textContent = `${variation.product_name} - ${variation.name}`;
        
        const priceInfo = document.createElement('div');
        priceInfo.className = 'price-info';
        
        const currentPrice = document.createElement('span');
        currentPrice.className = 'current-price';
        currentPrice.textContent = `R$ ${Number(variation.price).toFixed(2)}`;
        
        if (hasDiscount) {
          const originalPrice = document.createElement('span');
          originalPrice.className = 'original-price';
          originalPrice.textContent = `R$ ${Number(variation.product_price).toFixed(2)}`;
          priceInfo.appendChild(originalPrice);
        }
        
        priceInfo.appendChild(currentPrice);
        
        info.appendChild(name);
        info.appendChild(priceInfo);
        
        // Adicionar especificações da variação se disponíveis
        if (variation.size || variation.color) {
          const specs = document.createElement('div');
          specs.className = 'product-specs';
          specs.style.marginTop = '0.5rem';
          specs.style.fontSize = '0.875rem';
          specs.style.color = '#666';
          
          if (variation.size) {
            const sizeEl = document.createElement('p');
            sizeEl.innerHTML = `<strong>Tamanho:</strong> ${variation.size}`;
            specs.appendChild(sizeEl);
          }
          
          if (variation.color) {
            const colorEl = document.createElement('p');
            colorEl.innerHTML = `<strong>Cor:</strong> ${variation.color}`;
            specs.appendChild(colorEl);
          }
          
          info.appendChild(specs);
        }
        
        card.appendChild(info);
        
        // Adicionar evento de clique para redirecionar para página de detalhes do produto
        card.addEventListener('click', (e) => {
          // Ignorar se clicou nos botões de ação
          if (!e.target.closest('.quick-actions') && !e.target.closest('.action-btn')) {
            window.location.href = `/pages/product.html?id=${variation.product_id}`;
          }
        });
        
        list.appendChild(card);
      });
    } else if (productsWithoutVariations.length > 0) {
      // If no variations exist, show regular products
      console.log('Displaying regular products instead');
      productsWithoutVariations.forEach(p => {
        const hasDiscount = p.original_price && p.original_price > p.price;
        const discount = hasDiscount ? Math.round((1 - p.price / p.original_price) * 100) : 0;
        
        // Use product image if available, otherwise fallback to a placeholder
        // Handle both single image and images array
        let displayImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E';
        let hasImage = false;
        console.log('Product data:', p);
        if (p.image) {
          // Single image property
          displayImage = p.image;
          hasImage = true;
          console.log('Using single image:', p.image);
        } else if (p.images && Array.isArray(p.images) && p.images.length > 0) {
          // Images array
          displayImage = p.images[0];
          hasImage = true;
          console.log('Using first image from array:', p.images[0]);
        } else {
          console.log('No image found, using clean placeholder');
        }
        
        const card = document.createElement('article');
        card.className = 'product-card';
        card.dataset.productId = p.id;
        
        // Imagem principal
        const imgWrap = document.createElement('div');
        imgWrap.className = 'product-image';
        if (!hasImage) {
          imgWrap.classList.add('placeholder');
        }
        
        const img = document.createElement('img');
        img.alt = p.name;
        img.src = displayImage;
        console.log('Setting image src to:', displayImage);
        // Add error handling for image loading
        img.onerror = function() {
          console.log('Image failed to load, using clean placeholder');
          this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E';
        };
        imgWrap.appendChild(img);
        
        if (hasDiscount) {
          const discountBadge = document.createElement('span');
          discountBadge.className = 'discount-badge';
          discountBadge.textContent = `-${discount}%`;
          imgWrap.appendChild(discountBadge);
        }
        
        // Quick actions
        const actions = document.createElement('div');
        actions.className = 'quick-actions';
        
        const favorite = document.createElement('button');
        favorite.innerHTML = '<i class="far fa-heart"></i>';
        favorite.title = 'Adicionar aos favoritos';
        favorite.className = 'action-btn favorite';
        favorite.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleFavorite(p.id, favorite);
        });
        
        const addToCart = document.createElement('button');
        addToCart.innerHTML = '<i class="fas fa-shopping-cart"></i>';
        const stock = Number(p.stock || 0);
        if (stock <= 0) {
          addToCart.title = 'Produto fora de estoque';
          addToCart.disabled = true;
          addToCart.className = 'action-btn add-cart';
        } else {
          addToCart.title = 'Adicionar ao carrinho';
          addToCart.className = 'action-btn add-cart';
          addToCart.addEventListener('click', () => addItemToCart(p));
        }
        
        actions.appendChild(favorite);
        actions.appendChild(addToCart);
        imgWrap.appendChild(actions);
        
        card.appendChild(imgWrap);
        
        // Info do produto
        const info = document.createElement('div');
        info.className = 'product-info';
        
        const name = document.createElement('h3');
        name.className = 'product-name';
        name.textContent = p.name;
        
        const priceInfo = document.createElement('div');
        priceInfo.className = 'price-info';
        
        const currentPrice = document.createElement('span');
        currentPrice.className = 'current-price';
        currentPrice.textContent = `R$ ${Number(p.price).toFixed(2)}`;
        
        if (hasDiscount) {
          const originalPrice = document.createElement('span');
          originalPrice.className = 'original-price';
          originalPrice.textContent = `R$ ${Number(p.original_price).toFixed(2)}`;
          priceInfo.appendChild(originalPrice);
        }
        
        priceInfo.appendChild(currentPrice);
        
        info.appendChild(name);
        info.appendChild(priceInfo);
        
        // Adicionar especificações se disponíveis
        if (p.type || p.color || (p.sizes && Array.isArray(p.sizes) && p.sizes.length > 0)) {
          const specs = document.createElement('div');
          specs.className = 'product-specs';
          specs.style.marginTop = '0.5rem';
          specs.style.fontSize = '0.875rem';
          specs.style.color = '#666';
          
          if (p.type) {
            const typeEl = document.createElement('p');
            typeEl.innerHTML = `<strong>Tipo:</strong> ${p.type}`;
            specs.appendChild(typeEl);
          }
          
          if (p.color) {
            const colorEl = document.createElement('p');
            colorEl.innerHTML = `<strong>Cor:</strong> ${p.color}`;
            specs.appendChild(colorEl);
          }
          
          if (p.sizes && Array.isArray(p.sizes) && p.sizes.length > 0) {
            const sizesEl = document.createElement('p');
            sizesEl.innerHTML = `<strong>Tamanhos:</strong> ${p.sizes.join(', ')}`;
            specs.appendChild(sizesEl);
          }
          
          info.appendChild(specs);
        }
        
        card.appendChild(info);
        
        // Adicionar evento de clique para redirecionar para página de detalhes
        card.addEventListener('click', (e) => {
          // Ignorar se clicou nos botões de ação
          if (!e.target.closest('.quick-actions') && !e.target.closest('.action-btn')) {
            window.location.href = `/pages/product.html?id=${p.id}`;
          }
        });
        
        list.appendChild(card);
      });
    } else {
      // If no products at all, show a message
      list.innerHTML = '<div class="no-products-message">Nenhum produto disponível no momento.</div>';
      console.log('No products to display');
    }
  } catch (error) {
    console.error('Error loading products:', error);
    list.innerHTML = '<div class="error-message">Erro ao carregar produtos. Por favor, tente novamente mais tarde.</div>';
  }
  
  updateCartCount();
}

// Função para realizar a busca de produtos
async function searchProducts(query) {
  // Redirecionar para a página de pesquisa
  window.location.href = `/pages/pesquisa.html?q=${encodeURIComponent(query)}`;
}

// Função para renderizar os resultados da busca
function renderSearchResults(products) {
  const list = document.getElementById('product-list');
  if (!list) return;
  
  // Limpar a lista
  list.innerHTML = '';
  
  // Coletar todas as variações dos produtos
  const allVariations = [];
  const productsWithoutVariations = [];
  
  products.forEach(p => {
    // Apenas incluir produtos que têm variações
    if (p.variations && Array.isArray(p.variations) && p.variations.length > 0) {
      // De acordo com os requisitos do projeto, quando um produto tem variações,
      // devemos exibir a imagem da primeira variação por padrão
      p.variations.forEach((variation, index) => {
        // Adicionar informações do produto a cada variação para exibição
        allVariations.push({
          ...variation,
          product_id: p.id,
          product_name: p.name,
          product_price: p.price,
          product_original_price: p.original_price,
          product_stock: p.stock,
          is_first_variation: index === 0 // Marcar a primeira variação
        });
      });
    } else {
      // Manter controle de produtos sem variações
      productsWithoutVariations.push(p);
    }
  });
  
  // Exibir todas as variações se disponíveis
  if (allVariations.length > 0) {
    allVariations.forEach(variation => {
      const hasDiscount = variation.price < variation.product_price;
      const discount = hasDiscount ? Math.round((1 - variation.price / variation.product_price) * 100) : 0;
      
      // Usar imagem da variação se disponível, caso contrário usar um placeholder
      // Lidar com imagem única e array de imagens
      let displayImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E';
      let hasImage = false;
      if (variation.image) {
        // Propriedade de imagem única
        displayImage = variation.image;
        hasImage = true;
      } else if (variation.images && Array.isArray(variation.images) && variation.images.length > 0) {
        // Array de imagens
        displayImage = variation.images[0];
        hasImage = true;
      }
      
      const card = document.createElement('article');
      card.className = 'product-card';
      card.dataset.productId = variation.product_id;
      card.dataset.variationId = variation.id;
      
      // Imagem principal
      const imgWrap = document.createElement('div');
      imgWrap.className = 'product-image';
      if (!hasImage) {
        imgWrap.classList.add('placeholder');
      }
      
      const img = document.createElement('img');
      img.alt = `${variation.product_name} - ${variation.name}`;
      img.src = displayImage;
      // Adicionar tratamento de erro para carregamento de imagem
      img.onerror = function() {
        this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E';
      };
      imgWrap.appendChild(img);
      
      if (hasDiscount) {
        const discountBadge = document.createElement('span');
        discountBadge.className = 'discount-badge';
        discountBadge.textContent = `-${discount}%`;
        imgWrap.appendChild(discountBadge);
      }
      
      // Ações rápidas
      const actions = document.createElement('div');
      actions.className = 'quick-actions';
      
      const favorite = document.createElement('button');
      favorite.innerHTML = '<i class="far fa-heart"></i>';
      favorite.title = 'Adicionar aos favoritos';
      favorite.className = 'action-btn favorite';
      favorite.addEventListener('click', (e) => {
        e.stopPropagation();
        // Passar o ID do produto, não o ID da variação para favoritos
        toggleFavorite(variation.product_id, favorite);
      });
      
      const addToCart = document.createElement('button');
      addToCart.innerHTML = '<i class="fas fa-shopping-cart"></i>';
      const stock = Number(variation.stock || 0);
      if (stock <= 0) {
        addToCart.title = 'Variação fora de estoque';
        addToCart.disabled = true;
        addToCart.className = 'action-btn add-cart';
      } else {
        addToCart.title = 'Adicionar ao carrinho';
        addToCart.className = 'action-btn add-cart';
        addToCart.addEventListener('click', (e) => {
          e.stopPropagation();
          // Passar dados específicos da variação para o carrinho
          addItemToCart({
            id: variation.product_id,
            name: `${variation.product_name} - ${variation.name}`,
            price: variation.price,
            images: variation.images,
            stock: variation.stock,
            variation_id: variation.id,
            size: variation.size,
            color: variation.color
          });
        });
      }
      
      actions.appendChild(favorite);
      actions.appendChild(addToCart);
      imgWrap.appendChild(actions);
      
      card.appendChild(imgWrap);
      
      // Informações da variação
      const info = document.createElement('div');
      info.className = 'product-info';
      
      const name = document.createElement('h3');
      name.className = 'product-name';
      name.textContent = `${variation.product_name} - ${variation.name}`;
      
      const priceInfo = document.createElement('div');
      priceInfo.className = 'price-info';
      
      const currentPrice = document.createElement('span');
      currentPrice.className = 'current-price';
      currentPrice.textContent = `R$ ${Number(variation.price).toFixed(2)}`;
      
      if (hasDiscount) {
        const originalPrice = document.createElement('span');
        originalPrice.className = 'original-price';
        originalPrice.textContent = `R$ ${Number(variation.product_price).toFixed(2)}`;
        priceInfo.appendChild(originalPrice);
      }
      
      priceInfo.appendChild(currentPrice);
      
      info.appendChild(name);
      info.appendChild(priceInfo);
      
      // Adicionar especificações da variação se disponíveis
      if (variation.size || variation.color) {
        const specs = document.createElement('div');
        specs.className = 'product-specs';
        specs.style.marginTop = '0.5rem';
        specs.style.fontSize = '0.875rem';
        specs.style.color = '#666';
        
        if (variation.size) {
          const sizeEl = document.createElement('p');
          sizeEl.innerHTML = `<strong>Tamanho:</strong> ${variation.size}`;
          specs.appendChild(sizeEl);
        }
        
        if (variation.color) {
          const colorEl = document.createElement('p');
          colorEl.innerHTML = `<strong>Cor:</strong> ${variation.color}`;
          specs.appendChild(colorEl);
        }
        
        info.appendChild(specs);
      }
      
      card.appendChild(info);
      
      // Adicionar evento de clique para redirecionar para página de detalhes do produto
      card.addEventListener('click', (e) => {
        // Ignorar se clicou nos botões de ação
        if (!e.target.closest('.quick-actions') && !e.target.closest('.action-btn')) {
          window.location.href = `/pages/product.html?id=${variation.product_id}`;
        }
      });
      
      list.appendChild(card);
    });
  } else if (productsWithoutVariations.length > 0) {
    // Se não existirem variações, mostrar produtos normais
    productsWithoutVariations.forEach(p => {
      const hasDiscount = p.original_price && p.original_price > p.price;
      const discount = hasDiscount ? Math.round((1 - p.price / p.original_price) * 100) : 0;
      
      // Usar imagem do produto se disponível, caso contrário usar um placeholder
      // Lidar com imagem única e array de imagens
      let displayImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E';
      let hasImage = false;
      if (p.image) {
        // Propriedade de imagem única
        displayImage = p.image;
        hasImage = true;
      } else if (p.images && Array.isArray(p.images) && p.images.length > 0) {
        // Array de imagens
        displayImage = p.images[0];
        hasImage = true;
      }
      
      const card = document.createElement('article');
      card.className = 'product-card';
      card.dataset.productId = p.id;
      
      // Imagem principal
      const imgWrap = document.createElement('div');
      imgWrap.className = 'product-image';
      if (!hasImage) {
        imgWrap.classList.add('placeholder');
      }
      
      const img = document.createElement('img');
      img.alt = p.name;
      img.src = displayImage;
      // Adicionar tratamento de erro para carregamento de imagem
      img.onerror = function() {
        this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E';
      };
      imgWrap.appendChild(img);
      
      if (hasDiscount) {
        const discountBadge = document.createElement('span');
        discountBadge.className = 'discount-badge';
        discountBadge.textContent = `-${discount}%`;
        imgWrap.appendChild(discountBadge);
      }
      
      // Ações rápidas
      const actions = document.createElement('div');
      actions.className = 'quick-actions';
      
      const favorite = document.createElement('button');
      favorite.innerHTML = '<i class="far fa-heart"></i>';
      favorite.title = 'Adicionar aos favoritos';
      favorite.className = 'action-btn favorite';
      favorite.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(p.id, favorite);
      });
      
      const addToCart = document.createElement('button');
      addToCart.innerHTML = '<i class="fas fa-shopping-cart"></i>';
      const stock = Number(p.stock || 0);
      if (stock <= 0) {
        addToCart.title = 'Produto fora de estoque';
        addToCart.disabled = true;
        addToCart.className = 'action-btn add-cart';
      } else {
        addToCart.title = 'Adicionar ao carrinho';
        addToCart.className = 'action-btn add-cart';
        addToCart.addEventListener('click', () => addItemToCart(p));
      }
      
      actions.appendChild(favorite);
      actions.appendChild(addToCart);
      imgWrap.appendChild(actions);
      
      card.appendChild(imgWrap);
      
      // Informações do produto
      const info = document.createElement('div');
      info.className = 'product-info';
      
      const name = document.createElement('h3');
      name.className = 'product-name';
      name.textContent = p.name;
      
      const priceInfo = document.createElement('div');
      priceInfo.className = 'price-info';
      
      const currentPrice = document.createElement('span');
      currentPrice.className = 'current-price';
      currentPrice.textContent = `R$ ${Number(p.price).toFixed(2)}`;
      
      if (hasDiscount) {
        const originalPrice = document.createElement('span');
        originalPrice.className = 'original-price';
        originalPrice.textContent = `R$ ${Number(p.original_price).toFixed(2)}`;
        priceInfo.appendChild(originalPrice);
      }
      
      priceInfo.appendChild(currentPrice);
      
      info.appendChild(name);
      info.appendChild(priceInfo);
      
      // Adicionar especificações se disponíveis
      if (p.type || p.color || (p.sizes && Array.isArray(p.sizes) && p.sizes.length > 0)) {
        const specs = document.createElement('div');
        specs.className = 'product-specs';
        specs.style.marginTop = '0.5rem';
        specs.style.fontSize = '0.875rem';
        specs.style.color = '#666';
        
        if (p.type) {
          const typeEl = document.createElement('p');
          typeEl.innerHTML = `<strong>Tipo:</strong> ${p.type}`;
          specs.appendChild(typeEl);
        }
        
        if (p.color) {
          const colorEl = document.createElement('p');
          colorEl.innerHTML = `<strong>Cor:</strong> ${p.color}`;
          specs.appendChild(colorEl);
        }
        
        if (p.sizes && Array.isArray(p.sizes) && p.sizes.length > 0) {
          const sizesEl = document.createElement('p');
          sizesEl.innerHTML = `<strong>Tamanhos:</strong> ${p.sizes.join(', ')}`;
          specs.appendChild(sizesEl);
        }
        
        info.appendChild(specs);
      }
      
      card.appendChild(info);
      
      // Adicionar evento de clique para redirecionar para página de detalhes
      card.addEventListener('click', (e) => {
        // Ignorar se clicou nos botões de ação
        if (!e.target.closest('.quick-actions') && !e.target.closest('.action-btn')) {
          window.location.href = `/pages/product.html?id=${p.id}`;
        }
      });
      
      list.appendChild(card);
    });
  } else {
    // Se não houver produtos, mostrar mensagem
    list.innerHTML = '<div class="no-products-message">Nenhum produto encontrado.</div>';
  }
}

// Carrinho
function getCart() {
  try {
    return JSON.parse(localStorage.getItem('hypex_cart') || '[]');
  } catch(e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem('hypex_cart', JSON.stringify(cart));
  renderCart();
  updateCartCount();
}

window.addItemToCart = function(product) {
  const cart = getCart();
  
  // Usar product_id + variation_id como chave única para identificar itens no carrinho
  const cartKey = product.variation_id ? `${product.id}_${product.variation_id}` : product.id;
  const found = cart.find(i => 
    i.product_id === product.id && 
    i.variation_id === product.variation_id
  );
  
  // Determinar estoque e preço com base na variação selecionada
  const stock = Number(product.stock || 0);
  const price = Number(product.price || 0);
  const currentQty = found ? found.qty : 0;
  
  // Validar se há estoque disponível
  if (stock <= 0) {
    alert('Produto fora de estoque!');
    return;
  }
  
  // Validar se a quantidade não excede o estoque
  if (currentQty >= stock) {
    alert(`Quantidade máxima disponível: ${stock} unidades`);
    return;
  }
  
  if (found) {
    found.qty++;
  } else {
    // Determinar a imagem correta para o produto/variação
    let productImage = null;
    
    if (product.image) {
      // Se o produto já tem uma imagem definida (caso do product.js)
      productImage = product.image;
    } else if (product.images && product.images.length > 0) {
      // Usar a primeira imagem do array
      productImage = product.images[0];
    } else if (product.variation_id && product.images && product.images.length > 0) {
      // Para variações, usar a imagem da variação
      productImage = product.images[0];
    } else {
      // Placeholder padrão
      productImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E';
    }
    
    cart.push({
      product_id: product.id,
      name: product.name,
      price: price,
      image: productImage,
      stock: stock, // Salvar stock para validação futura
      qty: 1,
      checked: true,
      size: product.size,
      variation_id: product.variation_id
    });
  }
  
  saveCart(cart);
  cartModal.style.display = 'block';
};

function updateCartCount() {
  try {
    const cart = JSON.parse(localStorage.getItem('hypex_cart') || '[]');
    const count = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
    const cartCountEls = document.querySelectorAll('.cart-count');
    cartCountEls.forEach(el => {
      el.textContent = count;
    });
  } catch (e) {
    console.error('Erro ao atualizar contador do carrinho:', e);
  }
}

let appliedCoupon = null;

function getAppliedCoupon() {
  try {
    return JSON.parse(localStorage.getItem('hypex_applied_coupon') || 'null');
  } catch(e) {
    return null;
  }
}

function saveAppliedCoupon(coupon) {
  if (coupon) {
    localStorage.setItem('hypex_applied_coupon', JSON.stringify(coupon));
  } else {
    localStorage.removeItem('hypex_applied_coupon');
  }
  appliedCoupon = coupon;
}

function calculateCartTotal(subtotal, coupon) {
  if (!coupon) return { subtotal, discount: 0, total: subtotal };
  
  let discount = 0;
  if (coupon.type === 'percentage') {
    discount = subtotal * (coupon.value / 100);
  } else if (coupon.type === 'fixed') {
    discount = Math.min(coupon.value, subtotal); // Não pode descontar mais que o total
  }
  
  const total = Math.max(0, subtotal - discount);
  return { subtotal, discount, total };
}

function renderCart() {
  // Ensure cart modal content exists before trying to render
  createCartModalContent();
  
  const el = document.getElementById('cart-items');
  if (!el) return; // Se o elemento não existe na página, não fazer nada
  
  const cart = getCart();
  appliedCoupon = getAppliedCoupon();
  el.innerHTML = '';
  
  if (!cart.length) {
    el.innerHTML = '<div class="empty-cart">Seu carrinho está vazio</div>';
    const subtotalEl = document.getElementById('cart-subtotal-value');
    const totalEl = document.getElementById('cart-total-value');
    const couponEl = document.getElementById('coupon-discount');
    
    if (subtotalEl) subtotalEl.textContent = 'R$ 0,00';
    if (totalEl) totalEl.textContent = 'R$ 0,00';
    if (couponEl) couponEl.style.display = 'none';
    
    // Limpar cupom se carrinho estiver vazio
    saveAppliedCoupon(null);
    updateCouponUI();
    return;
  }
  
  let subtotal = 0;
  
  cart.forEach((item, idx) => {
    const itemTotal = item.price * item.qty;
    if (item.checked) subtotal += itemTotal;
    
    const row = document.createElement('div');
    row.className = 'cart-item';
    
    // Checkbox
    const cbWrap = document.createElement('div');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!item.checked;
    cb.addEventListener('change', e => {
      item.checked = e.target.checked;
      saveCart(cart);
    });
    cbWrap.appendChild(cb);
    
    // Imagem
    const img = document.createElement('img');
    img.src = item.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="100"%3E%3Crect fill="%23f8f9fa" width="80" height="100"/%3E%3C/svg%3E';
    img.alt = item.name;
    
    // Info
    const info = document.createElement('div');
    info.className = 'item-info';
    const stock = Number(item.stock || 0);
    const canIncrease = stock > 0 && item.qty < stock;
    const canDecrease = item.qty > 1;
    
    // Construir informações adicionais do item
    let additionalInfo = '';
    if (item.size) {
      additionalInfo += `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">Tamanho: ${item.size}</div>`;
    }
    if (item.variation_id) {
      additionalInfo += `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">Variação: ${item.name.split(' - ')[1] || 'Selecionada'}</div>`;
    }
    if (stock > 0) {
      additionalInfo += `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">Estoque: ${stock}</div>`;
    }
    
    info.innerHTML = `
      <h4>${item.name}</h4>
      <div class="item-price">R$ ${Number(item.price).toFixed(2)}</div>
      ${additionalInfo}
      <div class="item-quantity">
        <button class="qty-btn" onclick="updateQuantity(${idx}, ${item.qty - 1})" ${!canDecrease ? 'disabled' : ''}>-</button>
        <span>${item.qty}</span>
        <button class="qty-btn" onclick="updateQuantity(${idx}, ${item.qty + 1})" ${!canIncrease ? 'disabled' : ''}>+</button>
      </div>
    `;
    
    // Remove
    const remove = document.createElement('button');
    remove.className = 'remove-item';
    remove.innerHTML = '<i class="fas fa-trash"></i>';
    remove.addEventListener('click', () => {
      cart.splice(idx, 1);
      saveCart(cart);
    });
    
    row.appendChild(cbWrap);
    row.appendChild(img);
    row.appendChild(info);
    row.appendChild(remove);
    el.appendChild(row);
  });
  
  // Calcular total com desconto
  const { subtotal: finalSubtotal, discount, total } = calculateCartTotal(subtotal, appliedCoupon);
  const subtotalEl = document.getElementById('cart-subtotal-value');
  const totalEl = document.getElementById('cart-total-value');
  
  if (subtotalEl) subtotalEl.textContent = `R$ ${finalSubtotal.toFixed(2)}`;

  // Verificar opção de recebimento selecionada
  const selectedDeliveryOption = document.querySelector('input[name="delivery-option"]:checked');
  const deliveryType = selectedDeliveryOption ? selectedDeliveryOption.value : 'cep';
  
  // Frete selecionado (se houver)
  let selectedShipping = null;
  try {
    selectedShipping = JSON.parse(localStorage.getItem('hypex_selected_shipping') || 'null');
  } catch(e) {}
  
  const shippingRow = document.getElementById('shipping-total');
  const shippingValueEl = document.getElementById('shipping-total-value');
  const anySelectedItems = cart.some(i => i.checked);
  let finalWithShipping = total;
  
  // Mostrar frete apenas se for opção CEP
  if (deliveryType === 'cep' && anySelectedItems && selectedShipping && typeof selectedShipping.price === 'number') {
    if (shippingRow) shippingRow.style.display = 'flex';
    if (shippingValueEl) shippingValueEl.textContent = `R$ ${selectedShipping.price.toFixed(2)}`;
    finalWithShipping = total + selectedShipping.price;
  } else {
    if (shippingRow) shippingRow.style.display = 'none';
  }
  
  if (totalEl) totalEl.textContent = `R$ ${finalWithShipping.toFixed(2)}`;
  
  // Mostrar desconto se houver cupom aplicado
  const couponDiscountEl = document.getElementById('coupon-discount');
  const couponDiscountValueEl = document.getElementById('coupon-discount-value');
  if (appliedCoupon && discount > 0) {
    if (couponDiscountEl) couponDiscountEl.style.display = 'flex';
    if (couponDiscountValueEl) couponDiscountValueEl.textContent = `-R$ ${discount.toFixed(2)}`;
  } else {
    if (couponDiscountEl) couponDiscountEl.style.display = 'none';
  }
  
  updateCouponUI();
}

// Função para atualizar UI do cupom
function updateCouponUI() {
  const couponInput = document.getElementById('coupon-code-input');
  const couponMessage = document.getElementById('coupon-message');
  const applyCouponBtn = document.getElementById('apply-coupon-btn');
  
  // Se algum dos elementos não existir, não fazer nada
  if (!couponInput || !couponMessage || !applyCouponBtn) return;
  
  if (appliedCoupon) {
    couponInput.value = appliedCoupon.code;
    couponInput.disabled = true;
    couponMessage.innerHTML = `<span style="color: #28a745;"><i class="fas fa-check-circle"></i> Cupom "${appliedCoupon.code}" aplicado!</span>`;
    applyCouponBtn.textContent = 'Remover';
  } else {
    couponInput.value = '';
    couponInput.disabled = false;
    couponMessage.innerHTML = '';
    applyCouponBtn.textContent = 'Aplicar';
  }
}

function updateQuantity(idx, newQty) {
  if (newQty < 1) {
    // Remove item se quantidade for 0
    const cart = getCart();
    cart.splice(idx, 1);
    saveCart(cart);
    return;
  }
  
  const cart = getCart();
  const item = cart[idx];
  const stock = Number(item.stock || 0);
  
  // Validar se a quantidade não excede o estoque
  if (newQty > stock) {
    alert(`Quantidade máxima disponível: ${stock} unidades`);
    return;
  }
  
  cart[idx].qty = newQty;
  saveCart(cart);
}

// Função para configurar event listeners do carrinho
function setupCartEventListeners() {
  // Event listeners para cupom (só adicionar se os elementos existirem)
  const applyCouponBtn = document.getElementById('apply-coupon-btn');
  const couponInput = document.getElementById('coupon-code-input');
  
  if (applyCouponBtn) {
    applyCouponBtn.addEventListener('click', () => {
      if (appliedCoupon) {
        removeCoupon();
      } else {
        applyCoupon();
      }
    });
  }
  
  if (couponInput) {
    couponInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (appliedCoupon) {
          removeCoupon();
        } else {
          applyCoupon();
        }
      }
    });
  }
  
  // CEP mask
  const cepInput = document.getElementById('shipping-cep-input');
  if (cepInput) {
    const savedCep = localStorage.getItem('hypex_shipping_cep');
    if (savedCep) cepInput.value = savedCep.replace(/\D/g, '').slice(0, 8);
    cepInput.addEventListener('input', () => {
      const v = cepInput.value.replace(/\D/g, '').slice(0, 8);
      cepInput.value = v; // apenas números, sem hífen
    });
  }
  
  // Calcular frete
  const calcShippingBtn = document.getElementById('calc-shipping-btn');
  if (calcShippingBtn) {
    calcShippingBtn.addEventListener('click', async () => {
      const input = document.getElementById('shipping-cep-input');
      const results = document.getElementById('shipping-results');
      if (calcShippingBtn.dataset.loading === '1') return; // evitar requisições concorrentes
      if (!input || !results) return;
      const cep = (input.value || '').replace(/\D/g, '');
      if (cep.length !== 8) {
        results.innerHTML = '<span style="color:#dc3545;">CEP inválido. Use 8 dígitos.</span>';
        return;
      }
      localStorage.setItem('hypex_shipping_cep', input.value);
      // Calcular quantidade de itens selecionados
      const cart = getCart();
      const selectedQty = cart.filter(i => i.checked).reduce((s, i) => s + Number(i.qty || 0), 0);
      if (selectedQty <= 0) {
        results.innerHTML = 'Selecione ao menos um item.';
        return;
      }
      results.textContent = 'Calculando frete...';
      calcShippingBtn.disabled = true;
      calcShippingBtn.dataset.loading = '1';
      try {
        let done = false;
        const slowTimer = setTimeout(() => {
          if (!done) {
            results.textContent = 'Ainda calculando frete... (pode demorar alguns segundos)';
          }
        }, 12000); // feedback após 12s, sem abortar

        const res = await fetch('/api/shipping/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cepDestino: cep, qtdItens: selectedQty })
        }).catch(err => { throw err; });

        done = true;
        clearTimeout(slowTimer);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao calcular frete');
        const services = (data.services || []).filter(s => !s.error && s.price != null);
        if (!services.length) {
          const details = data.details ? ` (${data.details.substring(0,120)})` : '';
          results.innerHTML = `<span style="color:#dc3545;">Não foi possível calcular o frete para este CEP.${details}</span>`;
          return;
        }
        // Render results com seleção
        results.innerHTML = services.map(s => {
          const price = Number(s.price).toFixed(2);
          const prazo = s.prazo ? `, ${s.prazo} dia(s) úteis` : '';
          return `<label style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.35rem .25rem;border:1px solid #eee;border-radius:6px;margin-bottom:.35rem;cursor:pointer;">
            <div style="display:flex;align-items:center;gap:.5rem;flex:1;">
              <input type="radio" name="shipping-option" value="${s.code}">
              <span>${s.name}${prazo}</span>
            </div>
            <strong>R$ ${price}</strong>
          </label>`;
        }).join('');
        // Restaurar seleção anterior se houver
        try {
          const prev = JSON.parse(localStorage.getItem('hypex_selected_shipping') || 'null');
          if (prev && prev.code) {
            const el = results.querySelector(`input[name="shipping-option"][value="${prev.code}"]`);
            if (el) el.checked = true;
          }
        } catch(e){}
        // Handler de seleção
        results.querySelectorAll('input[name="shipping-option"]').forEach(radio => {
          radio.addEventListener('change', (e) => {
            const code = e.target.value;
            const sel = services.find(x => String(x.code) === String(code));
            if (!sel) return;
            const selected = {
              code: String(sel.code),
              service_name: sel.name,
              price: Number(sel.price),
              prazo: sel.prazo || null,
              cepDestino: cep
            };
            localStorage.setItem('hypex_selected_shipping', JSON.stringify(selected));
            renderCart();
          });
        });
      } catch (err) {
        const isAbort = err && (err.name === 'AbortError' || String(err.message || '').includes('aborted'));
        const msg = isAbort ? 'Tempo excedido ao calcular frete. Tente novamente.' : (err.message || 'Erro ao calcular frete');
        results.innerHTML = `<span style="color:#dc3545;">${msg}</span>`;
        console.error('Erro cálculo frete:', err);
      } finally {
        calcShippingBtn.disabled = false;
        calcShippingBtn.dataset.loading = '0';
      }
    });
  }
  
  // Gerenciar opções de recebimento
  const deliveryOptions = document.querySelectorAll('input[name="delivery-option"]');
  const cepSection = document.getElementById('cep-section');
  const pickupSection = document.getElementById('pickup-section');
  const motoUberSection = document.getElementById('moto-uber-section');
  
  if (deliveryOptions.length > 0) {
    deliveryOptions.forEach(option => {
      option.addEventListener('change', (e) => {
        const selectedValue = e.target.value;
        
        // Mostrar/ocultar seções
        if (cepSection) cepSection.style.display = selectedValue === 'cep' ? 'block' : 'none';
        if (pickupSection) pickupSection.style.display = selectedValue === 'pickup' ? 'block' : 'none';
        if (motoUberSection) motoUberSection.style.display = selectedValue === 'moto-uber' ? 'block' : 'none';
        
        // Limpar seleção de frete ao trocar de opção
        if (selectedValue !== 'cep') {
          localStorage.removeItem('hypex_selected_shipping');
        }
        
        // Atualizar total do carrinho
        renderCart();
      });
    });
  }
}

// Função para aplicar cupom
async function applyCoupon() {
  const couponCode = document.getElementById('coupon-code-input').value?.trim().toUpperCase();
  const couponMessage = document.getElementById('coupon-message');
  
  if (!couponCode) {
    couponMessage.innerHTML = '<span style="color: #dc3545;">Por favor, digite um código de cupom.</span>';
    return;
  }
  
  const token = localStorage.getItem('hypex_token');
  if (!token) {
    couponMessage.innerHTML = '<span style="color: #dc3545;">Faça login para usar cupons.</span>';
    return;
  }
  
  try {
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ code: couponCode })
    });
    
    const data = await res.json();
    
    if (res.ok && data.coupon) {
      // Verificar se o cupom está ativo
      if (!data.coupon.active) {
        couponMessage.innerHTML = '<span style="color: #dc3545;">Este cupom está inativo.</span>';
        return;
      }
      
      appliedCoupon = data.coupon;
      saveAppliedCoupon(appliedCoupon);
      renderCart(); // Re-renderizar para atualizar total
      couponMessage.innerHTML = '<span style="color: #28a745;"><i class="fas fa-check-circle"></i> Cupom aplicado com sucesso!</span>';
    } else {
      throw new Error(data.error || 'Cupom inválido ou expirado');
    }
  } catch (err) {
    couponMessage.innerHTML = `<span style="color: #dc3545;">${err.message}</span>`;
    console.error('Erro ao aplicar cupom:', err);
  }
}

// Função para remover cupom
function removeCoupon() {
  appliedCoupon = null;
  saveAppliedCoupon(null);
  renderCart(); // Re-renderizar para atualizar total
  updateCouponUI();
}

// Checkout
const checkoutBtn = document.getElementById('checkout-btn');
if (checkoutBtn) {
  checkoutBtn.addEventListener('click', async () => {
    const token = localStorage.getItem('hypex_token');
    if (!token) {
      alert('Faça login antes de finalizar a compra');
      return;
    }
    
    const cart = getCart();
    const selectedItems = cart.filter(item => item.checked);
    
    if (!selectedItems.length) {
      alert('Selecione ao menos um item para finalizar a compra');
      return;
    }
    
    // Verificar opção de recebimento selecionada
    const selectedDeliveryOption = document.querySelector('input[name="delivery-option"]:checked');
    const deliveryType = selectedDeliveryOption ? selectedDeliveryOption.value : 'cep';
    
    let shippingData = null;
    
    if (deliveryType === 'cep') {
      // Frete obrigatório para opção CEP
      let selectedShipping = null;
      try {
        selectedShipping = JSON.parse(localStorage.getItem('hypex_selected_shipping') || 'null');
      } catch(e) {}
      if (!selectedShipping || !selectedShipping.code || !selectedShipping.cepDestino || typeof selectedShipping.price !== 'number') {
        alert('Selecione uma opção de frete antes de finalizar a compra.');
        return;
      }
      shippingData = {
        type: 'cep',
        cepDestino: selectedShipping.cepDestino,
        service_code: selectedShipping.code,
        service_name: selectedShipping.service_name,
        price: selectedShipping.price,
        prazo: selectedShipping.prazo
      };
    } else if (deliveryType === 'pickup') {
      // Retirada no local - sem custo de frete
      shippingData = {
        type: 'pickup',
        price: 0,
        service_name: 'Retirada no Local',
        address: 'Rua Camboja, nº 133 – Bairro Petrovale, Betim'
      };
    } else if (deliveryType === 'moto-uber') {
      // Entrega via moto/uber - sem custo de frete (a combinar)
      shippingData = {
        type: 'moto-uber',
        price: 0,
        service_name: 'Entrega via Moto/Uber (A combinar)',
        contact: '(31) 97507-4666'
      };
    }

    // Obter cupom aplicado se houver
    const coupon = getAppliedCoupon();
    const couponCode = coupon ? coupon.code : null;
    
    try {
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: selectedItems,
          address: null, // será pedido no checkout
          coupon_code: couponCode,
          shipping: shippingData
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Limpar itens comprados do carrinho e cupom aplicado
        const newCart = cart.filter(item => !item.checked);
        saveCart(newCart);
        saveAppliedCoupon(null);
        appliedCoupon = null;
        if (cartModal) cartModal.style.display = 'none';
        
        // Se for CEP, redirecionar para página de checkout com formulário
        if (deliveryType === 'cep') {
          // Calcular totais antes de salvar os dados
          const cartItems = getCart();
          const selectedCartItems = cartItems.filter(item => item.checked);
          
          // Calcular subtotal
          let subtotal = 0;
          selectedCartItems.forEach(item => {
            subtotal += item.price * item.qty;
          });
          
          // Aplicar cupom se houver
          let discountAmount = 0;
          let finalTotal = subtotal;
          
          if (coupon && coupon.code) {
            if (coupon.type === 'percentage') {
              discountAmount = subtotal * (coupon.value / 100);
            } else if (coupon.type === 'fixed') {
              discountAmount = Math.min(coupon.value, subtotal);
            }
            finalTotal = Math.max(0, subtotal - discountAmount);
          }
          
          // Adicionar frete
          const shippingPrice = shippingData ? shippingData.price : 0;
          finalTotal += shippingPrice;
          
          // Salvar dados do checkout no localStorage
          const checkoutData = {
            items: selectedItems,
            shipping: shippingData,
            coupon_code: couponCode,
            summary: {
              subtotal: subtotal,
              discount: discountAmount,
              shipping: shippingPrice,
              total: finalTotal
            }
          };
          localStorage.setItem('hypex_checkout_data', JSON.stringify(checkoutData));
          
          // Redirecionar para página de checkout
          window.location.href = '/pages/checkout.html';
        } else {
          // Para pickup e moto-uber, seguir fluxo normal de pagamento
          localStorage.setItem('hypex_pending_payment', JSON.stringify({
            pending_order_id: data.pending_order_id,
            payment: data.payment,
            order_summary: data.order_summary,
            delivery_type: deliveryType
          }));
          
          // Redirecionar para página de pagamento
          window.location.href = `/pages/payment.html?pending_order_id=${data.pending_order_id}`;
        }
      } else {
        throw new Error(data.error || 'Erro ao criar pedido');
      }
    } catch (err) {
      alert(err.message || 'Erro ao finalizar compra. Por favor, tente novamente.');
      console.error('Erro no checkout:', err);
    }
  });
}

// Carregar configurações do site
async function loadSiteSettings() {
  try {
    const response = await fetch('/api/site-settings');
    
    // Verificar se a resposta é JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // Se não for JSON, provavelmente a tabela não existe
      console.warn('Tabela site_settings não encontrada. Execute o SQL em sql/add_site_settings_table.sql');
      return; // Usar valores padrão do HTML
    }
    
    const data = await response.json();
    
    if (data.settings) {
      const settings = data.settings;
      
      // Atualizar texto do anúncio
      const announcementBar = document.querySelector('.announcement-bar p');
      if (announcementBar && settings.announcement_text?.value) {
        announcementBar.textContent = settings.announcement_text.value;
      }
      
      // Aplicar fundo personalizável do site
      applySiteBackground(settings);
      
      // Remover banner hero e seu conteúdo
      const heroBanner = document.querySelector('.hero-banner');
      if (heroBanner) {
        heroBanner.remove();
      }
    }
  } catch (err) {
    console.error('Erro ao carregar configurações do site:', err);
    // Não mostrar erro ao usuário, apenas usar valores padrão
    
    // Mesmo em caso de erro, tentar aplicar fundo padrão
    applySiteBackground({
      site_background_type: { value: 'color' },
      site_background_value: { value: '#f5f5f5' }
    });
    
    // Remover banner hero mesmo em caso de erro
    const heroBanner = document.querySelector('.hero-banner');
    if (heroBanner) {
      heroBanner.remove();
    }
  }
}

// Função para verificar se o banner hero existe e removê-lo
function removeHeroBanner() {
  const heroBanner = document.querySelector('.hero-banner');
  if (heroBanner) {
    heroBanner.remove();
  }
}

// Chamar a função para remover o banner hero assim que o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  removeHeroBanner();
});

// Função para aplicar fundo personalizável do site
function applySiteBackground(settings) {
  if (!settings) return;
  
  const body = document.body;
  
  // Remover estilos de fundo anteriores
  body.style.background = '';
  body.style.backgroundImage = '';
  body.style.backgroundColor = '';
  body.style.backgroundAttachment = '';
  body.style.backgroundSize = '';
  body.style.backgroundPosition = '';
  body.style.backgroundRepeat = '';
  
  // Remover vídeo de fundo anterior se existir
  const existingVideo = document.getElementById('site-background-video');
  if (existingVideo && existingVideo.parentNode) {
    existingVideo.parentNode.removeChild(existingVideo);
  }
  
  const backgroundType = settings.site_background_type?.value || 'color';
  const backgroundValue = settings.site_background_value?.value || '#f5f5f5';
  const videoUrl = settings.site_background_video_url?.value || '';
  
  switch (backgroundType) {
    case 'color':
      body.style.backgroundColor = backgroundValue;
      body.style.transition = 'background-color 0.3s ease';
      break;
    case 'image':
    case 'gif':
      body.style.backgroundImage = `url('${backgroundValue}')`;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundRepeat = 'no-repeat';
      body.style.backgroundAttachment = 'fixed';
      body.style.transition = 'background-image 0.3s ease';
      break;
    case 'video':
      // Criar elemento de vídeo de fundo
      if (videoUrl) {
        let videoBackground = document.getElementById('site-background-video');
        if (!videoBackground) {
          videoBackground = document.createElement('video');
          videoBackground.id = 'site-background-video';
          videoBackground.autoplay = true;
          videoBackground.loop = true;
          videoBackground.muted = true;
          videoBackground.playsInline = true;
          videoBackground.style.position = 'fixed';
          videoBackground.style.top = '0';
          videoBackground.style.left = '0';
          videoBackground.style.width = '100%';
          videoBackground.style.height = '100%';
          videoBackground.style.objectFit = 'cover';
          videoBackground.style.zIndex = '-1';
          videoBackground.style.pointerEvents = 'none'; // Não interferir com interações
          videoBackground.style.background = 'transparent'; // Fundo transparente
          videoBackground.style.filter = 'none'; // Sem filtros
          videoBackground.style.transition = 'opacity 0.3s ease';
          document.body.insertBefore(videoBackground, document.body.firstChild);
        }
        videoBackground.src = videoUrl;
        videoBackground.style.opacity = '0';
        // Fade in após carregar
        videoBackground.addEventListener('loadeddata', () => {
          videoBackground.style.opacity = '1';
        });
      }
      break;
    default:
      // Fundo padrão
      body.style.backgroundColor = '#f5f5f5';
      body.style.transition = 'background-color 0.3s ease';
  }
}

// Função para alternar favorito
window.toggleFavorite = async function(productId, buttonElement) {
  try {
    const token = localStorage.getItem('hypex_token');
    if (!token) {
      alert('Faça login para adicionar produtos aos favoritos');
      window.location.href = '/pages/auth.html?redirect=' + encodeURIComponent(window.location.href);
      return;
    }

    const response = await fetch('/api/favorites/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ productId })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao atualizar favorito');
    }

    // Atualizar o ícone do favorito
    const icon = buttonElement.querySelector('i');
    if (data.isFavorite) {
      icon.classList.remove('far');
      icon.classList.add('fas');
      buttonElement.title = 'Remover dos favoritos';
    } else {
      icon.classList.remove('fas');
      icon.classList.add('far');
      buttonElement.title = 'Adicionar aos favoritos';
    }
  } catch (error) {
    console.error('Erro ao alternar favorito:', error);
    alert(error.message || 'Erro ao atualizar favorito. Por favor, tente novamente.');
  }
}

// Função para verificar e atualizar status de favoritos nos produtos
async function updateFavoritesStatus() {
  const token = localStorage.getItem('hypex_token');
  if (!token) return;

  try {
    const response = await fetch('/api/favorites/', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    const favoriteProductIds = (data.favorites || []).map(f => f.product_id);

    // Atualizar ícones de favorito na página
    document.querySelectorAll('.product-card').forEach(card => {
      const productId = card.dataset?.productId;
      if (!productId) return;

      const favoriteBtn = card.querySelector('.action-btn.favorite');
      if (favoriteBtn && favoriteProductIds.includes(productId)) {
        const icon = favoriteBtn.querySelector('i');
        if (icon) {
          icon.classList.remove('far');
          icon.classList.add('fas');
          favoriteBtn.title = 'Remover dos favoritos';
        }
      }
    });
  } catch (error) {
    console.error('Erro ao verificar favoritos:', error);
  }
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM Content Loaded - Initializing app...');
  await loadSiteSettings(); // Carregar configurações primeiro
  console.log('Site settings loaded');
  
  // Verificar se há um termo de busca na URL
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('search');
  
  if (searchQuery) {
    // Se houver termo de busca, realizar a busca
    document.getElementById('search-input').value = searchQuery;
    await searchProducts(searchQuery);
  } else {
    // Caso contrário, carregar produtos normalmente
    await loadProducts();
  }
  
  console.log('Products loaded');
  appliedCoupon = getAppliedCoupon();
  // Initialize cart modal content
  createCartModalContent();
  renderCart();
  updateFavoritesStatus();
  
  // Reaplicar fundo ao carregar a página para garantir
  setTimeout(() => {
    fetch('/api/site-settings')
      .then(response => response.json())
      .then(data => {
        if (data.settings) {
          applySiteBackground(data.settings);
        }
      })
      .catch(err => console.error('Erro ao reaplicar fundo:', err));
  }, 100);
  
  // Reaplicar fundo ao redimensionar a janela
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      fetch('/api/site-settings')
        .then(response => response.json())
        .then(data => {
          if (data.settings) {
            applySiteBackground(data.settings);
          }
        })
        .catch(err => console.error('Erro ao reaplicar fundo ao redimensionar:', err));
    }, 300); // Debounce de 300ms
  });
  
  // Reaplicar fundo ao focar na janela
  window.addEventListener('focus', () => {
    fetch('/api/site-settings')
      .then(response => response.json())
      .then(data => {
        if (data.settings) {
          applySiteBackground(data.settings);
        }
      })
      .catch(err => console.error('Erro ao reaplicar fundo ao focar:', err));
  });
  
  // Gerenciar opções de recebimento
  const deliveryOptions = document.querySelectorAll('input[name="delivery-option"]');
  const cepSection = document.getElementById('cep-section');
  const pickupSection = document.getElementById('pickup-section');
  const motoUberSection = document.getElementById('moto-uber-section');
  
  if (deliveryOptions.length > 0) {
    deliveryOptions.forEach(option => {
      option.addEventListener('change', (e) => {
        const selectedValue = e.target.value;
        
        // Mostrar/ocultar seções
        if (cepSection) cepSection.style.display = selectedValue === 'cep' ? 'block' : 'none';
        if (pickupSection) pickupSection.style.display = selectedValue === 'pickup' ? 'block' : 'none';
        if (motoUberSection) motoUberSection.style.display = selectedValue === 'moto-uber' ? 'block' : 'none';
        
        // Limpar seleção de frete ao trocar de opção
        if (selectedValue !== 'cep') {
          localStorage.removeItem('hypex_selected_shipping');
        }
        
        // Atualizar total do carrinho
        renderCart();
      });
    });
  }
  
  // Adicionar evento de busca à barra de pesquisa
  const searchInput = document.getElementById('search-input');
  const searchButton = document.getElementById('search-button');
  
  if (searchInput && searchButton) {
    // Busca ao clicar no botão
    searchButton.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (query) {
        // Atualizar URL com o termo de busca
        const url = new URL(window.location);
        url.searchParams.set('search', query);
        window.history.replaceState({}, '', url);
        
        searchProducts(query);
      }
    });
    
    // Busca ao pressionar Enter
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          // Redirecionar para a página de pesquisa
          window.location.href = `/pages/pesquisa.html?q=${encodeURIComponent(query)}`;
        }
      }
    });
    
    // Limpar busca ao clicar no botão de limpar (X no input)
    searchInput.addEventListener('search', () => {
      if (searchInput.value === '') {
        // Remover parâmetro de busca da URL
        const url = new URL(window.location);
        url.searchParams.delete('search');
        window.history.replaceState({}, '', url);
        
        // Recarregar produtos normalmente
        loadProducts();
      }
    });
    
    // Botão de busca
    document.getElementById('search-button')?.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (query) {
        // Redirecionar para a página de pesquisa
        window.location.href = `/pages/pesquisa.html?q=${encodeURIComponent(query)}`;
      }
    });
  }
  
  // Event listeners para cupom (só adicionar se os elementos existirem)
  const applyCouponBtn = document.getElementById('apply-coupon-btn');
  const couponInput = document.getElementById('coupon-code-input');
  
  if (applyCouponBtn) {
    applyCouponBtn.addEventListener('click', () => {
      if (appliedCoupon) {
        removeCoupon();
      } else {
        applyCoupon();
      }
    });
  }
  
  if (couponInput) {
    couponInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (appliedCoupon) {
          removeCoupon();
        } else {
          applyCoupon();
        }
      }
    });
  }

  // CEP mask
  const cepInput = document.getElementById('shipping-cep-input');
  if (cepInput) {
    const savedCep = localStorage.getItem('hypex_shipping_cep');
    if (savedCep) cepInput.value = savedCep.replace(/\D/g, '').slice(0, 8);
    cepInput.addEventListener('input', () => {
      const v = cepInput.value.replace(/\D/g, '').slice(0, 8);
      cepInput.value = v; // apenas números, sem hífen
    });
  }
  
  // Calcular frete
  const calcShippingBtn = document.getElementById('calc-shipping-btn');
  if (calcShippingBtn) {
    calcShippingBtn.addEventListener('click', async () => {
      const input = document.getElementById('shipping-cep-input');
      const results = document.getElementById('shipping-results');
      if (calcShippingBtn.dataset.loading === '1') return; // evitar requisições concorrentes
      if (!input || !results) return;
      const cep = (input.value || '').replace(/\D/g, '');
      if (cep.length !== 8) {
        results.innerHTML = '<span style="color:#dc3545;">CEP inválido. Use 8 dígitos.</span>';
        return;
      }
      localStorage.setItem('hypex_shipping_cep', input.value);
      // Calcular quantidade de itens selecionados
      const cart = getCart();
      const selectedQty = cart.filter(i => i.checked).reduce((s, i) => s + Number(i.qty || 0), 0);
      if (selectedQty <= 0) {
        results.innerHTML = 'Selecione ao menos um item.';
        return;
      }
      results.textContent = 'Calculando frete...';
      calcShippingBtn.disabled = true;
      calcShippingBtn.dataset.loading = '1';
      try {
        let done = false;
        const slowTimer = setTimeout(() => {
          if (!done) {
            results.textContent = 'Ainda calculando frete... (pode demorar alguns segundos)';
          }
        }, 12000); // feedback após 12s, sem abortar

        const res = await fetch('/api/shipping/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cepDestino: cep, qtdItens: selectedQty })
        }).catch(err => { throw err; });

        done = true;
        clearTimeout(slowTimer);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao calcular frete');
        const services = (data.services || []).filter(s => !s.error && s.price != null);
        if (!services.length) {
          const details = data.details ? ` (${data.details.substring(0,120)})` : '';
          results.innerHTML = `<span style="color:#dc3545;">Não foi possível calcular o frete para este CEP.${details}</span>`;
          return;
        }
        // Render results com seleção
        results.innerHTML = services.map(s => {
          const price = Number(s.price).toFixed(2);
          const prazo = s.prazo ? `, ${s.prazo} dia(s) úteis` : '';
          return `<label style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.35rem .25rem;border:1px solid #eee;border-radius:6px;margin-bottom:.35rem;cursor:pointer;">
            <div style="display:flex;align-items:center;gap:.5rem;flex:1;">
              <input type="radio" name="shipping-option" value="${s.code}">
              <span>${s.name}${prazo}</span>
            </div>
            <strong>R$ ${price}</strong>
          </label>`;
        }).join('');
        // Restaurar seleção anterior se houver
        try {
          const prev = JSON.parse(localStorage.getItem('hypex_selected_shipping') || 'null');
          if (prev && prev.code) {
            const el = results.querySelector(`input[name="shipping-option"][value="${prev.code}"]`);
            if (el) el.checked = true;
          }
        } catch(e){}
        // Handler de seleção
        results.querySelectorAll('input[name="shipping-option"]').forEach(radio => {
          radio.addEventListener('change', (e) => {
            const code = e.target.value;
            const sel = services.find(x => String(x.code) === String(code));
            if (!sel) return;
            const selected = {
              code: String(sel.code),
              service_name: sel.name,
              price: Number(sel.price),
              prazo: sel.prazo || null,
              cepDestino: cep
            };
            localStorage.setItem('hypex_selected_shipping', JSON.stringify(selected));
            renderCart();
          });
        });
      } catch (err) {
        const isAbort = err && (err.name === 'AbortError' || String(err.message || '').includes('aborted'));
        const msg = isAbort ? 'Tempo excedido ao calcular frete. Tente novamente.' : (err.message || 'Erro ao calcular frete');
        results.innerHTML = `<span style="color:#dc3545;">${msg}</span>`;
        console.error('Erro cálculo frete:', err);
      } finally {
        calcShippingBtn.disabled = false;
        calcShippingBtn.dataset.loading = '0';
      }
    });
  }
});