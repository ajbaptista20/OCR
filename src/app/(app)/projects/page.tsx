import { createClient } from '@/lib/supabase/server';
import { ProjectsView } from '@/components/projects-view';

export default async function ProjectsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single();

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Projetos</h1>
      <ProjectsView
        projects={projects || []}
        isAdmin={['admin', 'manager'].includes(profile?.role || '')}
      />
    </div>
  );
}
