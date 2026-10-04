import { redirect } from 'next/navigation';
import { getSchoolData } from '@/lib/data';
import { ApiError } from '@/lib/http';
import { SchoolProvider } from '@/components/school-provider';
import { Shell } from '@/components/shell';
export const dynamic = 'force-dynamic';
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let data;
  try {
    data = await getSchoolData();
  } catch (e) {
    if (e instanceof ApiError && [401, 403, 503].includes(e.status))
      redirect(`/login${e.status === 403 ? '?access=denied' : ''}`);
    throw e;
  }
  return (
    <SchoolProvider initial={data}>
      <Shell>{children}</Shell>
    </SchoolProvider>
  );
}
