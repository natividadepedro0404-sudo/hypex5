const express = require('express');
const supabase = require('../db/supabaseClient');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Helper: gera signed URL (fallback para publicURL) - mesma função do products.js
async function makeAccessibleUrl(key) {
  try {
    if (!key) return null;
    // se já for uma URL, retorna ela
    if (typeof key === 'string' && /^(http|https):\/\//.test(key)) return key;

    // Primeiro tenta public URL (sempre funciona, mesmo com anon key)
    const pub = supabase.storage.from('product_images').getPublicUrl(key);
    if (pub?.data?.publicUrl) {
      return pub.data.publicUrl;
    } else if (pub?.publicURL) {
      return pub.publicURL;
    }

    // Se public URL não funcionar, tenta signed URL (requer service role key)
    const expiresIn = 60 * 60; // 1 hora
    const { data: signed, error: signErr } = await supabase.storage.from('product_images').createSignedUrl(key, expiresIn);
    
    if (signErr) {
      return pub?.data?.publicUrl || pub?.publicURL || null;
    } else if (signed?.signedURL) {
      return signed.signedURL;
    } else {
      return pub?.data?.publicUrl || pub?.publicURL || null;
    }
  } catch (e) {
    console.error('Erro ao gerar URL para', key, ':', e);
    return null;
  }
}

// Helper: converte product (com keys) para product com URLs em images
async function productWithAccessibleImages(product) {
  const clone = { ...product };
  if (Array.isArray(clone.images) && clone.images.length) {
    const urls = await Promise.all(clone.images.map(async imgKey => {
      const url = await makeAccessibleUrl(imgKey);
      return url;
    }));
    clone.images = urls.filter(Boolean);
  } else {
    clone.images = [];
  }
  clone.image = clone.images.length ? clone.images[0] : null;
  return clone;
}

// Toggle favorite: adiciona se não existe, remove se existe
router.post('/toggle', authRequired, async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user.id;

    if (!productId) {
      return res.status(400).json({ error: 'ID do produto é obrigatório' });
    }

    // Verificar se o produto existe
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    // Verificar se já é favorito
    const { data: existing, error: checkError } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single();

    if (existing) {
      // Remover favorito
      const { error: deleteError } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);

      if (deleteError) {
        return res.status(500).json({ error: 'Erro ao remover favorito' });
      }

      return res.json({ isFavorite: false, message: 'Favorito removido' });
    } else {
      // Adicionar favorito
      const { error: insertError } = await supabase
        .from('favorites')
        .insert([{ user_id: userId, product_id: productId }]);

      if (insertError) {
        return res.status(500).json({ error: 'Erro ao adicionar favorito' });
      }

      return res.json({ isFavorite: true, message: 'Favorito adicionado' });
    }
  } catch (err) {
    console.error('Erro ao alternar favorito:', err);
    res.status(500).json({ error: err.message });
  }
});

// Listar favoritos do usuário
router.get('/', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    // Primeiro, buscar os favoritos
    const { data: favorites, error: favoritesError } = await supabase
      .from('favorites')
      .select('id, product_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (favoritesError) {
      console.error('Erro ao buscar favoritos:', favoritesError);
      // Se a tabela não existir, retornar array vazio
      if (favoritesError.code === '42P01' || favoritesError.message?.includes('does not exist')) {
        return res.json({ favorites: [] });
      }
      return res.status(500).json({ error: 'Erro ao buscar favoritos: ' + favoritesError.message });
    }

    if (!favorites || favorites.length === 0) {
      return res.json({ favorites: [] });
    }

    // Buscar os produtos separadamente
    const productIds = favorites.map(f => f.product_id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (productsError) {
      console.error('Erro ao buscar produtos:', productsError);
      return res.status(500).json({ error: 'Erro ao buscar produtos: ' + productsError.message });
    }

    // Criar mapa de produtos por ID
    const productsMap = {};
    (products || []).forEach(p => {
      productsMap[p.id] = p;
    });

    // Processar favoritos com produtos e imagens
    const processedFavorites = await Promise.all(favorites.map(async (fav) => {
      const product = productsMap[fav.product_id];
      if (product) {
        // Processar imagens do produto
        const productWithImages = await productWithAccessibleImages(product);
        return {
          id: fav.id,
          product_id: fav.product_id,
          created_at: fav.created_at,
          products: productWithImages
        };
      }
      // Se o produto não foi encontrado, retornar apenas os dados do favorito
      return {
        id: fav.id,
        product_id: fav.product_id,
        created_at: fav.created_at,
        products: null
      };
    }));

    // Filtrar favoritos que não têm produto (produto foi deletado)
    const validFavorites = processedFavorites.filter(f => f.products !== null);

    res.json({ favorites: validFavorites });
  } catch (err) {
    console.error('Erro ao listar favoritos:', err);
    res.status(500).json({ error: err.message || 'Erro ao listar favoritos' });
  }
});

// Verificar se um produto é favorito do usuário
router.get('/check/:productId', authRequired, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }

    res.json({ isFavorite: !!data });
  } catch (err) {
    console.error('Erro ao verificar favorito:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

