const express = require('express');
const supabase = require('../db/supabaseClient');
const nodemailer = require('nodemailer');

const router = express.Router();

// Efí Bank webhook endpoint
// Recebe notificação quando pagamento PIX é confirmado
router.post('/efibank', express.json(), async (req, res) => {
  // Validar webhook secret se fornecido
  const secret = process.env.EFIBANK_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers['x-efibank-signature'] || req.headers['x-gerencianet-signature'];
    if (!sig || sig !== secret) {
      return res.status(403).json({ error: 'Invalid webhook signature' });
    }
  }

  const payload = req.body;
  
  try {
    
    let txid = null;
    
    // Verificar diferentes formatos de webhook
    if (payload.pix && Array.isArray(payload.pix) && payload.pix.length > 0) {
      // Formato direto do PIX
      txid = payload.pix[0].txid;
    } else if (payload.event === 'payment.succeeded' && payload.data?.txid) {
      // Formato de evento
      txid = payload.data.txid;
    } else if (payload.txid) {
      // Formato simples
      txid = payload.txid;
    }

    if (!txid) {
      console.log('Webhook recebido sem txid válido:', payload);
      return res.json({ ok: true, message: 'No txid found' });
    }

    // Buscar pedido pendente pelo payment_id (txid)
    const { data: pendingOrder, error: pendingError } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('payment_id', txid)
      .eq('payment_status', 'pending')
      .single();

    if (pendingError || !pendingOrder) {
      console.log('Pedido pendente não encontrado para txid:', txid);
      return res.json({ ok: true, message: 'Pending order not found' });
    }

    // Atualizar status do pedido pendente
    await supabase
      .from('pending_orders')
      .update({ 
        payment_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', pendingOrder.id);

    // AGORA SIM: Criar o pedido real e diminuir estoque
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
        paid_at: new Date().toISOString()
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
      return res.status(500).json({ error: 'Erro ao criar pedido' });
    }

    // Diminuir estoque dos produtos
    const productIds = pendingOrder.items.map(item => item.product_id);
    const { data: products } = await supabase
      .from('products')
      .select('id, stock, name')
      .in('id', productIds);

    if (products && products.length > 0) {
      console.log(`[Webhook] Atualizando estoque de ${products.length} produto(s)...`);
      for (const item of pendingOrder.items) {
        // Para variações, atualizar estoque da variação
        if (item.variation_id) {
          const { data: variation } = await supabase
            .from('product_variations')
            .select('stock, name')
            .eq('id', item.variation_id)
            .eq('product_id', item.product_id)
            .single();
            
          if (variation) {
            const oldStock = variation.stock || 0;
            const newStock = Math.max(0, oldStock - item.qty);
            const { error: stockError } = await supabase
              .from('product_variations')
              .update({ stock: newStock })
              .eq('id', item.variation_id);
            
            if (stockError) {
              console.error(`[Webhook] Erro ao atualizar estoque da variação ${item.variation_id}:`, stockError);
            } else {
              console.log(`[Webhook] ✓ Estoque da variação "${variation.name}" (${item.variation_id}) atualizado: ${oldStock} → ${newStock}`);
            }
          } else {
            console.warn(`[Webhook] Variação ${item.variation_id} não encontrada para atualizar estoque`);
          }
        } else {
          // Atualizar estoque do produto base
          const product = products.find(p => p.id === item.product_id);
          if (product) {
            const oldStock = product.stock || 0;
            const newStock = Math.max(0, oldStock - item.qty);
            const { error: stockError } = await supabase
              .from('products')
              .update({ stock: newStock })
              .eq('id', product.id);
            
            if (stockError) {
              console.error(`[Webhook] Erro ao atualizar estoque do produto ${product.id}:`, stockError);
            } else {
              console.log(`[Webhook] ✓ Estoque do produto "${product.name}" (${product.id}) atualizado: ${oldStock} → ${newStock}`);
            }
          } else {
            console.warn(`[Webhook] Produto ${item.product_id} não encontrado para atualizar estoque`);
          }
        }
      }
    } else {
      console.warn('[Webhook] Nenhum produto encontrado para atualizar estoque');
    }

    // Enviar email para admin
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
        const itemsText = order.items.map(i => {
          let itemText = `- ${i.name} x${i.qty} - R$ ${(i.price * i.qty).toFixed(2)}`;
          if (i.size) {
            itemText += ` (Tamanho: ${i.size})`;
          }
          if (i.variation_id) {
            itemText += ` (Variação)`;
          }
          return itemText;
        }).join('\n');
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
      // Não falhar o webhook por erro de email
    }

    console.log(`Pedido criado com sucesso após pagamento: ${order.id}`);
    return res.json({ ok: true, order_id: order.id });
  } catch (err) {
    console.error('Erro no webhook:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;