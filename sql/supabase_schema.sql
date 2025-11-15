-- users
create table if not exists public.users (
  id uuid default uuid_generate_v4() primary key,
  email text unique not null,
  password_hash text not null,
  name text,
  address jsonb,
  role text default 'customer',
  created_at timestamptz default now()
);

-- products
create table if not exists public.products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  price numeric(10,2) default 0,
  stock int default 0,
  images text[] default array[]::text[],
  sizes text[] default array[]::text[],
  color text,
  type text,
  brand text,
  created_at timestamptz default now()
);

-- coupons
create table if not exists public.coupons (
  id uuid default uuid_generate_v4() primary key,
  code text unique not null,
  type text check (type in ('percentage','fixed')) not null,
  value numeric not null,
  active boolean default true,
  expires_at timestamptz,
  usage_limit integer
);

-- orders
create table if not exists public.orders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id),
  items jsonb not null,
  total numeric(10,2) not null,
  address jsonb,
  payment jsonb,
  status text default 'pedido feito',
  delivery_estimate timestamptz,
  payment_confirmed_at timestamptz,
  coupon_code text,
  coupon_discount numeric(10,2) default 0,
  created_at timestamptz default now()
);

-- pending_orders: pedidos pendentes de pagamento
-- Só são convertidos em orders após pagamento confirmado
create table if not exists public.pending_orders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade,
  items jsonb not null,
  total numeric(10,2) not null,
  address jsonb,
  coupon_code text,
  coupon_discount numeric(10,2) default 0,
  payment_id text,
  payment_qrcode text,
  payment_qrcode_image text,
  payment_status text default 'pending',
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_pending_orders_user_id on public.pending_orders(user_id);
create index if not exists idx_pending_orders_payment_id on public.pending_orders(payment_id);
create index if not exists idx_pending_orders_status on public.pending_orders(payment_status);
create index if not exists idx_pending_orders_expires_at on public.pending_orders(expires_at);