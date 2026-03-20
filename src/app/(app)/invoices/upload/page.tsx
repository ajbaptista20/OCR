import { UploadForm } from '@/components/upload-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function UploadPage() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft size={16} />
          Voltar
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Nova Fatura</h1>
        <p className="text-sm text-gray-500 mt-1">
          Carregue um PDF ou tire uma fotografia da fatura
        </p>
      </div>
      <UploadForm />
    </div>
  );
}
