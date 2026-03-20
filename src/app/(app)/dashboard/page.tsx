import { createClient } from '@/lib/supabase/server';
import { DashboardCharts } from '@/components/dashboard-charts';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('code');

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <DashboardCharts projects={projects || []} />
    </div>
  );
}
