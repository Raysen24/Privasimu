import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const DashboardIndex = () => {
  const { user, isAdmin, isReviewer, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (isAdmin()) {
        router.push('/dashboard/admin');
      } else if (isReviewer()) {
        router.push('/dashboard/reviewer');
      } else {
        router.push('/dashboard/employee');
      }
    }
  }, [user, isAdmin, isReviewer, isLoading, router]);

  return <LoadingSpinner />;
};

export default DashboardIndex;
