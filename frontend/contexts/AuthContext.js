// frontend/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, auth } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Get dashboard path based on user role
  const getDashboardPath = (userRole) => {
    switch (userRole?.toLowerCase()) {
      case 'admin':
        return '/dashboard/admin';
      case 'reviewer':
        return '/dashboard/reviewer';
      case 'employee':
      default:
        return '/dashboard/employee';
    }
  };

 
  // Check authentication status on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser ? 'User logged in' : 'User logged out');
      try {
        if (firebaseUser) {
          console.log('Fetching user data for:', firebaseUser.uid);
          const userData = await fetchUserData(firebaseUser.uid);
          if (userData) {
            console.log('User data fetched:', userData);
            setIsLoggedIn(true);
            setUser(userData);
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('user', JSON.stringify(userData));
            
            // Only redirect when at /login or exactly /dashboard.
            // Do NOT force-redirect when already on other /dashboard/* pages
            if (router.pathname === '/login' || router.pathname === '/dashboard') {
              const dashboardPath = getDashboardPath(userData.role);
              if (router.pathname !== dashboardPath) {
                router.push(dashboardPath);
              }
            }

          } else {
            console.log('No user data found, signing out');
            await firebaseSignOut(auth);
            handleLogout();
          }
        } else {
          console.log('No user, handling logout');
          handleLogout();
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        handleLogout();
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      console.log('Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  const fetchUserData = async (uid) => {
    console.log('Fetching user data for UID:', uid);
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const userData = { 
          uid,
          email: userDoc.data().email,
          name: userDoc.data().name,
          role: userDoc.data().role,
          department: userDoc.data().department, // Ensure department is included
          ...userDoc.data() 
        };
        console.log('User data retrieved from Firestore:', {
          id: userDoc.id,
          ...userData,
          hasDepartment: !!userData.department
        });
        return userData;
      }
      console.log('No user document found for UID:', uid);
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
    }
  };

  const login = async (firebaseUser) => {
    try {
      await auth.currentUser?.reload();
      const userData = await fetchUserData(firebaseUser.uid);
      if (userData) {
        console.log('=== User Login ===');
        console.log('User ID:', userData.uid);
        console.log('Email:', userData.email);
        console.log('Department:', userData.department || 'Not set');
        console.log('Role:', userData.role || 'Not set');
        
        setIsLoggedIn(true);
        setUser(userData);
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('user', JSON.stringify(userData));
        return userData;
      }
      return null;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('user');
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      handleLogout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Role-based access control helpers
  const hasRole = (role) => {
    if (!user || !user.role) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'reviewer' && role === 'employee') return true;
    return user.role === role;
  };

  const isAdmin = () => hasRole('admin');
  const isReviewer = () => hasRole('reviewer') || isAdmin();
  const isEmployee = () => hasRole('employee') || isReviewer();

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        user,
        isLoading,
        login,
        logout,
        hasRole,
        isAdmin,
        isReviewer,
        isEmployee
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};