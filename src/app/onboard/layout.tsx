import { redirect } from 'next/navigation';
import { needsOnboarding } from '@/lib/auth';

export default function OnboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // If onboarding is NOT needed (i.e., a user already exists), redirect to login
    if (!needsOnboarding()) {
        redirect('/login');
    }

    return <>{children}</>;
}
