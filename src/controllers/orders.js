const express = require('express');
const supabase = require('../db/supabaseClient');
const { authRequired, adminRequired } = require('../middleware/auth');
const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const efibankService = require('../services/efibank');

const router = express.Router();

// Create checkout: cria pagamento PIX primeiro, sem criar pedido ainda
// O pedido só será criado após confirmação do pagamento via webhook
router.post('/checkout', authRequired, async (req, res) => {
  try {
    const { items, address, coupon_code, shipping } = req.body;
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Itens inválidos' });
    const selected = items.filter(i => i.checked);
    if (!selected.length) return res.status(400).json({ error: 'Selecione ao menos um item para pagar' });

    // Load product details and calculate total
    const productIds = selected.map(s => s.product_id);
    const { data: products, error: productsError } = await supabase.from('products').select('*').in('id', productIds);
    
    if (productsError) {
      return res.status(500).json({ error: 'Erro ao carregar produtos: ' + productsError.message });
    }
    
    if (!products || products.length === 0) {
      return res.status(404).json({ error: 'Nenhum produto encontrado' });
    }
    
    let total = 0;
    const orderItems = [];
    const stockUpdates = [];
    
    // Validar estoque e preparar itens do pedido
    for (const s of selected) {
      const p = products.find(x => x.id === s.product_id);
      if (!p) {
        throw new Error(`Produto não encontrado: ${s.product_id}`);
      }
      
      const qty = Number(s.qty || 1);
      let price = p.price || 0;
      let productName = p.name || 'Produto';
      
      // Verificar se há variação selecionada e usar preço da variação
      if (s.variation_id) {
        // Buscar variação para obter preço individual
        const { data: variation } = await supabase
          .from('product_variations')
          .select('price, name')
          .eq('id', s.variation_id)
          .eq('product_id', s.product_id)
          .single();
          
        if (variation) {
          price = variation.price || price;
          productName = variation.name || productName;
        }
      }
      
      const subtotal = price * qty;
      total += subtotal;
      
      // Validar estoque antes de criar o pedido
      // Para variações, verificar estoque da variação
      let stockToCheck = p.stock || 0;
      if (s.variation_id) {
        const { data: variation } = await supabase
          .from('product_variations')
          .select('stock')
          .eq('id', s.variation_id)
          .eq('product_id', s.product_id)
          .single();
          
        if (variation) {
          stockToCheck = variation.stock || 0;
        }
      }
      
      if (stockToCheck < qty) {
        throw new Error(`Produto "${productName}" não tem estoque suficiente. Disponível: ${stockToCheck}, Solicitado: ${qty}`);
      }
      
      orderItems.push({ 
        product_id: s.product_id, 
        name: productName, 
        qty, 
        price,
        size: s.size,
        variation_id: s.variation_id
      });
      
      // Preparar atualização de estoque
      // Para variações, atualizar estoque da variação
      if (s.variation_id) {
        const { data: variation } = await supabase
          .from('product_variations')
          .select('stock')
          .eq('id', s.variation_id)
          .eq('product_id', s.product_id)
          .single();
          
        if (variation) {
          const newStock = Math.max(0, (variation.stock || 0) - qty);
          // Atualizar estoque da variação
          await supabase
            .from('product_variations')
            .update({ stock: newStock })
            .eq('id', s.variation_id);
        }
      } else {
        // Atualizar estoque do produto base
        const newStock = Math.max(0, (p.stock || 0) - qty);
        stockUpdates.push({ id: p.id, newStock, qty });
      }
    }
    
    // Validar e aplicar cupom se fornecido
    let couponData = null;
    let finalTotal = total;
    let discountAmount = 0;
    
    if (coupon_code) {
      const now = new Date().toISOString();
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', coupon_code.toUpperCase())
        .eq('active', true)
        .gte('expires_at', now)
        .single();
      
      if (couponError || !coupon) {
        return res.status(400).json({ error: 'Cupom inválido, expirado ou inativo' });
      }
      
      // Verificar limite de uso
      if (coupon.usage_limit !== null && coupon.usage_limit !== undefined && coupon.usage_limit > 0) {
        try {
          // Contar quantas vezes o cupom foi usado
          // Nota: Se a coluna coupon_code não existir, esta query pode falhar
          const { count: usageCount, error: countError } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('coupon_code', coupon.code);
          
          if (countError) {
            // Se o erro for porque a coluna não existe, ignorar a verificação de limite
            if (countError.message && countError.message.includes('coupon_code')) {
              console.warn('Coluna coupon_code não encontrada. Pulando verificação de limite de uso do cupom.');
            } else {
              console.error('Erro ao contar uso do cupom:', countError);
            }
          } else if (usageCount >= coupon.usage_limit) {
            return res.status(400).json({ error: 'Cupom esgotado (limite de uso atingido)' });
          }
        } catch (err) {
          // Se houver erro ao verificar limite, apenas logar e continuar
          console.warn('Erro ao verificar limite de uso do cupom:', err.message);
        }
      }
      
      // Calcular desconto
      if (coupon.type === 'percentage') {
        discountAmount = total * (coupon.value / 100);
      } else if (coupon.type === 'fixed') {
        discountAmount = Math.min(coupon.value, total);
      }
      
      finalTotal = Math.max(0, total - discountAmount);
      couponData = {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discount_amount: discountAmount
      };
    }

    // Validar/calcular frete
    let shippingData = null;
    
    // Verificar tipo de entrega
    if (shipping && shipping.type) {
      if (shipping.type === 'pickup') {
        // Retirada no local - sem custo de frete
        shippingData = {
          type: 'pickup',
          service_name: 'Retirada no Local',
          price: 0,
          address: shipping.address || 'Rua Camboja, nº 133 – Bairro Petrovale, Betim'
        };
      } else if (shipping.type === 'moto-uber') {
        // Entrega via moto/uber - sem custo de frete (a combinar)
        shippingData = {
          type: 'moto-uber',
          service_name: 'Entrega via Moto/Uber (A combinar)',
          price: 0,
          contact: shipping.contact || '(31) 97507-4666'
        };
      } else if (shipping.type === 'cep' && shipping.cepDestino && shipping.service_code) {
        // Entrega via Correios/Transportadora
        const price = Number(shipping.price || 0);
        if (price <= 0 || Number.isNaN(price)) {
          return res.status(400).json({ error: 'Valor de frete inválido' });
        }
        
        shippingData = {
          type: 'cep',
          cepDestino: String(shipping.cepDestino).replace(/\D/g, ''),
          service_code: String(shipping.service_code),
          service_name: shipping.service_name || 'Frete',
          price,
          prazo: shipping.prazo ? Number(shipping.prazo) : null
        };
        finalTotal = Math.max(0, finalTotal + price);
      } else {
        return res.status(400).json({ error: 'Tipo de entrega inválido ou dados incompletos' });
      }
    } else if (shipping && shipping.cepDestino && shipping.service_code) {
      // Backward compatibility - aceitar formato antigo (sem type)
      const price = Number(shipping.price || 0);
      if (price <= 0 || Number.isNaN(price)) {
        return res.status(400).json({ error: 'Valor de frete inválido' });
      }
      
      shippingData = {
        type: 'cep',
        cepDestino: String(shipping.cepDestino).replace(/\D/g, ''),
        service_code: String(shipping.service_code),
        service_name: shipping.service_name || 'Frete',
        price,
        prazo: shipping.prazo ? Number(shipping.prazo) : null
      };
      finalTotal = Math.max(0, finalTotal + price);
    } else {
      return res.status(400).json({ error: 'Informações de entrega obrigatórias' });
    }

    // Criar pagamento PIX para todas as opções de entrega
    let pixPayment = null;
    
    try {
      const description = `Pedido HYPEX - ${orderItems.length} item(ns)`;
      const metadata = {
        user_id: req.user.id,
        items_count: orderItems.length,
        coupon_code: couponData?.code || null,
        shipping_service: shippingData?.service_name || null,
        shipping_type: shippingData?.type || null,
        shipping_code: shippingData?.service_code || null,
        shipping_price: shippingData?.price || null,
        shipping_cep: shippingData?.cepDestino || null
      };

      pixPayment = await efibankService.createPixCharge({
        amount: finalTotal,
        description,
        metadata
      });

      // Validar resposta do pagamento
      if (!pixPayment || !pixPayment.txid) {
        throw new Error('Resposta inválida do serviço de pagamento: txid não encontrado');
      }

      // Gerar imagem do QR Code se não vier da API
      if (!pixPayment.qrcode_image && pixPayment.qrcode) {
        pixPayment.qrcode_image = efibankService.generateQRCodeImage(pixPayment.qrcode);
      }

      // Se ainda não temos QR code, tentar buscar usando location
      if (!pixPayment.qrcode && pixPayment.location) {
        console.warn('QR code não veio na resposta inicial. Tentando buscar usando location:', pixPayment.location);
        try {
          const qrcodeFromLocation = await efibankService.getQRCodeByLocation(pixPayment.location);
          if (qrcodeFromLocation) {
            pixPayment.qrcode = qrcodeFromLocation;
            // Gerar imagem do QR Code
            if (!pixPayment.qrcode_image) {
              pixPayment.qrcode_image = efibankService.generateQRCodeImage(pixPayment.qrcode);
            }
          }
        } catch (locationError) {
          console.error('Erro ao buscar QR code por location:', locationError);
          // Continuar mesmo sem QR code, o frontend pode gerar depois usando o txid
        }
      }
    } catch (error) {
      console.error('Erro ao criar pagamento PIX:', error);
      console.error('Stack trace:', error.stack);
      
      // Retornar mensagem de erro mais específica
      let errorMessage = 'Erro ao criar pagamento. Tente novamente.';
      if (error.message) {
        // Se a mensagem contém informações úteis, incluir
        if (error.message.includes('não configurada') || 
            error.message.includes('Credenciais') ||
            error.message.includes('Chave PIX')) {
          errorMessage = error.message;
        } else {
          errorMessage = `Erro ao criar pagamento: ${error.message}`;
        }
      }
      
      return res.status(500).json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    // Criar pedido pendente (pending_order) - NÃO cria order ainda
    const pendingOrderPayload = {
      user_id: req.user.id,
      items: orderItems,
      total: finalTotal,
      address: address || null, // Endereço completo do formulário
      payment_id: pixPayment.txid,
      payment_qrcode: pixPayment.qrcode,
      payment_qrcode_image: pixPayment.qrcode_image,
      payment_status: 'pending',
      expires_at: pixPayment.expires_at
    };

    // Adicionar campos de cupom se houver
    if (couponData) {
      pendingOrderPayload.coupon_code = couponData.code;
      pendingOrderPayload.coupon_discount = discountAmount;
    }

    // Adicionar frete
    if (shippingData) {
      pendingOrderPayload.shipping = shippingData;
    }

    const { data: pendingOrder, error: pendingOrderError } = await supabase
      .from('pending_orders')
      .insert([pendingOrderPayload])
      .select()
      .single();

    if (pendingOrderError) {
      console.error('Erro ao criar pedido pendente:', pendingOrderError);
      return res.status(500).json({ 
        error: 'Erro ao processar pedido. Tente novamente.',
        details: pendingOrderError.message 
      });
    }

    // Retornar dados do pagamento para o frontend exibir QR Code
    res.json({
      pending_order_id: pendingOrder.id,
      payment: {
        txid: pixPayment.txid,
        qrcode: pixPayment.qrcode,
        qrcode_image: pixPayment.qrcode_image,
        expires_at: pixPayment.expires_at,
        amount: finalTotal,
        status: 'pending'
      },
      order_summary: {
        items_count: orderItems.length,
        subtotal: total,
        discount: discountAmount,
        shipping: shippingData,
        total: finalTotal,
        coupon: couponData
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: list orders
router.get('/', adminRequired, async (req, res) => {
  try {
    // Buscar pedidos
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (ordersError) return res.status(500).json({ error: ordersError.message });
    
    // Buscar informações dos usuários para cada pedido
    const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, address')
      .in('id', userIds);
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      // Continuar mesmo se houver erro ao buscar usuários
    }
    
    // Criar mapa de usuários por ID
    const usersMap = {};
    (users || []).forEach(user => {
      usersMap[user.id] = user;
    });
    
    // Formatar os dados para incluir informações do usuário
    const formattedOrders = orders.map(order => {
      const user = usersMap[order.user_id];
      return {
        ...order,
        user_name: user?.name || 'Usuário',
        user_email: user?.email || '',
        user_address: user?.address || null
      };
    });
    
    res.json({ orders: formattedOrders });
  } catch (err) {
    console.error('Error in GET /api/orders:', err);
    res.status(500).json({ error: err.message });
  }
});

// User: get current user's orders
router.get('/mine', authRequired, async (req, res) => {
  try {
    const { data, error } = await supabase.from('orders').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    
    // Adicionar imagens aos itens do pedido
    if (data && data.length > 0) {
      for (const order of data) {
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            // Se o item já tem uma imagem, pular
            if (item.image) continue;
            
            // Buscar o produto para obter a imagem
            if (item.product_id) {
              try {
                const { data: productData } = await supabase
                  .from('products')
                  .select('images')
                  .eq('id', item.product_id)
                  .single();
                
                if (productData && productData.images && productData.images.length > 0) {
                  // Usar a primeira imagem do produto
                  item.image = productData.images[0];
                }
              } catch (productError) {
                console.warn('Erro ao buscar imagem do produto:', productError);
              }
            }
          }
        }
      }
    }
    
    res.json({ orders: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verificar status de pagamento de um pedido pendente
router.get('/pending/:id/status', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar pedido pendente
    const { data: pendingOrder, error: pendingError } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id) // Garantir que é do usuário logado
      .single();

    if (pendingError || !pendingOrder) {
      return res.status(404).json({ error: 'Pedido pendente não encontrado' });
    }

    // Se já está pago, verificar se order foi criado
    if (pendingOrder.payment_status === 'paid') {
      // Buscar order pelo payment.txid (pode estar em payment JSONB)
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, created_at, payment')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Filtrar orders que têm o txid no payment
      const order = orders?.find(o => {
        if (o.payment && typeof o.payment === 'object') {
          return o.payment.txid === pendingOrder.payment_id;
        }
        return false;
      });

      return res.json({
        status: 'paid',
        order_id: order?.id || null,
        order_status: order?.status || null
      });
    }

    // Verificar status no Efí Bank
    if (pendingOrder.payment_id) {
      try {
        const paymentStatus = await efibankService.getPixChargeStatus(pendingOrder.payment_id);
        
        // Atualizar status no banco se mudou
        if (paymentStatus.status === 'paid' && pendingOrder.payment_status !== 'paid') {
          console.log(`[Orders] Pagamento confirmado para pedido pendente ${id}. Criando pedido e diminuindo estoque...`);
          
          // Verificar se o pedido já foi criado (evitar duplicação)
          // Buscar orders recentes do usuário e verificar se algum tem o mesmo txid
          const { data: recentOrders } = await supabase
            .from('orders')
            .select('id, payment')
            .eq('user_id', pendingOrder.user_id)
            .order('created_at', { ascending: false })
            .limit(10);
          
          const existingOrder = recentOrders?.find(o => {
            if (o.payment && typeof o.payment === 'object') {
              return o.payment.txid === pendingOrder.payment_id;
            }
            return false;
          });
          
          if (existingOrder) {
            console.log(`[Orders] Pedido já existe: ${existingOrder.id}. Apenas atualizando status do pending_order.`);
            await supabase
              .from('pending_orders')
              .update({ 
                payment_status: 'paid',
                updated_at: new Date().toISOString()
              })
              .eq('id', id);
            
            return res.json({
              status: 'paid',
              paid_at: paymentStatus.paid_at,
              order_id: existingOrder.id
            });
          }
          
          // Atualizar status do pedido pendente
          await supabase
            .from('pending_orders')
            .update({ 
              payment_status: 'paid',
              updated_at: new Date().toISOString()
            })
            .eq('id', id);

          // Criar o pedido real e diminuir estoque
          const orderPayload = {
            user_id: pendingOrder.user_id,
            items: pendingOrder.items,
            total: pendingOrder.total,
            address: pendingOrder.address,
            status: 'pedido feito',
            payment: {
              txid: pendingOrder.payment_id,
              method: 'pix',
              status: 'paid',
              paid_at: paymentStatus.paid_at || new Date().toISOString()
            },
            payment_confirmed_at: new Date().toISOString()
          };

          // Adicionar campos de cupom se houver
          if (pendingOrder.coupon_code) {
            orderPayload.coupon_code = pendingOrder.coupon_code;
            orderPayload.coupon_discount = pendingOrder.coupon_discount || 0;
          }

          const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert([orderPayload])
            .select()
            .single();

          if (orderError) {
            console.error('Erro ao criar pedido após pagamento:', orderError);
            // Continuar mesmo com erro, mas logar
          } else {
            console.log(`[Orders] Pedido criado com sucesso: ${order.id}`);

            // Diminuir estoque dos produtos
            const productIds = pendingOrder.items.map(item => item.product_id);
            const { data: products } = await supabase
              .from('products')
              .select('id, stock')
              .in('id', productIds);

            if (products) {
              for (const item of pendingOrder.items) {
                const product = products.find(p => p.id === item.product_id);
                if (product) {
                  const newStock = Math.max(0, (product.stock || 0) - item.qty);
                  const { error: stockError } = await supabase
                    .from('products')
                    .update({ stock: newStock })
                    .eq('id', product.id);
                  
                  if (stockError) {
                    console.error(`Erro ao atualizar estoque do produto ${product.id}:`, stockError);
                  } else {
                    console.log(`[Orders] Estoque do produto ${product.id} atualizado: ${product.stock} → ${newStock}`);
                  }
                }
              }
            }

            // Enviar email para admin (opcional)
            try {
              const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT || 587),
                secure: false,
                auth: { 
                  user: process.env.SMTP_USER, 
                  pass: process.env.SMTP_PASS 
                }
              });

              const adminEmail = process.env.ADMIN_EMAIL;
              if (adminEmail && transporter) {
                const itemsText = order.items.map(i => `- ${i.name} x${i.qty} - R$ ${(i.price * i.qty).toFixed(2)}`).join('\n');
                const text = `Novo pedido confirmado #${order.id.substring(0, 8)}\n\n` +
                  `Cliente: ${pendingOrder.user_id}\n` +
                  `Total: R$ ${(order.total || 0).toFixed(2)}\n` +
                  `Endereço: ${JSON.stringify(order.address || {})}\n\n` +
                  `Itens:\n${itemsText}`;
                
                await transporter.sendMail({
                  from: process.env.SMTP_USER,
                  to: adminEmail,
                  subject: `✅ Novo pedido confirmado #${order.id.substring(0, 8)}`,
                  text,
                  html: `<pre>${text}</pre>`
                });
              }
            } catch (emailError) {
              console.error('Erro ao enviar email:', emailError);
              // Não falhar por erro de email
            }
          }
        }

        // Se o pagamento foi confirmado, buscar o order_id criado
        let orderId = null;
        if (paymentStatus.status === 'paid') {
          const { data: latestOrder } = await supabase
            .from('orders')
            .select('id')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          orderId = latestOrder?.id || null;
        }

        return res.json({
          status: paymentStatus.status,
          paid_at: paymentStatus.paid_at,
          order_id: orderId
        });
      } catch (error) {
        console.error('Erro ao verificar status do pagamento:', error);
        // Retornar status do banco mesmo se houver erro na API
        return res.json({
          status: pendingOrder.payment_status,
          error: 'Erro ao verificar status na API'
        });
      }
    }

    res.json({ status: pendingOrder.payment_status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: update order status and delivery estimate
router.put('/:id/status', adminRequired, async (req, res) => {
  const id = req.params.id;
  const { status, delivery_estimate } = req.body;
  const { data, error } = await supabase.from('orders').update({ status, delivery_estimate }).eq('id', id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ order: data });
});

module.exports = router;