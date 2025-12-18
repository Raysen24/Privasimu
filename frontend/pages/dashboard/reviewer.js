import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../../contexts/AuthContext';
import ReviewerDashboard from '../../../components/dashboard/ReviewerDashboard';
import Unauthorized from '../../../components/common/Unauthorized';
import LoadingSpinner from '../../../components/common/LoadingSpinner';

const ReviewerDashboardPage = () => {
  const { user, isReviewer, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    router.push('/login');
    return <LoadingSpinner />;
  }

  if (!isReviewer()) {
    return <Unauthorized />;
  }

  return <ReviewerDashboard />;
};

export default ReviewerDashboardPage;
