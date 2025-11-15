const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const supabase = require('../db/supabaseClient');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 5 } });

// Middleware para adicionar usuário às rotas públicas (opcional)
router.use((req, res, next) => {
  // Tentar autenticar o usuário, mas não falhar se não houver token
  const auth = req.headers.authorization;
  if (auth) {
    const token = auth.split(' ')[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
      req.user = payload;
    } catch (err) {
      // Token inválido, continuar sem usuário
    }
  }
  next();
});

// Helper: gera signed URL (fallback para publicURL)
async function makeAccessibleUrl(key) {
  try {
    if (!key) return null;
    // se já for uma URL, retorna ela
    if (typeof key === 'string' && /^(http|https):\/\//.test(key)) return key;

    // Primeiro tenta public URL (sempre funciona, mesmo com anon key)
    const pub = supabase.storage.from('product_images').getPublicUrl(key);
    console.log('Public URL response para', key, ':', JSON.stringify(pub));
    if (pub?.data?.publicUrl) {
      console.log('Usando public URL para', key);
      return pub.data.publicUrl;
    } else if (pub?.publicURL) {
      // Fallback para formato antigo
      console.log('Usando public URL (formato antigo) para', key);
      return pub.publicURL;
    }

    // Se public URL não funcionar, tenta signed URL (requer service role key)
    const expiresIn = 60 * 60; // 1 hora
    const { data: signed, error: signErr } = await supabase.storage.from('product_images').createSignedUrl(key, expiresIn);
    
    if (signErr) {
      console.error('Erro ao criar signed URL para', key, ':', signErr);
      // Se não conseguir criar signed URL, retorna a public URL mesmo assim
      // (pode não funcionar se o bucket for privado, mas é melhor que nada)
      return pub?.data?.publicUrl || pub?.publicURL || null;
    } else if (signed?.signedURL) {
      console.log('Signed URL gerada com sucesso para', key);
      return signed.signedURL;
    } else {
      console.warn('Signed URL não retornada para', key, 'resposta:', signed);
      return pub?.data?.publicUrl || pub?.publicURL || null;
    }
  } catch (e) {
    console.error('Erro ao gerar URL para', key, ':', e.message || e, e);
    // Última tentativa: retorna public URL mesmo com erro
    try {
      const pub = supabase.storage.from('product_images').getPublicUrl(key);
      return pub?.data?.publicUrl || pub?.publicURL || null;
    } catch (e2) {
      console.error('Erro ao obter public URL como fallback:', e2);
      return null;
    }
  }
}

// Helper: converte product (com keys) para product com URLs em images e image (primeira)
// Also includes variations if requested
async function productWithAccessibleImages(product, includeVariations = false) {
  const clone = { ...product };
  if (Array.isArray(clone.images) && clone.images.length) {
    const urls = await Promise.all(clone.images.map(async imgKey => {
      const url = await makeAccessibleUrl(imgKey);
      if (!url) {
        console.warn('Não foi possível gerar URL para a imagem:', imgKey);
      }
      return url;
    }));
    clone.images = urls.filter(Boolean);
  } else {
    clone.images = [];
  }
  clone.image = clone.images.length ? clone.images[0] : null;
  if (!clone.image && clone.images && clone.images.length > 0) {
    console.warn('Produto sem imagem principal, mas tem imagens no array:', clone.id, clone.images);
  }
  
  // Include variations if requested
  if (includeVariations && clone.id) {
    try {
      const { data: variations, error } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', clone.id)
        .eq('is_active', true)
        .order('color', { ascending: true })
        .order('size', { ascending: true });
        
      if (!error && variations) {
        const variationsWithUrls = await Promise.all(
          variations.map(variation => variationWithAccessibleImages(variation))
        );
        clone.variations = variationsWithUrls;
      }
    } catch (err) {
      console.error('Erro ao buscar variações para produto:', clone.id, err);
      clone.variations = [];
    }
  }
  
  return clone;
}

// Helper: converte variation (com keys) para variation com URLs em images
async function variationWithAccessibleImages(variation) {
  const clone = { ...variation };
  if (Array.isArray(clone.images) && clone.images.length) {
    const urls = await Promise.all(clone.images.map(async imgKey => {
      try {
        // Primeiro tenta public URL (sempre funciona, mesmo com anon key)
        const pub = supabase.storage.from('product_images').getPublicUrl(imgKey);
        if (pub?.data?.publicUrl) {
          return pub.data.publicUrl;
        } else if (pub?.publicURL) {
          // Fallback para formato antigo
          return pub.publicURL;
        }
        return null;
      } catch (e) {
        console.error('Erro ao gerar URL para imagem de variação:', imgKey, e);
        return null;
      }
    }));
    clone.images = urls.filter(Boolean);
  } else {
    clone.images = [];
  }
  clone.image = clone.images.length ? clone.images[0] : null;
  return clone;
}

// Admin: create product with up to 5 images
router.post('/', adminRequired, upload.array('images', 5), async (req, res) => {
  try {
    // Debug logs to help identify if files are being received
    console.log('POST /api/products - received files length:', req.files?.length || 0);
    console.log('Request body:', req.body);
    if (req.files && req.files.length) {
      console.log('Uploaded filenames:', req.files.map(f => f.originalname));
    }

    const { name, description, price, stock, type, color, sizes, brand } = req.body;
    
    // Processar tamanhos - pode vir como array ou string
    let sizesArray = [];
    if (sizes) {
      if (Array.isArray(sizes)) {
        sizesArray = sizes;
      } else if (typeof sizes === 'string') {
        sizesArray = [sizes];
      }
    }
    
    const productInsert = { 
      name, 
      description, 
      price: Number(price || 0), 
      stock: Number(stock || 0),
      type: type || null,
      color: color || null,
      brand: brand || null,
      sizes: sizesArray.length > 0 ? sizesArray : []
    };
    
    const { data: prod, error: prodErr } = await supabase.from('products').insert([productInsert]).select().single();
    if (prodErr) return res.status(400).json({ error: prodErr.message });

    const files = req.files || [];
    const imageKeys = [];

    // Use the service role key from supabaseClient (already configured with service role)
    // This bypasses RLS policies for administrative operations
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = (f.originalname && f.originalname.split('.').pop()) || 'jpg';
      const key = `products/${prod.id}/${Date.now()}_${i}.${ext}`;

      // Upload using the main supabase client (with service role key)
      const result = await supabase.storage.from('product_images').upload(key, f.buffer, { 
        contentType: f.mimetype,
        upsert: true // Allow overwriting if file exists
      });

      if (result.error) {
        // Log full error
        console.error('Erro upload imagem', result.error);
        console.error('Error details:', JSON.stringify(result.error, null, 2));
        
        // Check if it's an RLS policy error or Internal Server Error from Supabase
        if (result.error.statusCode === '403' || 
            result.error.statusCode === '500' || 
            result.error.message?.includes('row-level security') || 
            result.error.message?.includes('policy') ||
            result.error.message?.includes('Internal Server Error')) {
          console.warn('Storage error - Product created without images.');
          console.warn('Possible causes: 1) RLS policies 2) Supabase Storage issue 3) Bucket does not exist');
          console.warn('Check that the product_images bucket exists in Supabase Storage');
          // Don't fail the request - product was already created, just without images
          break;
        }
        return res.status(500).json({ error: 'Erro ao fazer upload das imagens', detail: result.error.message || result.error });
      }

      imageKeys.push(key);
    }

    // If images were uploaded, update the product with image keys
    if (imageKeys.length > 0) {
      const { data: updatedProd, error: updateErr } = await supabase
        .from('products')
        .update({ images: imageKeys })
        .eq('id', prod.id)
        .select()
        .single();
        
      if (updateErr) {
        console.error('Erro ao atualizar imagens do produto:', updateErr);
        // Still return success since the product was created
      } else {
        prod.images = updatedProd.images;
      }
    }

    try {
      const product = await productWithAccessibleImages(prod);
      
      // If files were uploaded but none saved due to RLS, add a warning
      if (files.length > 0 && (!prod.images || prod.images.length === 0)) {
        return res.json({ 
          product,
          warning: 'Produto criado mas imagens não foram salvas. Configure as políticas de storage no Supabase.'
        });
      }
      
      res.json({ product });
    } catch (e) {
      console.error('Erro ao processar imagens do produto criado:', e);
      res.json({ product: prod });
    }
  } catch (err) {
    console.error('POST /api/products error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Public: list products (retorna imagens como URLs acessíveis)
router.get('/', async (req, res) => {
  try {
    // Para usuários comuns, só mostrar produtos ativos
    // Para admins, mostrar todos os produtos
    let query = supabase.from('products').select('*');
    
    // Se não for admin, filtrar apenas produtos ativos
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isAdmin) {
      query = query.eq('is_active', true);
    }
    
    // Busca por nome do produto
    const search = req.query.search;
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    
    // Filtrar por marca se fornecido
    const brand = req.query.brand;
    if (brand) {
      query = query.eq('brand', brand);
    }
    
    // Filtrar por marcas se fornecido (múltiplas marcas)
    const brands = req.query.brands;
    if (brands) {
      const brandsArray = brands.split(',').filter(b => b.trim() !== '');
      if (brandsArray.length > 0) {
        query = query.in('brand', brandsArray);
      }
    }
    
    // Filtrar por tipos se fornecido
    const types = req.query.types;
    if (types) {
      const typesArray = types.split(',').filter(t => t.trim() !== '');
      if (typesArray.length > 0) {
        query = query.in('type', typesArray);
      }
    }
    
    // Filtrar por categorias se fornecido
    const categories = req.query.categories;
    if (categories) {
      const categoriesArray = categories.split(',').filter(c => c.trim() !== '');
      if (categoriesArray.length > 0) {
        // Mapear categorias para tipos específicos
        const categoryTypeMap = {
          'roupas': ['camisa', 'moleton', 'vestido', 'calca', 'calca-normal', 'calca-jogador', 'bermuda-jeans', 'bermuda-jogador', 'bermuda-tectel', 'bermuda-elastano', 'blusa-times', 'conjunto', 'kit', 'short', 'camiseta'],
          'calcados': ['sapato'],
          'acessorios': ['bone', 'acessorio']
        };
        
        const allTypes = [];
        categoriesArray.forEach(category => {
          if (categoryTypeMap[category]) {
            allTypes.push(...categoryTypeMap[category]);
          }
        });
        
        if (allTypes.length > 0) {
          query = query.in('type', allTypes);
        }
      }
    }
    
    // Filtrar por tamanhos se fornecido
    const sizes = req.query.sizes;
    if (sizes) {
      const sizesArray = sizes.split(',').filter(s => s.trim() !== '');
      if (sizesArray.length > 0) {
        // Para arrays, usar a função contains do PostgreSQL
        query = query.contains('sizes', sizesArray);
      }
    }
    
    // Filtrar por cores se fornecido
    const colors = req.query.colors;
    if (colors) {
      const colorsArray = colors.split(',').filter(c => c.trim() !== '');
      if (colorsArray.length > 0) {
        query = query.in('color', colorsArray);
      }
    }
    
    // Filtrar por faixa de preço se fornecido
    const priceRange = req.query.priceRange;
    if (priceRange && priceRange !== 'all') {
      if (priceRange === '0-50') {
        query = query.gte('price', 0).lte('price', 50);
      } else if (priceRange === '50-100') {
        query = query.gt('price', 50).lte('price', 100);
      } else if (priceRange === '100-200') {
        query = query.gt('price', 100).lte('price', 200);
      } else if (priceRange === '200+') {
        query = query.gt('price', 200);
      }
    }
    
    // Filtrar por faixa de desconto se fornecido
    const discountRange = req.query.discountRange;
    if (discountRange && discountRange !== 'all') {
      // Calcular desconto baseado no campo discount ou na diferença entre originalPrice e price
      if (discountRange === '10-30') {
        query = query.gte('discount', 10).lte('discount', 30);
      } else if (discountRange === '30-50') {
        query = query.gt('discount', 30).lte('discount', 50);
      } else if (discountRange === '50+') {
        query = query.gt('discount', 50);
      }
    }
    
    // Ordenação
    const sort = req.query.sort || 'newest';
    switch (sort) {
      case 'price_asc':
        query = query.order('price', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('price', { ascending: false });
        break;
      case 'name_asc':
        query = query.order('name', { ascending: true });
        break;
      case 'name_desc':
        query = query.order('name', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }
    
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const products = await Promise.all((data || []).map(async p => {
      return await productWithAccessibleImages(p);
    }));

    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: get single product by id (retorna product com images/url)
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'ID do produto inválido' });

    // Para usuários comuns, só mostrar produtos ativos
    // Para admins, mostrar produtos ativos ou inativos
    let query = supabase.from('products').select('*').eq('id', id);
    
    // Se não for admin, filtrar apenas produtos ativos
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isAdmin) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query.single();
    if (error) {
      // Supabase returns error when no rows; handle not found
      if (error.code === 'PGRST116' || error.code === 'PGRST117' || /No rows/.test(error.message)) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }
      return res.status(500).json({ error: error.message });
    }
    if (!data) return res.status(404).json({ error: 'Produto não encontrado' });

    const product = await productWithAccessibleImages(data, true); // Include variations
    res.json({ product });
  } catch (err) {
    console.error('GET /api/products/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', adminRequired, upload.array('images', 5), async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description, price, stock, type, color, sizes, brand } = req.body;
    
    // Construir objeto de mudanças apenas com campos válidos
    const changes = {};
    
    if (name !== undefined) changes.name = name;
    if (description !== undefined) changes.description = description;
    if (price !== undefined) changes.price = Number(price || 0);
    if (stock !== undefined) changes.stock = Number(stock || 0);
    if (type !== undefined) changes.type = type || null;
    if (color !== undefined) changes.color = color || null;
    if (brand !== undefined) changes.brand = brand || null;
    
    // Processar tamanhos - sempre garantir que seja um array
    if (sizes !== undefined) {
      if (Array.isArray(sizes)) {
        changes.sizes = sizes;
      } else if (typeof sizes === 'string') {
        changes.sizes = sizes ? [sizes] : [];
      } else {
        changes.sizes = [];
      }
    }
    
    // Se houver novos arquivos de imagem, fazer upload
    const files = req.files || [];
    if (files.length > 0) {
      console.log('PUT /api/products/:id - received files length:', files.length);
      
      const imageKeys = [];

      // Use the service role key from supabaseClient (bypasses RLS)
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = (f.originalname && f.originalname.split('.').pop()) || 'jpg';
        const key = `products/${id}/${Date.now()}_${i}.${ext}`;

        const result = await supabase.storage.from('product_images').upload(key, f.buffer, { 
          contentType: f.mimetype,
          upsert: true
        });

        if (result.error) {
          console.error('Erro upload imagem', result.error);
          if (result.error.statusCode === '403' || 
              result.error.statusCode === '500' || 
              result.error.message?.includes('row-level security') || 
              result.error.message?.includes('policy') ||
              result.error.message?.includes('Internal Server Error')) {
            console.warn('Storage error - Product will be updated without new images.');
            console.warn('Check that the product_images bucket exists in Supabase Storage');
            break;
          }
          return res.status(500).json({ error: 'Erro ao fazer upload das imagens', detail: result.error.message || result.error });
        }

        imageKeys.push(key);
      }

      // Se conseguiu fazer upload de imagens, adicionar ao changes
      if (imageKeys.length > 0) {
        // Buscar imagens existentes do produto
        const { data: existingProduct } = await supabase.from('products').select('images').eq('id', id).single();
        const existingImages = existingProduct?.images || [];
        
        // Mesclar imagens existentes com as novas (adicionar as novas ao array)
        changes.images = [...existingImages, ...imageKeys];
      }
    }
    
    const { data, error } = await supabase.from('products').update(changes).eq('id', id).select().single();
    if (error) {
      console.error('Erro ao atualizar produto:', error);
      return res.status(400).json({ error: error.message });
    }

    try {
      const product = await productWithAccessibleImages(data);
      
      // If files were uploaded but none saved due to RLS, add a warning
      if (files.length > 0 && (!changes.images || changes.images.length === 0)) {
        return res.json({ 
          product,
          warning: 'Produto atualizado mas imagens não foram salvas. Configure as políticas de storage no Supabase.'
        });
      }
      
      res.json({ product });
    } catch (e) {
      console.error('Erro ao processar imagens do produto atualizado:', e);
      res.json({ product: data });
    }
  } catch (err) {
    console.error('PUT /api/products/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: delete product
router.delete('/:id', adminRequired, async (req, res) => {
  const id = req.params.id;
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;