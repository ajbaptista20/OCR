'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import type {
  Invoice,
  Project,
  DashboardFilters,
  CostType,
  InvoiceStatus,
} from '@/lib/types';
import { COST_TYPE_LABELS, STATUS_LABELS } from '@/lib/types';
import { Filter, Loader2, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

export function DashboardCharts({ projects }: { projects: Project[] }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('invoices')
      .select('*, project:projects(*)')
      .in('status', ['approved', 'pending_approval', 'pending_review']);

    if (filters.project_id) query = query.eq('project_id', filters.project_id);
    if (filters.supplier_name)
      query = query.ilike('supplier_name', `%${filters.supplier_name}%`);
    if (filters.date_from)
      query = query.gte('invoice_date', filters.date_from);
    if (filters.date_to) query = query.lte('invoice_date', filters.date_to);
    if (filters.cost_type) query = query.eq('cost_type', filters.cost_type);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) {
      toast.error('Erro ao carregar dados');
      console.error(error);
    }
    setInvoices(data || []);
    setLoading(false);
  }, [supabase, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const costByProject = projects
    .map((p) => {
      const total = invoices
        .filter((i) => i.project_id === p.id)
        .reduce((sum, i) => sum + (i.total_amount || 0), 0);
      return { name: p.code, total };
    })
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total);

  const supplierMap = new Map<string, number>();
  invoices.forEach((i) => {
    if (i.supplier_name) {
      supplierMap.set(
        i.supplier_name,
        (supplierMap.get(i.supplier_name) || 0) + (i.total_amount || 0)
      );
    }
  });
  const costBySupplier = Array.from(supplierMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const monthMap = new Map<string, number>();
  invoices.forEach((i) => {
    if (i.invoice_date) {
      const month = i.invoice_date.substring(0, 7);
      monthMap.set(month, (monthMap.get(month) || 0) + (i.total_amount || 0));
    }
  });
  const costByMonth = Array.from(monthMap.entries())
    .map(([month, total]) => ({ name: month, total }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalCost = invoices.reduce(
    (sum, i) => sum + (i.total_amount || 0),
    0
  );
  const totalVat = invoices.reduce((sum, i) => sum + (i.vat_amount || 0), 0);

  async function handleExport() {
    const params = new URLSearchParams();
    if (filters.project_id) params.set('project_id', filters.project_id);
    if (filters.supplier_name) params.set('supplier_name', filters.supplier_name);
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    if (filters.cost_type) params.set('cost_type', filters.cost_type);
    if (filters.status) params.set('status', filters.status);

    const res = await fetch(`/api/export?${params.toString()}`);
    if (!res.ok) {
      toast.error('Erro ao exportar');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faturas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Total Faturas</p>
          <p className="text-xl font-bold text-gray-900">{invoices.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Custo Total</p>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(totalCost)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">IVA Total</p>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(totalVat)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Fornecedores</p>
          <p className="text-xl font-bold text-gray-900">
            {supplierMap.size}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary text-sm"
          >
            <Filter size={16} />
            Filtros
          </button>
          <button onClick={handleExport} className="btn-secondary text-sm">
            <Download size={16} />
            Exportar CSV
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
            <div>
              <label className="label">Projeto</label>
              <select
                className="input"
                value={filters.project_id || ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    project_id: e.target.value || undefined,
                  }))
                }
              >
                <option value="">Todos</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fornecedor</label>
              <input
                type="text"
                className="input"
                value={filters.supplier_name || ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    supplier_name: e.target.value || undefined,
                  }))
                }
                placeholder="Pesquisar..."
              />
            </div>
            <div>
              <label className="label">Tipo de Custo</label>
              <select
                className="input"
                value={filters.cost_type || ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    cost_type: (e.target.value as CostType) || undefined,
                  }))
                }
              >
                <option value="">Todos</option>
                {Object.entries(COST_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Data início</label>
              <input
                type="date"
                className="input"
                value={filters.date_from || ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    date_from: e.target.value || undefined,
                  }))
                }
              />
            </div>
            <div>
              <label className="label">Data fim</label>
              <input
                type="date"
                className="input"
                value={filters.date_to || ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    date_to: e.target.value || undefined,
                  }))
                }
              />
            </div>
            <div>
              <label className="label">Estado</label>
              <select
                className="input"
                value={filters.status || ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    status: (e.target.value as InvoiceStatus) || undefined,
                  }))
                }
              >
                <option value="">Todos</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost by project */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Custo por Projeto
            </h3>
            {costByProject.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costByProject}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500 py-8 text-center">
                Sem dados
              </p>
            )}
          </div>

          {/* Cost by supplier */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Custo por Fornecedor (Top 10)
            </h3>
            {costBySupplier.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={costBySupplier}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name }) =>
                      name.length > 15 ? name.slice(0, 15) + '…' : name
                    }
                    labelLine
                    fontSize={11}
                  >
                    {costBySupplier.map((_, i) => (
                      <Cell
                        key={i}
                        fill={COLORS[i % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500 py-8 text-center">
                Sem dados
              </p>
            )}
          </div>

          {/* Cost by month */}
          <div className="card p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Custo por Mês
            </h3>
            {costByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="total" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500 py-8 text-center">
                Sem dados
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
