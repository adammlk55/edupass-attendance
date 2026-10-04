import { notFound } from 'next/navigation';
import { SchoolPage } from '@/components/school-page';
import { labels } from '@/lib/types';
export default async function Page({ params }: { params: Promise<{ section?: string[] }> }) {
  const parts = (await params).section ?? [];
  const section = parts[0] ?? 'dashboard';
  if (
    !(section in labels) ||
    parts.length > 2 ||
    (parts[1] && !['classes', 'devices'].includes(section))
  )
    notFound();
  return <SchoolPage key={parts.join('/')} section={section} detailId={parts[1]} />;
}
