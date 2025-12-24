import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import AdminDashboard from '../../components/dashboard/AdminDashboard';
import Unauthorized from '../../components/common/Unauthorized';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const AdminDashboardPage = () => {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    router.push('/login');
    return <LoadingSpinner />;
  }

  if (!isAdmin()) {
    return <Unauthorized />;
  }

  return <AdminDashboard />;
};

export default AdminDashboardPage;

