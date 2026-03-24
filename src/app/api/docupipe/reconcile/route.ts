import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reconcileInvoiceOcr } from '@/lib/docupipe-reconcile';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { invoiceId } = await request.json();
    if (!invoiceId) {
      return NextResponse.json(
        { error: 'invoiceId obrigatório' },
        { status: 400 }
      );
    }

    const result = await reconcileInvoiceOcr(invoiceId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('DocuPipe reconcile route error:', err);
    return NextResponse.json(
      { error: 'Erro ao reconciliar OCR' },
      { status: 500 }
    );
  }
}
