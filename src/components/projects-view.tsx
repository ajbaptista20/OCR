'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Project } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { Plus, FolderKanban, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export function ProjectsView({
  projects,
  isAdmin,
}: {
  projects: Project[];
  isAdmin: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('projects')
        .insert({ name: name.trim(), code: code.trim().toUpperCase() });
      if (error) throw error;
      toast.success('Projeto criado!');
      setName('');
      setCode('');
      setShowForm(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar projeto');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja eliminar este projeto?')) return;
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      toast.success('Projeto eliminado');
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao eliminar projeto'
      );
    }
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary text-sm"
            >
              <Plus size={16} />
              Novo Projeto
            </button>
          ) : (
            <form onSubmit={handleCreate} className="card p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Código</label>
                  <input
                    type="text"
                    className="input"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Ex: OBR-001"
                    required
                  />
                </div>
                <div>
                  <label className="label">Nome</label>
                  <input
                    type="text"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do projeto"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-sm"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Criar Projeto
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="card p-8 text-center">
          <FolderKanban size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Nenhum projeto criado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className="card p-4 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-brand-50 text-brand-700 px-2 py-0.5 rounded">
                    {project.code}
                  </span>
                  <span className="font-medium text-gray-900">
                    {project.name}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Criado {formatDateTime(project.created_at)}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleDelete(project.id)}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
