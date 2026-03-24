'use client';

import { useState, useRef } from 'react';
import { Camera, FileUp, X, Loader2, Eye } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { createClient } from '@/lib/supabase/client';
import { fileToBase64 } from '@/lib/utils';
import { INVOICES_BUCKET } from '@/lib/storage';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleFileSelect(selectedFile: File) {
    let processedFile = selectedFile;

    if (selectedFile.type.startsWith('image/')) {
      try {
        processedFile = await imageCompression(selectedFile, {
          maxSizeMB: 2,
          maxWidthOrHeight: 2048,
          useWebWorker: true,
        });
      } catch {
        toast.error('Erro ao comprimir imagem');
      }
    }

    if (processedFile.size > MAX_FILE_SIZE) {
      toast.error('Ficheiro demasiado grande (máx. 6MB)');
      return;
    }

    setFile(processedFile);

    if (processedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(processedFile);
    } else if (processedFile.type === 'application/pdf') {
      setPreview('pdf');
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) handleFileSelect(selected);
  }

  function clearFile() {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const { error: storageError } = await supabase.storage
        .from(INVOICES_BUCKET)
        .upload(filePath, file);

      if (storageError) {
        if (storageError.message?.toLowerCase().includes('bucket not found')) {
          throw new Error(
            `Bucket "${INVOICES_BUCKET}" não encontrado no Supabase Storage. Crie o bucket ou ajuste NEXT_PUBLIC_INVOICES_BUCKET.`
          );
        }
        throw storageError;
      }

      const { data: invoice, error: dbError } = await supabase
        .from('invoices')
        .insert({
          file_path: filePath,
          file_name: file.name,
          uploaded_by: user.id,
          status: 'uploaded',
        })
        .select()
        .single();

      if (dbError) throw dbError;

      const base64 = await fileToBase64(file);
      try {
        await fetch('/api/docupipe/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceId: invoice.id,
            base64File: base64,
            fileName: file.name,
          }),
        });
      } catch {
        // OCR is non-blocking — invoice still saved
        console.warn('DocuPipe upload failed, invoice saved without OCR');
      }

      toast.success('Fatura carregada com sucesso!');
      router.push('/invoices');
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar fatura';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleInputChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
      />

      {!file ? (
        <div className="space-y-3">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="btn-primary w-full py-4 text-base"
          >
            <Camera size={22} />
            Tirar Fotografia
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary w-full py-4 text-base"
          >
            <FileUp size={22} />
            Selecionar Ficheiro
          </button>

          <p className="text-xs text-gray-500 text-center">
            PDF ou imagem • Máximo 6MB
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Preview */}
          <div className="card overflow-hidden">
            {preview === 'pdf' ? (
              <div className="flex items-center justify-center py-12 bg-gray-50">
                <div className="text-center">
                  <FileUp size={48} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-700">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            ) : preview ? (
              <div className="relative">
                <img
                  src={preview}
                  alt="Pré-visualização"
                  className="w-full max-h-96 object-contain bg-gray-50"
                />
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  <Eye size={12} className="inline mr-1" />
                  Pré-visualização
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex gap-3">
            <button
              onClick={clearFile}
              disabled={uploading}
              className="btn-secondary flex-1"
            >
              <X size={16} />
              Cancelar
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="btn-primary flex-1"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <FileUp size={16} />
              )}
              {uploading ? 'A enviar...' : 'Confirmar envio'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
