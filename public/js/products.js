// Variáveis globais
let currentPage = 1;
let totalPages = 1;
let currentFilters = {
    sort: 'newest',
    priceRange: 'all',
    sizes: [],
    colors: [],
    types: [],
    materials: [],
    discountRange: 'all'
};

// Função para carregar produtos
async function loadProducts() {
    try {
        const productsGrid = document.getElementById('products-grid');
        productsGrid.innerHTML = '<div class="loading">Carregando produtos...</div>';

        // Pegar a categoria da página atual
        const category = window.location.pathname.split('/').pop().replace('.html', '');

        // Construir parâmetros da query
        const params = new URLSearchParams({
            category: category,
            page: currentPage,
            sort: currentFilters.sort,
            priceRange: currentFilters.priceRange,
            sizes: currentFilters.sizes.join(','),
            colors: currentFilters.colors.join(','),
            types: currentFilters.types.join(','),
            materials: currentFilters.materials.join(','),
            discountRange: currentFilters.discountRange
        });

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
    const productsGrid = document.getElementById('products-grid');
    
    if (!products || products.length === 0) {
        productsGrid.innerHTML = `
            <div class="no-products">
                Nenhum produto encontrado com os filtros selecionados.
            </div>
        `;
        return;
    }

    productsGrid.innerHTML = products.map(product => `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-image">
                <img src="${product.image || product.images?.[0] || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E'}" alt="${product.name}">
                <button class="favorite-btn" onclick="toggleFavorite(${product.id})">
                    <i class="far fa-heart"></i>
                </button>
                ${product.discount ? `
                    <span class="discount-badge">-${product.discount}%</span>
                ` : ''}
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <div class="product-price">
                    ${product.discount ? `
                        <span class="original-price">R$ ${product.originalPrice.toFixed(2)}</span>
                    ` : ''}
                    <span class="current-price">R$ ${product.price.toFixed(2)}</span>
                </div>
                ${product.type ? `<p class="product-type"><small><strong>Tipo:</strong> ${product.type}</small></p>` : ''}
                ${product.color ? `<p class="product-color"><small><strong>Cor:</strong> ${product.color}</small></p>` : ''}
                <div class="product-sizes">
                    ${product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0 
                      ? product.sizes.map(size => `<span class="size-tag">${size}</span>`).join('')
                      : '<span class="size-tag">N/A</span>'}
                </div>
            </div>
        </div>
    `).join('');

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

// Função para configurar listeners de eventos
function setupEventListeners() {
    // Ordenação
    document.getElementById('sort')?.addEventListener('change', async (e) => {
        currentFilters.sort = e.target.value;
        currentPage = 1;
        await loadProducts();
    });

    // Faixa de preço
    document.getElementById('price_range')?.addEventListener('change', async (e) => {
        currentFilters.priceRange = e.target.value;
        currentPage = 1;
        await loadProducts();
    });

    // Faixa de desconto (apenas na página de ofertas)
    document.getElementById('discount_range')?.addEventListener('change', async (e) => {
        currentFilters.discountRange = e.target.value;
        currentPage = 1;
        await loadProducts();
    });

    // Tamanhos - Atualizado para funcionar com dropdowns
    // Selecionar todos os checkboxes de tamanhos dentro de dropdowns
    const sizeCheckboxes = document.querySelectorAll('.filter-group h4');
    sizeCheckboxes.forEach(header => {
        if (header.textContent.toLowerCase().includes('tamanho')) {
            const dropdown = header.nextElementSibling;
            if (dropdown && dropdown.classList.contains('dropdown')) {
                const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', async () => {
                        currentFilters.sizes = Array.from(checkboxes)
                            .filter(cb => cb.checked)
                            .map(cb => cb.value);
                        
                        currentPage = 1;
                        await loadProducts();
                    });
                });
            }
        }
    });

    // Tipos - Atualizado para funcionar com dropdowns
    // Selecionar todos os checkboxes de tipos dentro de dropdowns
    const typeCheckboxes = document.querySelectorAll('.filter-group h4');
    typeCheckboxes.forEach(header => {
        if (header.textContent.toLowerCase().includes('tipo')) {
            const dropdown = header.nextElementSibling;
            if (dropdown && dropdown.classList.contains('dropdown')) {
                const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', async () => {
                        currentFilters.types = Array.from(checkboxes)
                            .filter(cb => cb.checked)
                            .map(cb => cb.value);
                        
                        currentPage = 1;
                        await loadProducts();
                    });
                });
            }
        }
    });

    // Materiais - Atualizado para funcionar com dropdowns
    // Selecionar todos os checkboxes de materiais dentro de dropdowns
    const materialCheckboxes = document.querySelectorAll('.filter-group h4');
    materialCheckboxes.forEach(header => {
        if (header.textContent.toLowerCase().includes('materiai')) {
            const dropdown = header.nextElementSibling;
            if (dropdown && dropdown.classList.contains('dropdown')) {
                const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', async () => {
                        currentFilters.materials = Array.from(checkboxes)
                            .filter(cb => cb.checked)
                            .map(cb => cb.value);
                        
                        currentPage = 1;
                        await loadProducts();
                    });
                });
            }
        }
    });

    // Cores - Atualizado para funcionar com dropdowns
    // Selecionar todos os checkboxes de cores dentro de dropdowns
    const colorHeaders = document.querySelectorAll('.filter-group h4');
    colorHeaders.forEach(header => {
        if (header.textContent.toLowerCase().includes('cor')) {
            const dropdown = header.nextElementSibling;
            if (dropdown && dropdown.classList.contains('dropdown')) {
                const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', async () => {
                        currentFilters.colors = Array.from(checkboxes)
                            .filter(cb => cb.checked)
                            .map(cb => cb.value);
                        
                        currentPage = 1;
                        await loadProducts();
                    });
                });
            }
        }
    });

    // Paginação
    document.querySelector('.prev-page')?.addEventListener('click', async () => {
        if (currentPage > 1) {
            currentPage--;
            await loadProducts();
        }
    });

    document.querySelector('.next-page')?.addEventListener('click', async () => {
        if (currentPage < totalPages) {
            currentPage++;
            await loadProducts();
        }
    });
}

// Função auxiliar para verificar se um elemento contém texto
function containsText(element, text) {
    return element.textContent.toLowerCase().includes(text.toLowerCase());
}

// Inicializar a página quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await loadProducts();
    updateFavoritesStatus();
});