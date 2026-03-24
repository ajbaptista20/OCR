import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { DocuPipeWebhookPayload } from '@/lib/docupipe';

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.DOCUPIPE_WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${webhookSecret}`) {
        console.error('DocuPipe webhook unauthorized: invalid authorization header');
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
      }
    }

    const payload: DocuPipeWebhookPayload = await request.json();
    const { document_id, status, data, error } = payload;
    console.log('DocuPipe webhook received', { document_id, status });

    if (!document_id) {
      return NextResponse.json(
        { error: 'document_id obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('id, docupipe_job_id')
      .eq('docupipe_id', document_id)
      .single();

    if (fetchError || !invoice) {
      console.error('Invoice not found for docupipe_id:', document_id);
      return NextResponse.json(
        { error: 'Fatura não encontrada' },
        { status: 404 }
      );
    }

    console.log('DocuPipe webhook matched invoice', {
      invoice_id: invoice.id,
      document_id,
      job_id: invoice.docupipe_job_id,
      status,
    });

    if (status === 'failed') {
      const { error: failUpdateError } = await supabase
        .from('invoices')
        .update({ status: 'pending_review' })
        .eq('id', invoice.id);

      if (failUpdateError) {
        console.error('Failed to mark failed OCR as pending_review:', failUpdateError);
        return NextResponse.json(
          { error: 'Erro ao atualizar fatura' },
          { status: 500 }
        );
      }

      console.error('DocuPipe processing failed:', error);
      return NextResponse.json({ success: true, status: 'failed_gracefully' });
    }

    if (status !== 'completed') {
      console.error('Unsupported DocuPipe webhook status:', status);
      return NextResponse.json(
        { error: 'Status de webhook inválido' },
        { status: 400 }
      );
    }

    if (!data) {
      const { error: emptyDataUpdateError } = await supabase
        .from('invoices')
        .update({ status: 'pending_review' })
        .eq('id', invoice.id);

      if (emptyDataUpdateError) {
        console.error('Failed to update invoice after empty completed payload:', emptyDataUpdateError);
        return NextResponse.json(
          { error: 'Erro ao atualizar fatura' },
          { status: 500 }
        );
      }

      console.error('DocuPipe completed without data:', document_id);
      return NextResponse.json({ success: true, status: 'completed_without_data' });
    }

    const updateData: Record<string, unknown> = {
      status: 'pending_review',
    };

    if (data.supplier_name) updateData.supplier_name = data.supplier_name;
    if (data.invoice_number) updateData.invoice_number = data.invoice_number;
    if (data.invoice_date) updateData.invoice_date = data.invoice_date;
    if (data.total_amount != null) updateData.total_amount = data.total_amount;
    if (data.vat_amount != null) updateData.vat_amount = data.vat_amount;
    if (data.currency) updateData.currency = data.currency;

    const { error: updateError } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoice.id);

    if (updateError) {
      console.error('Failed to update invoice:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar fatura' },
        { status: 500 }
      );
    }

    if (data.line_items && data.line_items.length > 0) {
      const lines = data.line_items.map((item) => ({
        invoice_id: invoice.id,
        description: item.description || '',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total: item.total || (item.quantity || 1) * (item.unit_price || 0),
      }));

      const { error: linesError } = await supabase
        .from('invoice_lines')
        .insert(lines);

      if (linesError) {
        console.error('Failed to insert line items:', linesError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
