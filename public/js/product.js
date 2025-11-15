// Carregar dados do produto
let currentProduct = null;
let selectedSize = null;
let selectedVariation = null;
let isFavorite = false;

// Função para atualizar contador do carrinho
function updateCartCount() {
  try {
    const cart = JSON.parse(localStorage.getItem('hypex_cart') || '[]');
    const count = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
    const cartCountEl = document.querySelector('.cart-count');
    if (cartCountEl) {
      cartCountEl.textContent = count;
    }
  } catch (e) {
    console.error('Erro ao atualizar contador do carrinho:', e);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  if (!productId) {
    showError();
    return;
  }

  await loadProduct(productId);
  await checkFavoriteStatus(productId);
  updateCartCount(); // Atualizar contador ao carregar a página
});

async function loadProduct(productId) {
  try {
    const response = await fetch(`/api/products/${productId}`);
    const data = await response.json();

    if (!response.ok || !data.product) {
      showError();
      return;
    }

    currentProduct = data.product;
    renderProduct(data.product);
  } catch (error) {
    console.error('Erro ao carregar produto:', error);
    showError();
  }
}

function renderProduct(product) {
  // Esconder loading e mostrar conteúdo
  const loadingElement = document.getElementById('product-loading');
  const detailElement = document.getElementById('product-detail');
  const errorElement = document.getElementById('product-error');
  
  if (loadingElement) loadingElement.style.display = 'none';
  if (detailElement) detailElement.style.display = 'grid';
  if (errorElement) errorElement.style.display = 'none';

  // Título
  const titleElement = document.getElementById('product-title');
  if (titleElement) titleElement.textContent = product.name;

  // Preço (will be updated based on variation selection)
  const priceElement = document.getElementById('product-price');
  const basePrice = Number(product.price || 0);
  if (priceElement) priceElement.textContent = `R$ ${basePrice.toFixed(2)}`;

  // Desconto (se aplicável)
  const hasDiscount = product.original_price && product.original_price > product.price;
  const discount = hasDiscount ? Math.round((1 - product.price / product.original_price) * 100) : 0;
  
  const originalPriceElement = document.getElementById('product-original-price');
  const discountBadgeElement = document.getElementById('product-discount-badge');
  
  if (hasDiscount && originalPriceElement && discountBadgeElement) {
    originalPriceElement.textContent = `R$ ${Number(product.original_price).toFixed(2)}`;
    originalPriceElement.style.display = 'inline';
    discountBadgeElement.textContent = `-${discount}% OFF`;
    discountBadgeElement.style.display = 'inline';
  } else if (originalPriceElement && discountBadgeElement) {
    originalPriceElement.style.display = 'none';
    discountBadgeElement.style.display = 'none';
  }

  // Estoque (will be updated based on variation selection)
  const stock = Number(product.stock || 0);
  const stockElement = document.getElementById('product-stock');
  if (stockElement) {
    if (stock > 0) {
      stockElement.textContent = `✓ Em estoque (${stock} unidades)`;
      stockElement.className = 'product-stock in-stock';
    } else {
      stockElement.textContent = '✗ Fora de estoque';
      stockElement.className = 'product-stock out-of-stock';
    }
  }

  // Imagens - usar a imagem do produto se existir, senão usar a imagem da primeira variação
  let images = product.images || [];
  let isVariationImage = false;
  
  // Se o produto não tem imagens próprias mas tem variações, usar as imagens da primeira variação
  if (images.length === 0 && product.variations && Array.isArray(product.variations) && product.variations.length > 0) {
    const firstVariation = product.variations[0];
    if (firstVariation.images && firstVariation.images.length > 0) {
      images = firstVariation.images;
      isVariationImage = true;
    }
  }
  
  const mainImageElement = document.getElementById('product-main-image');
  if (mainImageElement) {
    // Sempre atualizar a imagem principal com a primeira imagem disponível
    if (images.length > 0) {
      mainImageElement.src = images[0];
    } else {
      // Se não houver imagens, mostrar imagem padrão
      mainImageElement.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="800"%3E%3Crect fill="%23f8f9fa" width="600" height="800"/%3E%3C/svg%3E';
    }
    mainImageElement.alt = product.name;
  }

  // Thumbnails - hide container since we're using navigation controls
  const thumbnailsContainer = document.getElementById('product-thumbnails');
  if (thumbnailsContainer) {
    // Only hide if there are multiple images
    if (images.length > 1) {
      thumbnailsContainer.style.display = 'none';
    } else {
      thumbnailsContainer.style.display = 'block';
    }
  }

  // Adicionar controles de navegação para múltiplas imagens
  addImageNavigationControls(images, mainImageElement, thumbnailsContainer);

  // Especificações
  const brandElement = document.getElementById('product-brand');
  const brandSpecElement = document.getElementById('product-brand-spec');
  if (product.brand && brandElement && brandSpecElement) {
    brandElement.textContent = product.brand;
    brandSpecElement.style.display = 'flex';
  }

  const typeElement = document.getElementById('product-type');
  const typeSpecElement = document.getElementById('product-type-spec');
  if (product.type && typeElement && typeSpecElement) {
    typeElement.textContent = product.type;
    typeSpecElement.style.display = 'flex';
  }

  const colorElement = document.getElementById('product-color');
  const colorSpecElement = document.getElementById('product-color-spec');
  if (product.color && colorElement && colorSpecElement) {
    colorElement.textContent = product.color;
    colorSpecElement.style.display = 'flex';
  }

  // Tamanhos (do produto base)
  const sizesSpecElement = document.getElementById('product-sizes-spec');
  const sizesContainer = document.getElementById('product-sizes');
  if (product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0 && sizesContainer && sizesSpecElement) {
    sizesContainer.innerHTML = product.sizes.map(size => `
      <span class="size-tag" data-size="${size}">${size}</span>
    `).join('');

    // Event listeners para tamanhos
    sizesContainer.querySelectorAll('.size-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        sizesContainer.querySelectorAll('.size-tag').forEach(t => t.classList.remove('selected'));
        tag.classList.add('selected');
        selectedSize = tag.dataset.size;
        selectedVariation = null; // Reset variation selection when base size is selected
        updateProductDetails(); // Update price and stock based on selection
        
        // Se não estiver usando imagens de variação, atualizar para as imagens do produto base
        if (!isVariationImage && product.images && product.images.length > 0) {
          updateMainImageDisplay(product.images, 0);
        }
      });
    });

    sizesSpecElement.style.display = 'flex';
  }

  // Variações do produto (se existirem)
  const variationsSpecElement = document.getElementById('product-variations-spec');
  const variationsContainer = document.getElementById('product-variations');
  
  if (product.variations && Array.isArray(product.variations) && product.variations.length > 0 && variationsContainer && variationsSpecElement) {
    variationsContainer.innerHTML = product.variations.map(variation => {
      const variationPrice = Number(variation.price || product.price || 0);
      const variationStock = Number(variation.stock || 0);
      const hasDiscount = variationPrice < Number(product.price || 0);
      const discount = hasDiscount ? Math.round((1 - variationPrice / Number(product.price || 0)) * 100) : 0;
      
      // Get the first image for this variation if available
      const variationImage = variation.images && variation.images.length > 0 ? variation.images[0] : null;
      
      return `
        <div class="variation-option" 
             data-variation-id="${variation.id}"
             data-price="${variationPrice}"
             data-stock="${variationStock}"
             style="border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; cursor: pointer; transition: all 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>${variation.name}</strong>
              ${variation.color ? `<div>Cor: ${variation.color}</div>` : ''}
              ${variation.size ? `<div>Tamanho: ${variation.size}</div>` : ''}
              ${variationImage ? `<div style="margin-top: 0.5rem;"><img src="${variationImage}" alt="${variation.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;"></div>` : ''}
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent);">
                R$ ${variationPrice.toFixed(2)}
              </div>
              ${hasDiscount ? `
                <div style="font-size: 0.875rem; color: #999; text-decoration: line-through;">
                  R$ ${Number(product.price || 0).toFixed(2)}
                </div>
                <div style="background: #ff6b6b; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; display: inline-block; margin-top: 0.25rem;">
                  -${discount}%
                </div>
              ` : ''}
              <div style="font-size: 0.875rem; margin-top: 0.25rem;">
                ${variationStock > 0 ? `✓ ${variationStock} em estoque` : '✗ Fora de estoque'}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Event listeners para variações
    document.querySelectorAll('.variation-option').forEach(option => {
      option.addEventListener('click', () => {
        // Remover seleção de tamanho base
        const sizeTags = document.querySelectorAll('.size-tag');
        if (sizeTags.length > 0) {
          sizeTags.forEach(t => t.classList.remove('selected'));
          selectedSize = null;
        }
        
        // Selecionar variação
        const variationOptions = document.querySelectorAll('.variation-option');
        if (variationOptions.length > 0) {
          variationOptions.forEach(o => o.style.border = '1px solid #ddd');
          option.style.border = '2px solid var(--accent)';
        }
        
        selectedVariation = {
          id: option.dataset.variationId,
          price: Number(option.dataset.price),
          stock: Number(option.dataset.stock)
        };
        
        // Update main image if variation has an image
        const variation = product.variations.find(v => v.id === selectedVariation.id);
        if (variation && variation.images && variation.images.length > 0) {
          updateMainImageDisplay(variation.images, 0);
          // Atualizar thumbnails - hide container since we're using navigation controls
          if (thumbnailsContainer) {
            // Only hide if there are multiple images
            if (variation.images.length > 1) {
              thumbnailsContainer.style.display = 'none';
            } else {
              thumbnailsContainer.style.display = 'block';
            }
          }
          // Adicionar controles de navegação para as imagens da variação
          addImageNavigationControls(variation.images, mainImageElement, thumbnailsContainer);
        }
        
        updateProductDetails(); // Update price and stock based on variation selection
      });
    });

    // Selecionar automaticamente a primeira variação
    if (product.variations.length > 0) {
      const firstOption = document.querySelector('.variation-option');
      if (firstOption) {
        // Disparar o evento de clique na primeira variação
        firstOption.click();
      }
    }

    variationsSpecElement.style.display = 'flex';
  } else if (variationsSpecElement) {
    // Hide variations section if no variations exist
    variationsSpecElement.style.display = 'none';
  }

  // Descrição
  const descriptionTextElement = document.getElementById('product-description-text');
  const descriptionElement = document.getElementById('product-description');
  if (product.description && descriptionTextElement && descriptionElement) {
    descriptionTextElement.textContent = product.description;
    descriptionElement.style.display = 'block';
  }

  // Botão de adicionar ao carrinho
  const addCartBtn = document.getElementById('btn-add-cart');
  if (addCartBtn) {
    if (stock <= 0 && (!product.variations || product.variations.length === 0)) {
      addCartBtn.disabled = true;
      addCartBtn.innerHTML = '<i class="fas fa-ban"></i><span>Fora de Estoque</span>';
    } else {
      addCartBtn.disabled = false;
      addCartBtn.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Adicionar ao Carrinho</span>';
    }
  }

  // Configurar event listeners após renderizar
  setupEventListeners();
}

// Função para atualizar a exibição da imagem principal
function updateMainImageDisplay(images, activeIndex) {
  const mainImageElement = document.getElementById('product-main-image');
  if (mainImageElement && images.length > 0) {
    mainImageElement.src = images[activeIndex] || images[0];
  }
}

// Função para adicionar controles de navegação de imagens
function addImageNavigationControls(images, mainImageElement, thumbnailsContainer) {
  // Remover controles existentes
  const existingControls = document.querySelector('.image-navigation-controls');
  if (existingControls) {
    existingControls.remove();
  }
  
  // Só adicionar controles se houver mais de uma imagem
  if (images.length <= 1) return;
  
  // Criar controles de navegação
  const navControls = document.createElement('div');
  navControls.className = 'image-navigation-controls';
  navControls.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1rem;
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    transform: translateY(-50%);
    padding: 0 1rem;
    pointer-events: none;
    z-index: 10;
  `;
  
  const prevButton = document.createElement('button');
  prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
  prevButton.className = 'btn-nav prev';
  prevButton.style.cssText = `
    background: rgba(0,0,0,0.5);
    color: white;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  `;
  
  const nextButton = document.createElement('button');
  nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
  nextButton.className = 'btn-nav next';
  nextButton.style.cssText = `
    background: rgba(0,0,0,0.5);
    color: white;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  `;
  
  navControls.appendChild(prevButton);
  navControls.appendChild(nextButton);
  
  // Adicionar controles ao container de imagens
  const imagesContainer = document.querySelector('.main-image');
  if (imagesContainer) {
    imagesContainer.style.position = 'relative';
    imagesContainer.appendChild(navControls);
  }
  
  // Estado da navegação
  let currentIndex = 0;
  
  // Função para atualizar a imagem exibida
  function updateImage(index) {
    if (mainImageElement && images[index]) {
      mainImageElement.src = images[index];
      currentIndex = index;
    }
  }
  
  // Event listeners para os botões
  prevButton.addEventListener('click', () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    updateImage(newIndex);
  });
  
  nextButton.addEventListener('click', () => {
    const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    updateImage(newIndex);
  });
  
  // Adicionar navegação por teclado
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.product-detail-container') && 
        document.querySelector('.product-detail-container').style.display !== 'none') {
      if (e.key === 'ArrowLeft') {
        const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
        updateImage(newIndex);
      } else if (e.key === 'ArrowRight') {
        const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
        updateImage(newIndex);
      }
    }
  });
}

