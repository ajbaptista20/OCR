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
      console.error('Failed to set invoice as processing:', updateError);
      return NextResponse.json(
        { error: 'Erro ao iniciar processamento OCR' },
        { status: 500 }
      );
    }

    try {
      const result = await uploadToDocuPipe(base64File, fileName, {
        invoice_id: invoiceId,
      });
      const docuPipeId = result.documentId;

      const { error: docuIdError } = await supabase
        .from('invoices')
        .update({ docupipe_id: docuPipeId })
        .eq('id', invoiceId);

      if (docuIdError) {
        console.error('Failed to persist docupipe_id:', docuIdError);
        await supabase
          .from('invoices')
          .update({ status: 'pending_review' })
          .eq('id', invoiceId);

        return NextResponse.json(
          {
            success: false,
            message:
              'OCR iniciado, mas não foi possível guardar a referência. Fatura enviada para revisão manual.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        documentId: docuPipeId,
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
        { status: 502 }
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
