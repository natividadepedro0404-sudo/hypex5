const express = require('express');
const { body, param } = require('express-validator');
const supabase = require('../db/supabaseClient');
const { authRequired, adminRequired } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Public: validate coupon
router.post('/validate', authRequired, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Código do cupom é obrigatório.' });

    const now = new Date().toISOString();
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .single();

    if (error || !coupon) {
      return res.status(404).json({ error: 'Cupom não encontrado.' });
    }

    // Verificar se o cupom está ativo
    if (!coupon.active) {
      return res.status(400).json({ error: 'Este cupom está inativo.' });
    }

    // Verificar se o cupom não expirou
    if (new Date(coupon.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Este cupom expirou.' });
    }

    // Verificar limite de uso
    if (coupon.usage_limit !== null && coupon.usage_limit !== undefined && coupon.usage_limit > 0) {
      try {
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
          return res.status(400).json({ error: 'Este cupom esgotou (limite de uso atingido).' });
        }
      } catch (err) {
        // Se houver erro ao verificar limite, apenas logar e continuar
        console.warn('Erro ao verificar limite de uso do cupom:', err.message);
      }
    }

    res.json({ coupon });
  } catch (err) {
    console.error('Erro ao validar cupom:', err);
    res.status(500).json({ error: 'Erro ao validar cupom.' });
  }
});

// Admin: list coupons
router.get('/', adminRequired, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ coupons: data || [] });
  } catch (err) {
    console.error('GET /api/coupons error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Validation rules for creating/updating coupons
const couponValidators = [
  body('code')
    .exists().withMessage('Código é obrigatório')
    .isAlphanumeric().withMessage('Código deve ser alfanumérico')
    .isLength({ min: 3, max: 30 }).withMessage('Código deve ter entre 3 e 30 caracteres')
    .custom(async (value, { req }) => {
      // For creation: ensure unique code. For update: allow same code for the same id
      const q = supabase.from('coupons').select('id, code').eq('code', value);
      const { data, error } = await q;
      if (error) throw new Error('Erro ao verificar código');
      if (data && data.length) {
        // If updating, it's okay if the found id equals params.id
        if (req.params && req.params.id) {
          const existing = data.find(d => String(d.id) === String(req.params.id));
          if (existing) return true;
        }
        throw new Error('Código já existe');
      }
      return true;
    }),
  body('type')
    .exists().withMessage('Tipo é obrigatório')
    .isIn(['percentage', 'fixed']).withMessage('Tipo inválido'),
  body('value')
    .exists().withMessage('Valor é obrigatório')
    .isFloat({ gt: 0 }).withMessage('Valor deve ser maior que 0'),
  body('expires_at')
    .exists().withMessage('Data de expiração é obrigatória')
    .custom(value => {
      if (!value || value.trim() === '') throw new Error('Data de expiração é obrigatória');
      
      // Aceitar tanto formato YYYY-MM-DD quanto ISO8601
      let dateStr = value.trim();
      let date;
      
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Formato YYYY-MM-DD - validar se é uma data válida
        const parts = dateStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // meses são 0-indexed
        const day = parseInt(parts[2], 10);
        date = new Date(year, month, day);
        
        // Verificar se a data é válida (evita datas inválidas como 2024-02-30)
        if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
          throw new Error('Data inválida');
        }
      } else {
        // Tentar parsear como ISO8601
        date = new Date(dateStr);
        if (isNaN(date.getTime())) throw new Error('Data inválida');
      }
      
      // Permitir data de hoje ou futuro (comparar apenas a data, não a hora)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expDate = new Date(date);
      expDate.setHours(0, 0, 0, 0);
      
      if (expDate < today) throw new Error('Data de expiração deve ser hoje ou no futuro');
      return true;
    }),
  body('usage_limit')
    .optional({ values: 'falsy' })
    .custom(value => {
      // Se não foi fornecido, está ok (opcional)
      if (value === undefined || value === null || value === '') return true;
      
      // Converter para número e validar
      const num = Number(value);
      if (isNaN(num)) throw new Error('Limite de uso deve ser um número');
      if (num < 0) throw new Error('Limite de uso deve ser maior ou igual a 0');
      if (!Number.isInteger(num)) throw new Error('Limite de uso deve ser um número inteiro');
      return true;
    })
];

