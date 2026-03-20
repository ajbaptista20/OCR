import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { InvoiceDetail } from '@/components/invoice-detail';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, invoice_lines(*), project:projects(*)')
    .eq('id', id)
    .single();

  if (error || !invoice) notFound();

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('code');

  if (invoice.status === 'processing') {
    return (
      <div className="max-w-2xl mx-auto">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft size={16} />
          Voltar
        </Link>
        <div className="card p-8 text-center">
          <Loader2 size={40} className="mx-auto text-brand-500 animate-spin mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">
            A processar OCR...
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            Os dados da fatura estão a ser extraídos automaticamente. Atualize a
            página em alguns momentos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft size={16} />
        Voltar
      </Link>
      <InvoiceDetail
        invoice={invoice}
        projects={projects || []}
        profile={profile!}
      />
    </div>
  );
}
