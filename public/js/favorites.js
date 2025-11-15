// Gerenciamento de favoritos usando a API
async function loadFavorites() {
    const token = localStorage.getItem('hypex_token');
    if (!token) {
        const list = document.getElementById('favorites-list');
        if (list) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="far fa-heart"></i>
                    <h3>Faça login para ver seus favoritos</h3>
                    <p>Você precisa estar logado para adicionar e visualizar produtos favoritos.</p>
                    <a href="/pages/auth.html" class="cta-button">Fazer Login</a>
                </div>
            `;
        }
        return;
    }

    try {
        const response = await fetch('/api/favorites/', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Tentar ler o JSON de erro
            let errorMessage = 'Erro ao carregar favoritos';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
                
                // Se a tabela não existe, mostrar mensagem amigável
                if (errorMessage.includes('does not exist') || errorMessage.includes('42P01')) {
                    const list = document.getElementById('favorites-list');
                    if (list) {
                        list.innerHTML = `
                            <div class="empty-state">
                                <i class="fas fa-info-circle"></i>
                                <h3>Tabela de favoritos não encontrada</h3>
                                <p>Por favor, execute o script SQL para criar a tabela de favoritos no banco de dados.</p>
                                <p><small>Arquivo: sql/add_favorites_table.sql</small></p>
                                <p><small>Execute o SQL no Supabase SQL Editor.</small></p>
                            </div>
                        `;
                    }
                    return;
                }
            } catch (e) {
                // Se não conseguir ler o JSON, usar a mensagem padrão
                errorMessage = `Erro ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        renderFavorites(data.favorites || []);
    } catch (error) {
        console.error('Erro ao carregar favoritos:', error);
        const list = document.getElementById('favorites-list');
        if (list) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Erro ao carregar favoritos</h3>
                    <p>${error.message || 'Ocorreu um erro inesperado. Por favor, tente novamente.'}</p>
                    <button onclick="loadFavorites()" class="cta-button">Tentar Novamente</button>
                    <p><small>Verifique o console do navegador (F12) para mais detalhes.</small></p>
                </div>
            `;
        }
    }
}

function renderFavorites(favorites) {
    const list = document.getElementById('favorites-list');
    if (!list) return;
    
    if (!favorites || favorites.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="far fa-heart"></i>
                <h3>Nenhum favorito ainda</h3>
                <p>Explore nossos produtos e adicione seus favoritos aqui!</p>
                <a href="/" class="cta-button">Ver Produtos</a>
            </div>
        `;
        return;
    }
    
    list.innerHTML = '';
    
    favorites.forEach(fav => {
        const product = fav.products;
        if (!product) return;

        const card = document.createElement('article');
        card.className = 'product-card';
        card.dataset.productId = product.id;
        
        const img = product.images && product.images.length > 0 
            ? product.images[0] 
            : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E';
        
        card.innerHTML = `
            <div class="product-image">
                <img src="${img}" alt="${product.name}">
                <div class="quick-actions">
                    <button class="action-btn favorite active" onclick="toggleFavoriteFromPage('${product.id}')">
                        <i class="fas fa-heart"></i>
                    </button>
                    <button class="action-btn add-cart" onclick="addFavoriteToCart('${product.id}')">
                        <i class="fas fa-shopping-cart"></i>
                    </button>
                </div>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <div class="price-info">
                    <span class="current-price">R$ ${Number(product.price || 0).toFixed(2)}</span>
                </div>
                ${product.type ? `<p class="product-type"><small><strong>Tipo:</strong> ${product.type}</small></p>` : ''}
                ${product.color ? `<p class="product-color"><small><strong>Cor:</strong> ${product.color}</small></p>` : ''}
                ${product.brand ? `<p class="product-brand"><small><strong>Marca:</strong> ${product.brand}</small></p>` : ''}
                ${product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0 
                    ? `<div class="product-sizes"><small><strong>Tamanhos:</strong> ${product.sizes.join(', ')}</small></div>` 
                    : ''}
            </div>
        `;
        
        list.appendChild(card);
    });
}

async function toggleFavoriteFromPage(productId) {
    const token = localStorage.getItem('hypex_token');
    if (!token) {
        alert('Faça login para adicionar produtos aos favoritos');
        window.location.href = '/pages/auth.html?redirect=' + encodeURIComponent(window.location.href);
        return;
    }

    try {
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

        // Se foi removido, recarregar a lista de favoritos
        if (!data.isFavorite) {
            loadFavorites();
        }
    } catch (error) {
        console.error('Erro ao alternar favorito:', error);
        alert(error.message || 'Erro ao atualizar favorito. Por favor, tente novamente.');
    }
}

// Função para adicionar produto favorito ao carrinho
async function addFavoriteToCart(productId) {
    try {
        // Buscar informações do produto
        const response = await fetch(`/api/products/${productId}`);
        const data = await response.json();
        
        if (!response.ok || !data.product) {
            throw new Error('Produto não encontrado');
        }
        
        const product = data.product;
        
        // Adicionar ao carrinho usando a função global se disponível
        if (typeof window.addItemToCart === 'function') {
            window.addItemToCart(product);
        } else {
            // Fallback: usar localStorage do carrinho
            const cart = JSON.parse(localStorage.getItem('hypex_cart') || '[]');
            const found = cart.find(i => i.product_id === product.id);
            
            const stock = Number(product.stock || 0);
            if (stock <= 0) {
                alert('Produto fora de estoque!');
                return;
            }
            
            if (found) {
                if (found.qty >= stock) {
                    alert(`Quantidade máxima disponível: ${stock} unidades`);
                    return;
                }
                found.qty++;
            } else {
                cart.push({
                    product_id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.images?.[0],
                    stock: stock,
                    qty: 1,
                    checked: true
                });
            }
            
            localStorage.setItem('hypex_cart', JSON.stringify(cart));
            alert('Produto adicionado ao carrinho!');
            
            // Atualizar contador do carrinho se existir
            if (typeof updateCartCount === 'function') {
                updateCartCount();
            }
        }
    } catch (error) {
        console.error('Erro ao adicionar ao carrinho:', error);
        alert('Erro ao adicionar produto ao carrinho. Por favor, tente novamente.');
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    loadFavorites();
});
