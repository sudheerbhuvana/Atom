import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import Dashboard from '@/components/Dashboard';
import styles from './page.module.css';

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <main className={styles.main}>
      <Dashboard user={user} />
    </main>
  );
}
