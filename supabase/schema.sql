-- ============================================
-- Construction Invoice Manager - Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- User role enum (dropdown in Supabase table editor)
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_role' and n.nspname = 'public'
  ) then
    create type public.user_role as enum ('admin', 'accounting', 'manager');
  end if;
end $$;

-- ============================================
-- PROFILES (linked to auth.users)
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  role public.user_role not null default 'manager',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Role helper functions (security definer to avoid RLS recursion)
create or replace function public.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin'::public.user_role, 'manager'::public.user_role)
  );
$$;

create or replace function public.is_admin_manager_or_accounting()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in (
        'admin'::public.user_role,
        'manager'::public.user_role,
        'accounting'::public.user_role
      )
  );
$$;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin_or_manager());

create policy "Admins can update profiles"
  on public.profiles for update
  using (public.is_admin_or_manager());

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'admin'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- PROJECTS
-- ============================================
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  code text not null unique,
  created_at timestamptz default now()
);

alter table public.projects enable row level security;

create policy "Authenticated users can view projects"
  on public.projects for select
  using (auth.role() = 'authenticated');

create policy "Admins can insert projects"
  on public.projects for insert
  with check (public.is_admin_or_manager());

create policy "Admins can update projects"
  on public.projects for update
  using (public.is_admin_or_manager());

create policy "Admins can delete projects"
  on public.projects for delete
  using (public.is_admin_or_manager());

-- ============================================
-- INVOICES
-- ============================================
create table public.invoices (
  id uuid default uuid_generate_v4() primary key,
  supplier_name text,
  invoice_number text,
  invoice_date date,
  total_amount numeric(12,2),
  vat_amount numeric(12,2),
  currency text default 'EUR',
  project_id uuid references public.projects(id),
  cost_type text check (cost_type in ('materials', 'meals', 'services', 'other')),
  status text not null default 'uploaded' check (
    status in ('uploaded', 'processing', 'pending_review', 'pending_approval', 'approved', 'rejected')
  ),
  docupipe_id text,
  file_path text,
  file_name text,
  uploaded_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  rejection_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.invoices enable row level security;

create policy "Admins and accounting can view all invoices"
  on public.invoices for select
  using (public.is_admin_manager_or_accounting());

create policy "Managers can view own invoices"
  on public.invoices for select
  using (uploaded_by = auth.uid());

create policy "Authenticated users can insert invoices"
  on public.invoices for insert
  with check (auth.role() = 'authenticated');

create policy "Users can update invoices they uploaded (pre-approval)"
  on public.invoices for update
  using (
    uploaded_by = auth.uid()
    and status in ('uploaded', 'processing', 'pending_review')
  );

create policy "Admins can update any invoice"
  on public.invoices for update
  using (public.is_admin_or_manager());

create policy "Accounting can update invoices for approval"
  on public.invoices for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'accounting'
    )
    and status in ('pending_approval')
  );

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger invoices_updated_at
  before update on public.invoices
  for each row execute procedure public.update_updated_at();

-- ============================================
-- INVOICE LINE ITEMS
-- ============================================
create table public.invoice_lines (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  description text,
  quantity numeric(10,3) default 1,
  unit_price numeric(12,2) default 0,
  total numeric(12,2) default 0,
  created_at timestamptz default now()
);

alter table public.invoice_lines enable row level security;

create policy "Users can view invoice lines for accessible invoices"
  on public.invoice_lines for select
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id
      and (
        i.uploaded_by = auth.uid()
        or public.is_admin_manager_or_accounting()
      )
    )
  );

create policy "Authenticated users can insert invoice lines"
  on public.invoice_lines for insert
  with check (auth.role() = 'authenticated');

create policy "Users can update invoice lines for their invoices"
  on public.invoice_lines for update
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id
      and (
        i.uploaded_by = auth.uid()
        or public.is_admin_manager_or_accounting()
      )
    )
  );

create policy "Users can delete invoice lines for their invoices"
  on public.invoice_lines for delete
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id
      and (
        i.uploaded_by = auth.uid()
        or public.is_admin_manager_or_accounting()
      )
    )
  );

-- ============================================
-- STORAGE BUCKET
-- ============================================
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can upload invoices'
  ) then
    create policy "Authenticated users can upload invoices"
      on storage.objects for insert
      with check (bucket_id = 'invoices' and auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can view invoice files'
  ) then
    create policy "Users can view invoice files"
      on storage.objects for select
      using (bucket_id = 'invoices' and auth.role() = 'authenticated');
  end if;
end $$;

-- ============================================
-- INDEXES
-- ============================================
create index idx_invoices_project_id on public.invoices(project_id);
create index idx_invoices_status on public.invoices(status);
create index idx_invoices_uploaded_by on public.invoices(uploaded_by);
create index idx_invoices_supplier on public.invoices(supplier_name);
create index idx_invoices_date on public.invoices(invoice_date);
create index idx_invoice_lines_invoice_id on public.invoice_lines(invoice_id);

-- ============================================
-- DUPLICATE DETECTION VIEW
-- ============================================
create or replace view public.potential_duplicates as
select
  i1.id as invoice_id,
  i1.supplier_name,
  i1.invoice_number,
  i2.id as duplicate_of,
  i2.created_at as original_created_at
from public.invoices i1
join public.invoices i2
  on lower(trim(i1.supplier_name)) = lower(trim(i2.supplier_name))
  and lower(trim(i1.invoice_number)) = lower(trim(i2.invoice_number))
  and i1.id != i2.id
  and i2.created_at < i1.created_at;
