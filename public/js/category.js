// Variáveis globais
let currentCategory = '';
let currentPage = 1;
let totalPages = 1;
let currentFilters = {
    sort: 'newest',
    priceRange: 'all',
    sizes: [],
    colors: [],
    types: []
};

// Função para inicializar a página
async function initCategoryPage() {
    // Pegar o tipo de categoria da URL ou da variável global
    const urlParams = new URLSearchParams(window.location.search);
    currentCategory = urlParams.get('type') || window.currentCategoryType || '';

    // Definir o título da página baseado na categoria
    updateCategoryTitle();

    // Configurar listeners de eventos
    setupEventListeners();

    // Carregar produtos iniciais
    await loadProducts();
    
    // Atualizar status de favoritos
    updateFavoritesStatus();
}

// Função para atualizar o título da categoria
function updateCategoryTitle() {
    const urlParams = new URLSearchParams(window.location.search);
    const brand = urlParams.get('brand');
    
    // Se houver marca na URL, usar o nome da marca como título
    if (brand) {
        const brandMap = {
            'lacoste': 'Lacoste',
            'louis-vuitton': 'Louis Vuitton',
            'nike': 'Nike',
            'adidas': 'Adidas',
            'emporio-armani': 'Emporio Armani',
            'zara': 'Zara',
            'chronic': 'Chronic',
            'bmw': 'BMW',
            'gucci': 'Gucci',
            'prada': 'Prada',
            'versace': 'Versace',
            'dior': 'Dior',
            'off-white': 'Off-White',
            'fendi': 'Fendi',
            'burberry': 'Burberry',
            'givenchy': 'Givenchy',
            'supreme': 'Supreme',
            'puma': 'Puma',
            'balenciaga': 'Balenciaga',
            'tommy-hilfiger': 'Tommy Hilfiger',
            'calvin-klein': 'Calvin Klein',
            'dolce-gabbana': 'Dolce & Gabbana',
            'jordan': 'Jordan',
            'hermes': 'Hermès',
            'diesel': 'Diesel',
            'vans': 'Vans',
            'new-balance': 'New Balance',
            'under-armour': 'Under Armour',
            'ralph-lauren': 'Ralph Lauren'
        };
        const brandName = brandMap[brand] || brand;
        const titleEl = document.getElementById('category-title');
        if (titleEl) {
            titleEl.textContent = brandName;
        }
        document.title = `${brandName} - HYPEX`;
        return;
    }
    
    // Caso contrário, usar o título da categoria
    const titleMap = {
        'novo': 'Novidades',
        'roupas': 'Roupas',
        'calcados': 'Calçados',
        'acess': 'Acessórios',
        'ofertas': 'Ofertas'
    };

    const title = titleMap[currentCategory] || 'Produtos';
    const titleEl = document.getElementById('category-title');
    if (titleEl) {
        titleEl.textContent = title;
    }
    document.title = `${title} - HYPEX`;
}

// Função para configurar listeners de eventos
function setupEventListeners() {
    // Ordenação
    document.getElementById('sort').addEventListener('change', async (e) => {
        currentFilters.sort = e.target.value;
        await loadProducts();
    });

    // Faixa de preço
    document.getElementById('price_range').addEventListener('change', async (e) => {
        currentFilters.priceRange = e.target.value;
        await loadProducts();
    });

    // Tamanhos
    const sizeCheckboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');
    sizeCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', async () => {
            currentFilters.sizes = Array.from(sizeCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            await loadProducts();
        });
    });

    // Cores
    const colorCheckboxes = document.querySelectorAll('.color-filters input[type="checkbox"]');
    colorCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', async () => {
            currentFilters.colors = Array.from(colorCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            await loadProducts();
        });
    });

    // Tipos
    const typeCheckboxes = document.querySelectorAll('.filter-group input[type="checkbox"][value]');
    // Filtrar apenas os checkboxes que têm valores de tipos
    const validTypeCheckboxes = Array.from(typeCheckboxes).filter(cb => {
        const validTypes = ['camisa', 'moleton', 'vestido', 'sapato', 'calca', 'calca-normal', 'calca-jogador', 
                          'bermuda-jeans', 'bermuda-jogador', 'bermuda-tectel', 'bermuda-elastano', 
                          'blusa-times', 'conjunto', 'kit', 'bone', 'acessorio', 'short', 'camiseta'];
        return validTypes.includes(cb.value);
    });
    
    validTypeCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', async () => {
            currentFilters.types = validTypeCheckboxes
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            await loadProducts();
        });
    });

    // Paginação
    document.querySelector('.prev-page').addEventListener('click', async () => {
        if (currentPage > 1) {
            currentPage--;
            await loadProducts();
        }
    });

    document.querySelector('.next-page').addEventListener('click', async () => {
        if (currentPage < totalPages) {
            currentPage++;
            await loadProducts();
        }
    });
}

