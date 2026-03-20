'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Invoice, InvoiceStatus } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';
import { StatusBadge } from '@/components/status-badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileText, Search } from 'lucide-react';

export function InvoiceList({ invoices }: { invoices: Invoice[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      !search ||
      inv.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      inv.file_name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = !statusFilter || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            className="input pl-9"
            placeholder="Pesquisar fornecedor, nº fatura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-full sm:w-48"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | '')}
        >
          <option value="">Todos os estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <FileText size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Nenhuma fatura encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="card p-4 block hover:border-brand-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">
                    {inv.supplier_name || inv.file_name || 'Sem fornecedor'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {inv.invoice_number && (
                      <span className="text-xs text-gray-500">
                        Nº {inv.invoice_number}
                      </span>
                    )}
                    {inv.invoice_date && (
                      <span className="text-xs text-gray-500">
                        {formatDate(inv.invoice_date)}
                      </span>
                    )}
                    {inv.project && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {inv.project.code}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(inv.total_amount)}
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