// Admin: create coupon
router.post('/', adminRequired, validate(couponValidators), async (req, res) => {
  try {
    const { code, type, value, expires_at, usage_limit } = req.body;

    // Converter data YYYY-MM-DD para formato ISO8601 completo se necessário
    let expiresAt = expires_at;
    if (expires_at && expires_at.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Adicionar hora para garantir que a data seja válida
      expiresAt = expires_at + 'T23:59:59.000Z';
    }
    
    const payload = { code: code?.trim(), type, value, expires_at: expiresAt };
    // Incluir usage_limit apenas se for um número válido >= 0
    if (usage_limit !== undefined && usage_limit !== null && usage_limit !== '') {
      const limit = Number(usage_limit);
      if (!isNaN(limit) && limit >= 0) {
        payload.usage_limit = limit;
      }
    }

    const { data, error } = await supabase
      .from('coupons')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar cupom:', error);
      return res.status(400).json({ error: error.message });
    }
    res.json({ coupon: data });
  } catch (err) {
    console.error('POST /api/coupons error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: update coupon
router.put('/:id', adminRequired, validate([
  param('id').exists().withMessage('ID obrigatório'),
  // reuse validators but code should be optional on update
  body('code').optional().isAlphanumeric().withMessage('Código deve ser alfanumérico'),
  body('type').optional().isIn(['percentage', 'fixed']).withMessage('Tipo inválido'),
  body('value').optional().isFloat({ gt: 0 }).withMessage('Valor deve ser maior que 0'),
  body('expires_at').optional().custom(value => {
    if (!value || value.trim() === '') return true; // Opcional na atualização
    
    let dateStr = value.trim();
    let date;
    
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parts = dateStr.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      date = new Date(year, month, day);
      
      if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
        throw new Error('Data inválida');
      }
    } else {
      date = new Date(dateStr);
      if (isNaN(date.getTime())) throw new Error('Data inválida');
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(date);
    expDate.setHours(0, 0, 0, 0);
    if (expDate < today) throw new Error('Data de expiração deve ser hoje ou no futuro');
    return true;
  }),
  body('usage_limit').optional({ values: 'falsy' }).custom(value => {
    if (value === undefined || value === null || value === '') return true;
    const num = Number(value);
    if (isNaN(num)) throw new Error('Limite de uso deve ser um número');
    if (num < 0) throw new Error('Limite de uso deve ser maior ou igual a 0');
    if (!Number.isInteger(num)) throw new Error('Limite de uso deve ser um número inteiro');
    return true;
  })
]), async (req, res) => {
  try {
    const { id } = req.params;
    const changes = {};
    
    // Incluir apenas campos que foram enviados e são válidos
    if (req.body.code !== undefined) changes.code = req.body.code?.trim();
    if (req.body.type !== undefined) changes.type = req.body.type;
    if (req.body.value !== undefined) changes.value = Number(req.body.value);
    if (req.body.expires_at !== undefined) {
      // Converter data YYYY-MM-DD para formato ISO8601 completo se necessário
      let expiresAt = req.body.expires_at;
      if (expiresAt && expiresAt.match(/^\d{4}-\d{2}-\d{2}$/)) {
        expiresAt = expiresAt + 'T23:59:59.000Z';
      }
      changes.expires_at = expiresAt;
    }
    
    // Processar usage_limit - só incluir se for um número válido
    if (req.body.usage_limit !== undefined && req.body.usage_limit !== null && req.body.usage_limit !== '') {
      const limit = Number(req.body.usage_limit);
      if (!isNaN(limit) && limit >= 0) {
        changes.usage_limit = limit;
      }
    } else if (req.body.usage_limit === null || req.body.usage_limit === '') {
      // Se for null ou string vazia, definir como null (ilimitado)
      changes.usage_limit = null;
    }

    const { data, error } = await supabase
      .from('coupons')
      .update(changes)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar cupom:', error);
      return res.status(400).json({ error: error.message });
    }
    res.json({ coupon: data });
  } catch (err) {
    console.error('PUT /api/coupons/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: delete coupon
router.delete('/:id', adminRequired, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('coupons')
    .delete()
    .eq('id', id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;