// Função para carregar produtos
async function loadProducts() {
    try {
        const productsGrid = document.getElementById('products-grid');
        productsGrid.innerHTML = '<div class="loading">Carregando produtos...</div>';

        // Pegar marca da URL se existir
        const urlParams = new URLSearchParams(window.location.search);
        const brand = urlParams.get('brand');
        
        // Construir parâmetros da query
        const params = new URLSearchParams({
            category: currentCategory,
            page: currentPage,
            sort: currentFilters.sort,
            priceRange: currentFilters.priceRange,
            sizes: currentFilters.sizes.join(','),
            colors: currentFilters.colors.join(','),
            types: currentFilters.types.join(',')
        });
        
        // Adicionar marca aos parâmetros se existir
        if (brand) {
            params.append('brand', brand);
        }

        // Fazer a requisição para a API
        const response = await fetch(`/api/products?${params}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erro ao carregar produtos');
        }

        // Atualizar total de páginas
        totalPages = data.totalPages || 1;
        updatePagination();

        // Renderizar produtos
        renderProducts(data.products);

    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        document.getElementById('products-grid').innerHTML = `
            <div class="error-message">
                Ocorreu um erro ao carregar os produtos. Por favor, tente novamente.
            </div>
        `;
    }
}

// Função para renderizar produtos
function renderProducts(products) {
    const container = document.querySelector('.products-grid');
    if (!container) return;

    container.innerHTML = products.map(product => {
        // Verificar se o produto tem variações com preços diferentes
        let hasVariations = false;
        let minPrice = Number(product.price || 0);
        let maxPrice = Number(product.price || 0);
        
        // Determinar a imagem a ser exibida (imagem do produto se existir, senão primeira variação)
        let displayImage = product.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E';
        
        // Se o produto não tem imagem própria mas tem variações, usar a imagem da primeira variação
        if (!product.image && product.variations && Array.isArray(product.variations) && product.variations.length > 0) {
            if (product.variations[0].images && product.variations[0].images.length > 0) {
                displayImage = product.variations[0].images[0];
            }
        }
        
        if (product.variations && Array.isArray(product.variations) && product.variations.length > 0) {
            hasVariations = true;
            const variationPrices = product.variations.map(v => Number(v.price || 0)).filter(p => p > 0);
            if (variationPrices.length > 0) {
                minPrice = Math.min(minPrice, ...variationPrices);
                maxPrice = Math.max(maxPrice, ...variationPrices);
            }
        }
        
        // Determinar se há desconto
        let discount = 0;
        if (product.original_price && product.original_price > product.price) {
            discount = Math.round((1 - product.price / product.original_price) * 100);
        }
        
        return `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-image-container">
                <img src="${displayImage}" 
                     alt="${product.name}" 
                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"300\" height=\"400\"%3E%3Crect fill=\"%23f8f9fa\" width=\"300\" height=\"400\"/%3E%3C/svg%3E'">
                <button class="favorite-btn" title="Adicionar aos favoritos">
                    <i class="far fa-heart"></i>
                </button>
                ${hasVariations ? '<div class="variations-badge">Várias opções</div>' : ''}
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <div class="product-price">
                    ${discount ? `
                        <span class="original-price">R$ ${Number(product.original_price).toFixed(2)}</span>
                        <span class="discount-badge">-${discount}%</span>
                    ` : ''}
                    ${minPrice === maxPrice ? 
                        `<span class="current-price">R$ ${minPrice.toFixed(2)}</span>` : 
                        `<span class="current-price">R$ ${minPrice.toFixed(2)} - R$ ${maxPrice.toFixed(2)}</span>`
                    }
                </div>
                ${product.brand ? `<p class="product-brand"><small><strong>Marca:</strong> ${product.brand}</small></p>` : ''}
                ${product.type ? `<p class="product-type"><small><strong>Tipo:</strong> ${product.type}</small></p>` : ''}
                ${product.color ? `<p class="product-color"><small><strong>Cor:</strong> ${product.color}</small></p>` : ''}
                <div class="product-sizes">
                    ${product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0 
                      ? product.sizes.map(size => `<span class="size-tag">${size}</span>`).join('')
                      : '<span class="size-tag">N/A</span>'}
                </div>
            </div>
        </div>
    `}).join('');

    // Adicionar event listeners para os cards de produto
    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Ignorar se clicou no botão de favorito
            if (!e.target.closest('.favorite-btn')) {
                const productId = card.dataset.productId;
                window.location.href = `/pages/product.html?id=${productId}`;
            }
        });
    });
}

// Função para atualizar a paginação
function updatePagination() {
    const prevButton = document.querySelector('.prev-page');
    const nextButton = document.querySelector('.next-page');
    const pageText = document.querySelector('.current-page');

    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;
    pageText.textContent = `Página ${currentPage} de ${totalPages}`;
}

// Função para alternar favorito
async function toggleFavorite(productId) {
    try {
        // Verificar se o usuário está logado
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
        const btn = document.querySelector(`[data-product-id="${productId}"] .favorite-btn`);
        const icon = btn?.querySelector('i');
        if (icon) {
            if (data.isFavorite) {
                icon.classList.remove('far');
                icon.classList.add('fas');
            } else {
                icon.classList.remove('fas');
                icon.classList.add('far');
            }
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

            const favoriteBtn = card.querySelector('.favorite-btn');
            if (favoriteBtn && favoriteProductIds.includes(productId)) {
                const icon = favoriteBtn.querySelector('i');
                if (icon) {
                    icon.classList.remove('far');
                    icon.classList.add('fas');
                }
            }
        });
    } catch (error) {
        console.error('Erro ao verificar favoritos:', error);
    }
}

// Inicializar a página quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', initCategoryPage);