// Função para atualizar detalhes do produto com base na seleção
function updateProductDetails() {
  if (!currentProduct) return;

  const priceElement = document.getElementById('product-price');
  const originalPriceElement = document.getElementById('product-original-price');
  const discountBadgeElement = document.getElementById('product-discount-badge');
  const stockElement = document.getElementById('product-stock');

  // Resetar descontos
  if (originalPriceElement) originalPriceElement.style.display = 'none';
  if (discountBadgeElement) discountBadgeElement.style.display = 'none';

  if (selectedVariation) {
    // Usar dados da variação selecionada
    const variationPrice = selectedVariation.price;
    const variationStock = selectedVariation.stock;
    
    if (priceElement) priceElement.textContent = `R$ ${variationPrice.toFixed(2)}`;
    
    // Verificar se há desconto em relação ao preço base
    const basePrice = Number(currentProduct.price || 0);
    if (variationPrice < basePrice && variationPrice > 0 && originalPriceElement && discountBadgeElement) {
      const discount = Math.round((1 - variationPrice / basePrice) * 100);
      originalPriceElement.textContent = `R$ ${basePrice.toFixed(2)}`;
      originalPriceElement.style.display = 'inline';
      discountBadgeElement.textContent = `-${discount}% OFF`;
      discountBadgeElement.style.display = 'inline';
    }
    
    // Atualizar estoque
    if (stockElement) {
      if (variationStock > 0) {
        stockElement.textContent = `✓ Em estoque (${variationStock} unidades)`;
        stockElement.className = 'product-stock in-stock';
      } else {
        stockElement.textContent = '✗ Fora de estoque';
        stockElement.className = 'product-stock out-of-stock';
      }
    }
    
    // Atualizar botão do carrinho
    const addCartBtn = document.getElementById('btn-add-cart');
    if (addCartBtn) {
      if (variationStock <= 0) {
        addCartBtn.disabled = true;
        addCartBtn.innerHTML = '<i class="fas fa-ban"></i><span>Fora de Estoque</span>';
      } else {
        addCartBtn.disabled = false;
        addCartBtn.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Adicionar ao Carrinho</span>';
      }
    }
  } else if (selectedSize) {
    // Usar dados do produto base (tamanho selecionado)
    const basePrice = Number(currentProduct.price || 0);
    const baseStock = Number(currentProduct.stock || 0);
    
    if (priceElement) priceElement.textContent = `R$ ${basePrice.toFixed(2)}`;
    
    // Verificar desconto base
    if (currentProduct.original_price && currentProduct.original_price > basePrice && originalPriceElement && discountBadgeElement) {
      const discount = Math.round((1 - basePrice / currentProduct.original_price) * 100);
      originalPriceElement.textContent = `R$ ${Number(currentProduct.original_price).toFixed(2)}`;
      originalPriceElement.style.display = 'inline';
      discountBadgeElement.textContent = `-${discount}% OFF`;
      discountBadgeElement.style.display = 'inline';
    }
    
    // Atualizar estoque
    if (stockElement) {
      if (baseStock > 0) {
        stockElement.textContent = `✓ Em estoque (${baseStock} unidades)`;
        stockElement.className = 'product-stock in-stock';
      } else {
        stockElement.textContent = '✗ Fora de estoque';
        stockElement.className = 'product-stock out-of-stock';
      }
    }
    
    // Atualizar botão do carrinho
    const addCartBtn = document.getElementById('btn-add-cart');
    if (addCartBtn) {
      if (baseStock <= 0) {
        addCartBtn.disabled = true;
        addCartBtn.innerHTML = '<i class="fas fa-ban"></i><span>Fora de Estoque</span>';
      } else {
        addCartBtn.disabled = false;
        addCartBtn.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Adicionar ao Carrinho</span>';
      }
    }
  } else {
    // Nenhuma variação ou tamanho selecionado, usar dados base
    const basePrice = Number(currentProduct.price || 0);
    const baseStock = Number(currentProduct.stock || 0);
    
    if (priceElement) priceElement.textContent = `R$ ${basePrice.toFixed(2)}`;
    
    // Verificar desconto base
    if (currentProduct.original_price && currentProduct.original_price > basePrice && originalPriceElement && discountBadgeElement) {
      const discount = Math.round((1 - basePrice / currentProduct.original_price) * 100);
      originalPriceElement.textContent = `R$ ${Number(currentProduct.original_price).toFixed(2)}`;
      originalPriceElement.style.display = 'inline';
      discountBadgeElement.textContent = `-${discount}% OFF`;
      discountBadgeElement.style.display = 'inline';
    }
    
    // Atualizar estoque
    if (stockElement) {
      if (baseStock > 0) {
        stockElement.textContent = `✓ Em estoque (${baseStock} unidades)`;
        stockElement.className = 'product-stock in-stock';
      } else {
        stockElement.textContent = '✗ Fora de estoque';
        stockElement.className = 'product-stock out-of-stock';
      }
    }
    
    // Atualizar botão do carrinho
    const addCartBtn = document.getElementById('btn-add-cart');
    if (addCartBtn) {
      if (baseStock <= 0) {
        addCartBtn.disabled = true;
        addCartBtn.innerHTML = '<i class="fas fa-ban"></i><span>Fora de Estoque</span>';
      } else {
        addCartBtn.disabled = false;
        addCartBtn.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Adicionar ao Carrinho</span>';
      }
    }
  }
}

