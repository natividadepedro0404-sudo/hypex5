-- Tabela para armazenar pedidos pendentes de pagamento
-- Estes pedidos só serão confirmados após pagamento ser aprovado

CREATE TABLE IF NOT EXISTS public.pending_orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  items jsonb NOT NULL,
  total numeric(10,2) NOT NULL,
  address jsonb,
  coupon_code text,
  coupon_discount numeric(10,2) DEFAULT 0,
  payment_id text, -- ID do pagamento no Efí Bank
  payment_qrcode text, -- QR Code do PIX
  payment_qrcode_image text, -- URL da imagem do QR Code
  payment_status text DEFAULT 'pending', -- pending, paid, expired, cancelled
  expires_at timestamptz, -- Data de expiração do pagamento
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_pending_orders_user_id ON public.pending_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_payment_id ON public.pending_orders(payment_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_status ON public.pending_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_pending_orders_expires_at ON public.pending_orders(expires_at);

-- Comentários
COMMENT ON TABLE public.pending_orders IS 'Pedidos pendentes de pagamento. Só são convertidos em orders após pagamento confirmado.';
COMMENT ON COLUMN public.pending_orders.payment_status IS 'Status do pagamento: pending, paid, expired, cancelled';

