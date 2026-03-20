import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Papa from 'papaparse';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const supplierName = searchParams.get('supplier_name');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const costType = searchParams.get('cost_type');
    const status = searchParams.get('status');

    let query = supabase
      .from('invoices')
      .select('*, project:projects(name, code), invoice_lines(*)');

    if (projectId) query = query.eq('project_id', projectId);
    if (supplierName)
      query = query.ilike('supplier_name', `%${supplierName}%`);
    if (dateFrom) query = query.gte('invoice_date', dateFrom);
    if (dateTo) query = query.lte('invoice_date', dateTo);
    if (costType) query = query.eq('cost_type', costType);
    if (status) query = query.eq('status', status);

    const { data: invoices, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao buscar dados' },
        { status: 500 }
      );
    }

    const rows: Record<string, unknown>[] = [];

    for (const inv of invoices || []) {
      const baseRow = {
        'Fornecedor': inv.supplier_name || '',
        'Nº Fatura': inv.invoice_number || '',
        'Data': inv.invoice_date || '',
        'Valor Total': inv.total_amount || 0,
        'IVA': inv.vat_amount || 0,
        'Moeda': inv.currency || 'EUR',
        'Projeto Código': inv.project?.code || '',
        'Projeto Nome': inv.project?.name || '',
        'Tipo de Custo': inv.cost_type || '',
        'Estado': inv.status,
        'Data Criação': inv.created_at,
      };

      if (inv.invoice_lines && inv.invoice_lines.length > 0) {
        for (const line of inv.invoice_lines) {
          rows.push({
            ...baseRow,
            'Linha Descrição': line.description || '',
            'Linha Quantidade': line.quantity || 0,
            'Linha Preço Unitário': line.unit_price || 0,
            'Linha Total': line.total || 0,
          });
        }
      } else {
        rows.push({
          ...baseRow,
          'Linha Descrição': '',
          'Linha Quantidade': '',
          'Linha Preço Unitário': '',
          'Linha Total': '',
        });
      }
    }

    const csv = Papa.unparse(rows, { delimiter: ';' });
    const bom = '\uFEFF';

    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="faturas_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
