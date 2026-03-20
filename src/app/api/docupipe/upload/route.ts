import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadToDocuPipe } from '@/lib/docupipe';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { invoiceId, base64File, fileName } = await request.json();

    if (!invoiceId || !base64File || !fileName) {
      return NextResponse.json(
        { error: 'Campos obrigatórios em falta' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('invoices')
      .update({ status: 'processing' })
      .eq('id', invoiceId);

    if (updateError) {
      console.error('Failed to update invoice status:', updateError);
    }

    try {
      const result = await uploadToDocuPipe(base64File, fileName, {
        invoice_id: invoiceId,
      });

      await supabase
        .from('invoices')
        .update({ docupipe_id: result.document_id })
        .eq('id', invoiceId);

      return NextResponse.json({
        success: true,
        documentId: result.document_id,
      });
    } catch (docuError) {
      console.error('DocuPipe upload failed:', docuError);

      await supabase
        .from('invoices')
        .update({ status: 'pending_review' })
        .eq('id', invoiceId);

      return NextResponse.json(
        {
          success: false,
          message: 'OCR falhou — a fatura pode ser editada manualmente',
        },
        { status: 200 }
      );
    }
  } catch (err) {
    console.error('DocuPipe upload route error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
