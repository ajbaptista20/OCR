'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  type Invoice,
  type InvoiceLine,
  type Project,
  type CostType,
  type Profile,
  COST_TYPE_LABELS,
} from '@/lib/types';
import { StatusBadge } from '@/components/status-badge';
import { formatCurrency } from '@/lib/utils';
import { INVOICES_BUCKET } from '@/lib/storage';
import {
  Save,
  Send,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface Props {
  invoice: Invoice;
  projects: Project[];
  profile: Profile;
}

export function InvoiceDetail({ invoice: initial, projects, profile }: Props) {
  const [invoice, setInvoice] = useState(initial);
  const [lines, setLines] = useState<InvoiceLine[]>(
    initial.invoice_lines || []
  );
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const canEdit = ['pending_review', 'uploaded'].includes(invoice.status);
  const canSubmit =
    canEdit && invoice.project_id && invoice.supplier_name && invoice.invoice_number;
  const canApprove =
    invoice.status === 'pending_approval' &&
    ['admin', 'manager', 'accounting'].includes(profile.role);

  useEffect(() => {
    async function loadFileUrl() {
      if (!invoice.file_path) return;

      const { data, error } = await supabase.storage
        .from(INVOICES_BUCKET)
        .createSignedUrl(invoice.file_path, 60 * 60);

      if (error) {
        console.error('Failed to create signed invoice URL:', error);
        setFileUrl(null);
        return;
      }

      setFileUrl(data.signedUrl);
    }

    void loadFileUrl();
  }, [invoice.file_path, supabase.storage]);

  useEffect(() => {
    checkDuplicate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.supplier_name, invoice.invoice_number]);

  async function checkDuplicate() {
    if (!invoice.supplier_name || !invoice.invoice_number) return;
    const { data } = await supabase
      .from('invoices')
      .select('id')
      .ilike('supplier_name', invoice.supplier_name.trim())
      .ilike('invoice_number', invoice.invoice_number.trim())
      .neq('id', invoice.id);
    setDuplicateWarning((data?.length || 0) > 0);
  }

  function updateField(field: string, value: unknown) {
    setInvoice((prev) => ({ ...prev, [field]: value }));
  }

  function updateLine(index: number, field: string, value: unknown) {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? Number(value) : updated[index].quantity;
        const price =
          field === 'unit_price' ? Number(value) : updated[index].unit_price;
        updated[index].total = Number((qty * price).toFixed(2));
      }
      return updated;
    });
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        invoice_id: invoice.id,
        description: '',
        quantity: 1,
        unit_price: 0,
        total: 0,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          supplier_name: invoice.supplier_name,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          total_amount: invoice.total_amount,
          vat_amount: invoice.vat_amount,
          currency: invoice.currency,
          project_id: invoice.project_id,
          cost_type: invoice.cost_type,
        })
        .eq('id', invoice.id);

      if (invoiceError) throw invoiceError;

      const existingIds = lines.filter((l) => !l.id.startsWith('new-')).map((l) => l.id);
      await supabase
        .from('invoice_lines')
        .delete()
        .eq('invoice_id', invoice.id)
        .not('id', 'in', `(${existingIds.join(',')})`);

      for (const line of lines) {
        if (line.id.startsWith('new-')) {
          await supabase.from('invoice_lines').insert({
            invoice_id: invoice.id,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            total: line.total,
          });
        } else {
          await supabase
            .from('invoice_lines')
            .update({
              description: line.description,
              quantity: line.quantity,
              unit_price: line.unit_price,
              total: line.total,
            })
            .eq('id', line.id);
        }
      }

      toast.success('Fatura guardada!');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitForApproval() {
    if (!invoice.project_id) {
      toast.error('Selecione um projeto antes de submeter');
      return;
    }
    setSubmitting(true);
    try {
      await handleSave();
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'pending_approval',
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', invoice.id);
      if (error) throw error;
      toast.success('Submetida para aprovação!');
      router.push('/invoices');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao submeter');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove() {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'approved',
          approved_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', invoice.id);
      if (error) throw error;
      toast.success('Fatura aprovada!');
      router.push('/invoices');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aprovar');
    }
  }

  async function handleReject() {
    const reason = prompt('Motivo da rejeição:');
    if (reason === null) return;
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'rejected',
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          rejection_reason: reason,
        })
        .eq('id', invoice.id);
      if (error) throw error;
      toast.success('Fatura rejeitada');
      router.push('/invoices');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao rejeitar');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Fatura {invoice.invoice_number || '(sem número)'}
          </h1>
          <StatusBadge status={invoice.status} />
        </div>
        {fileUrl && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-sm"
          >
            <FileText size={16} />
            Ver ficheiro
          </a>
        )}
      </div>

      {/* Duplicate warning */}
      {duplicateWarning && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle size={18} />
          <span>
            Possível duplicado detectado! Verifique o fornecedor e número da
            fatura.
          </span>
        </div>
      )}

      {invoice.rejection_reason && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <XCircle size={18} />
          <span>Rejeitada: {invoice.rejection_reason}</span>
        </div>
      )}

      {/* Invoice fields */}
      <div className="card p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          Dados da Fatura
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Fornecedor *</label>
            <input
              type="text"
              className="input"
              value={invoice.supplier_name || ''}
              onChange={(e) => updateField('supplier_name', e.target.value)}
              disabled={!canEdit}
              placeholder="Nome do fornecedor"
            />
          </div>
          <div>
            <label className="label">Nº Fatura *</label>
            <input
              type="text"
              className="input"
              value={invoice.invoice_number || ''}
              onChange={(e) => updateField('invoice_number', e.target.value)}
              disabled={!canEdit}
              placeholder="Número da fatura"
            />
          </div>
          <div>
            <label className="label">Data da Fatura</label>
            <input
              type="date"
              className="input"
              value={invoice.invoice_date || ''}
              onChange={(e) => updateField('invoice_date', e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="label">Moeda</label>
            <select
              className="input"
              value={invoice.currency || 'EUR'}
              onChange={(e) => updateField('currency', e.target.value)}
              disabled={!canEdit}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div>
            <label className="label">Valor Total</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={invoice.total_amount ?? ''}
              onChange={(e) =>
                updateField('total_amount', parseFloat(e.target.value) || null)
              }
              disabled={!canEdit}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="label">IVA</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={invoice.vat_amount ?? ''}
              onChange={(e) =>
                updateField('vat_amount', parseFloat(e.target.value) || null)
              }
              disabled={!canEdit}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="label">Projeto *</label>
            <select
              className="input"
              value={invoice.project_id || ''}
              onChange={(e) =>
                updateField('project_id', e.target.value || null)
              }
              disabled={!canEdit}
            >
              <option value="">Selecionar projeto...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tipo de Custo</label>
            <select
              className="input"
              value={invoice.cost_type || ''}
              onChange={(e) =>
                updateField('cost_type', (e.target.value as CostType) || null)
              }
              disabled={!canEdit}
            >
              <option value="">Selecionar tipo...</option>
              {Object.entries(COST_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Linhas da Fatura
          </h2>
          {canEdit && (
            <button onClick={addLine} className="btn-secondary text-xs">
              <Plus size={14} />
              Adicionar
            </button>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            Sem linhas. Clique em &quot;Adicionar&quot; para começar.
          </p>
        ) : (
          <div className="space-y-3">
            {lines.map((line, i) => (
              <div
                key={line.id}
                className="flex flex-col sm:flex-row gap-2 p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <input
                    type="text"
                    className="input text-sm"
                    value={line.description || ''}
                    onChange={(e) =>
                      updateLine(i, 'description', e.target.value)
                    }
                    disabled={!canEdit}
                    placeholder="Descrição"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="w-20">
                    <input
                      type="number"
                      step="0.001"
                      className="input text-sm"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(i, 'quantity', parseFloat(e.target.value) || 0)
                      }
                      disabled={!canEdit}
                      placeholder="Qtd"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      step="0.01"
                      className="input text-sm"
                      value={line.unit_price}
                      onChange={(e) =>
                        updateLine(
                          i,
                          'unit_price',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      disabled={!canEdit}
                      placeholder="Preço"
                    />
                  </div>
                  <div className="w-24 flex items-center text-sm font-medium text-gray-700">
                    {formatCurrency(line.total)}
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => removeLine(i)}
                      className="p-2 text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {canEdit && (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-secondary flex-1"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Guardar
            </button>
            <button
              onClick={handleSubmitForApproval}
              disabled={submitting || !canSubmit}
              className="btn-primary flex-1"
              title={
                !canSubmit
                  ? 'Preencha fornecedor, número e projeto'
                  : undefined
              }
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Submeter para aprovação
            </button>
          </>
        )}

        {canApprove && (
          <>
            <button onClick={handleApprove} className="btn-success flex-1">
              <CheckCircle size={16} />
              Aprovar
            </button>
            <button onClick={handleReject} className="btn-danger flex-1">
              <XCircle size={16} />
              Rejeitar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
