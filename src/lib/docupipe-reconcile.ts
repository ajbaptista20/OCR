import { createServiceClient } from '@/lib/supabase/server';
import { getDocuPipeDocumentStatus } from '@/lib/docupipe';

type ReconcileResult = {
  reconciled: boolean;
  status: 'processing' | 'pending_review';
  source: 'webhook' | 'poll';
  reason?: string;
};

function normalizeStatus(value: string) {
  return value.toLowerCase().trim();
}

export async function reconcileInvoiceOcr(
  invoiceId: string
): Promise<ReconcileResult> {
  const supabase = await createServiceClient();

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, status, docupipe_id')
    .eq('id', invoiceId)
    .single();

  if (invoiceError || !invoice) {
    throw new Error('Fatura não encontrada para reconciliação OCR');
  }

  if (invoice.status !== 'processing') {
    return {
      reconciled: true,
      status: 'pending_review',
      source: 'webhook',
      reason: 'invoice_not_processing',
    };
  }

  if (!invoice.docupipe_id) {
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ status: 'pending_review' })
      .eq('id', invoiceId);

    if (updateError) {
      throw new Error('Erro ao mover fatura sem docupipe_id para revisão');
    }

    return {
      reconciled: true,
      status: 'pending_review',
      source: 'poll',
      reason: 'missing_docupipe_id',
    };
  }

  const rawStatus = await getDocuPipeDocumentStatus(invoice.docupipe_id);
  const docStatus = normalizeStatus(rawStatus);

  if (docStatus === 'processing' || docStatus === 'queued') {
    return {
      reconciled: false,
      status: 'processing',
      source: 'poll',
      reason: docStatus,
    };
  }

  const { error: updateError } = await supabase
    .from('invoices')
    .update({ status: 'pending_review' })
    .eq('id', invoiceId);

  if (updateError) {
    throw new Error('Erro ao atualizar fatura após reconciliação OCR');
  }

  return {
    reconciled: true,
    status: 'pending_review',
    source: 'poll',
    reason: docStatus,
  };
}
