-- Migração: Adicionar campos de cupom à tabela orders
-- Execute este script para adicionar suporte a cupons nos pedidos

-- Adicionar coluna coupon_code (código do cupom usado)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS coupon_code text;

-- Adicionar coluna coupon_discount (valor do desconto aplicado)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS coupon_discount numeric(10,2) DEFAULT 0;

-- Comentários para documentação
COMMENT ON COLUMN public.orders.coupon_code IS 'Código do cupom de desconto aplicado no pedido';
COMMENT ON COLUMN public.orders.coupon_discount IS 'Valor do desconto aplicado pelo cupom (em R$)';

-- Verificar se as colunas foram criadas (opcional - para confirmar)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'orders' 
  AND column_name IN ('coupon_code', 'coupon_discount');