function setupEventListeners() {
  // Botão de adicionar ao carrinho
  const addCartBtn = document.getElementById('btn-add-cart');
  if (addCartBtn) {
    // Remover event listeners anteriores se existirem
    const newAddCartBtn = addCartBtn.cloneNode(true);
    if (addCartBtn.parentNode) {
      addCartBtn.parentNode.replaceChild(newAddCartBtn, addCartBtn);
    }
    
    newAddCartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!currentProduct) {
        console.error('Produto não carregado');
        return;
      }

      // Verificar se o produto tem variações - se tiver, é obrigatório selecionar uma variação
      if (currentProduct.variations && Array.isArray(currentProduct.variations) && currentProduct.variations.length > 0) {
        if (!selectedVariation) {
          alert('Por favor, selecione uma variação do produto antes de adicionar ao carrinho.');
          return;
        }
      }

      // Determinar estoque com base na seleção
      let stock = Number(currentProduct.stock || 0);
      let price = Number(currentProduct.price || 0);
      let variationId = null;
      let variationName = null;
      
      if (selectedVariation) {
        stock = selectedVariation.stock;
        price = selectedVariation.price;
        variationId = selectedVariation.id;
        // Encontrar o nome da variação
        if (currentProduct.variations) {
          const variation = currentProduct.variations.find(v => v.id === variationId);
          if (variation) {
            variationName = variation.name;
          }
        }
      } else if (selectedSize) {
        // Se um tamanho foi selecionado, manter os dados base
      }

      // Verificar se há estoque
      if (stock <= 0) {
        alert('Produto fora de estoque!');
        return;
      }

      // Adicionar ao carrinho
      // Determinar a imagem correta para o produto/variação
      let productImage = null;
      
      if (selectedVariation && currentProduct.variations) {
        // Se uma variação está selecionada, usar a imagem da variação
        const variation = currentProduct.variations.find(v => v.id === variationId);
        if (variation) {
          // Usar a primeira imagem da variação se disponível
          productImage = (variation.images && variation.images.length > 0) ? variation.images[0] : null;
        }
      }
      
      // Se não temos imagem da variação, tentar usar a imagem do produto base
      if (!productImage && currentProduct.images && currentProduct.images.length > 0) {
        productImage = currentProduct.images[0];
      }
      
      // Se ainda não temos imagem, usar placeholder
      if (!productImage) {
        productImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E';
      }
      
      const productToAdd = {
        id: currentProduct.id,
        name: variationName ? `${currentProduct.name} - ${variationName}` : currentProduct.name,
        price: price,
        image: productImage,
        stock: stock,
        qty: 1,
        checked: true,
        size: selectedSize,
        variation_id: variationId
      };

      // Usar a função do app.js se disponível
      if (typeof window.addItemToCart === 'function') {
        window.addItemToCart(productToAdd);
      } else {
        // Fallback se a função não estiver disponível
        try {
          let cart = JSON.parse(localStorage.getItem('hypex_cart') || '[]');
          
          // Verificar se o item já está no carrinho
          const existingItemIndex = cart.findIndex(item => 
            item.product_id === productToAdd.id && 
            item.variation_id === productToAdd.variation_id &&
            item.size === productToAdd.size
          );
          
          if (existingItemIndex >= 0) {
            // Verificar se há estoque suficiente
            if (cart[existingItemIndex].qty >= stock) {
              alert(`Quantidade máxima disponível: ${stock} unidades`);
              return;
            }
            cart[existingItemIndex].qty += 1;
          } else {
            cart.push({
              product_id: productToAdd.id,
              name: productToAdd.name,
              price: productToAdd.price,
              image: productToAdd.image,
              stock: productToAdd.stock,
              qty: 1,
              checked: true,
              size: productToAdd.size,
              variation_id: productToAdd.variation_id
            });
          }
          
          localStorage.setItem('hypex_cart', JSON.stringify(cart));
          alert('Produto adicionado ao carrinho!');
          
          // Atualizar contador do carrinho
          updateCartCount();
        } catch (error) {
          console.error('Erro ao adicionar ao carrinho:', error);
          alert('Erro ao adicionar produto ao carrinho. Por favor, tente novamente.');
        }
      }
    });
  }

  // Botão de favorito
  const favoriteBtn = document.getElementById('btn-favorite');
  if (favoriteBtn && currentProduct) {
    // Remover event listeners anteriores se existirem
    const newFavoriteBtn = favoriteBtn.cloneNode(true);
    if (favoriteBtn.parentNode) {
      favoriteBtn.parentNode.replaceChild(newFavoriteBtn, favoriteBtn);
    }
    
    newFavoriteBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!currentProduct) {
        console.error('Produto não carregado');
        return;
      }

      try {
        const token = localStorage.getItem('hypex_token');
        if (!token) {
          alert('Você precisa estar logado para adicionar aos favoritos');
          window.location.href = '/pages/auth.html';
          return;
        }

        // Usar função do app.js se disponível
        if (typeof window.toggleFavorite === 'function') {
          try {
            await window.toggleFavorite(currentProduct.id, newFavoriteBtn);
            // O toggleFavorite do app.js já atualiza o ícone, mas precisamos atualizar o estado local
            const icon = newFavoriteBtn.querySelector('i');
            if (icon) {
              if (icon.classList.contains('fas')) {
                isFavorite = true;
                newFavoriteBtn.classList.add('active');
              } else {
                isFavorite = false;
                newFavoriteBtn.classList.remove('active');
              }
            }
          } catch (error) {
            console.error('Erro ao usar toggleFavorite do app.js:', error);
            // Fallback para API direta
            await toggleFavoriteFallback(currentProduct.id, newFavoriteBtn);
          }
        } else {
          // Fallback: usar API diretamente
          await toggleFavoriteFallback(currentProduct.id, newFavoriteBtn);
        }
      } catch (error) {
        console.error('Erro ao atualizar favorito:', error);
        alert('Erro ao atualizar favoritos');
      }
    });
  }
}

