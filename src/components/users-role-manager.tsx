'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile, UserRole } from '@/lib/types';
import { USER_ROLES, USER_ROLE_LABELS } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Loader2, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

export function UsersRoleManager({ profiles }: { profiles: Profile[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);

  async function changeRole(userId: string, role: UserRole) {
    setSavingId(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId);
      if (error) throw error;
      toast.success('Role atualizada com sucesso');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar role');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="card p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Roles de Utilizador</h2>
        <p className="text-sm text-gray-500">
          Altere rapidamente as roles para testes da app.
        </p>
      </div>

      <div className="space-y-2">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile.email}</p>
              <p className="text-xs text-gray-500">{profile.id}</p>
            </div>
            <div className="flex items-center gap-2">
              {savingId === profile.id && (
                <Loader2 size={14} className="animate-spin text-gray-500" />
              )}
              <select
                className="input min-w-[160px]"
                value={profile.role}
                onChange={(e) => changeRole(profile.id, e.target.value as UserRole)}
                disabled={savingId === profile.id}
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {USER_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {profiles.length === 0 && (
        <div className="text-center py-8 text-sm text-gray-500">
          <Shield size={24} className="mx-auto mb-2 text-gray-400" />
          Sem utilizadores disponíveis.
        </div>
      )}
    </div>
  );
}
