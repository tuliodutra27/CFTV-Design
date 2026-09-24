import { redirect } from 'next/navigation';
import { getSession } from '@/lib/getSession';
import Home from '@/components/Home';

export default async function Page() {
  // O middleware já bloqueia isso antes de chegar aqui — isso é só uma segunda camada de defesa.
  const session = await getSession();
  if (!session) redirect('/login');

  return <Home role={session.role} userName={session.name} />;
}
