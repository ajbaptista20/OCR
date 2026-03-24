import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UsersRoleManager } from '@/components/users-role-manager';

export default async function UsersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    redirect('/dashboard');
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Utilizadores</h1>
      <UsersRoleManager profiles={profiles || []} />
    </div>
  );
}
