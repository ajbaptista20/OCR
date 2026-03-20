import { createClient } from '@/lib/supabase/server';
import { InvoiceList } from '@/components/invoice-list';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default async function InvoicesPage() {
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, project:projects(id, name, code)')
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Faturas</h1>
        <Link href="/invoices/upload" className="btn-primary text-sm">
          <Plus size={16} />
          Nova Fatura
        </Link>
      </div>
      <InvoiceList invoices={invoices || []} />
    </div>
  );
}