// Função fallback para alternar favorito
async function toggleFavoriteFallback(productId, buttonElement) {
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
    if (icon) {
      if (data.isFavorite) {
        icon.classList.remove('far');
        icon.classList.add('fas');
        buttonElement.title = 'Remover dos favoritos';
        buttonElement.classList.add('active');
        isFavorite = true;
      } else {
        icon.classList.remove('fas');
        icon.classList.add('far');
        buttonElement.title = 'Adicionar aos favoritos';
        buttonElement.classList.remove('active');
        isFavorite = false;
      }
    }
  } catch (error) {
    console.error('Erro ao alternar favorito:', error);
    alert(error.message || 'Erro ao atualizar favorito. Por favor, tente novamente.');
  }
}

// Função para verificar status de favorito
async function checkFavoriteStatus(productId) {
  try {
    const token = localStorage.getItem('hypex_token');
    if (!token) return;

    const response = await fetch('/api/favorites/check/' + productId, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.isFavorite) {
      isFavorite = true;
      const favoriteBtn = document.getElementById('btn-favorite');
      if (favoriteBtn) {
        const icon = favoriteBtn.querySelector('i');
        if (icon) {
          icon.className = 'fas fa-heart';
          favoriteBtn.classList.add('active');
        }
      }
    }
  } catch (error) {
    console.error('Erro ao verificar favoritos:', error);
  }
}

function showError() {
  const loadingElement = document.getElementById('product-loading');
  const errorElement = document.getElementById('product-error');
  const detailElement = document.getElementById('product-detail');
  
  if (loadingElement) loadingElement.style.display = 'none';
  if (errorElement) errorElement.style.display = 'block';
  if (detailElement) detailElement.style.display = 'none';
}