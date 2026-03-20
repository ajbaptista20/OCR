import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppNav } from '@/components/app-nav';

export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav
        userEmail={user.email || ''}
        userRole={profile?.role || 'manager'}
      />
      <main className="flex-1 pb-20 md:pb-6 px-4 md:px-6 lg:px-8 pt-4 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
