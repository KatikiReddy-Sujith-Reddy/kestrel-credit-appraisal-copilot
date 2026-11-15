import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

interface RoleRouteProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8ff]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-medium text-on-surface-variant">Authenticating session...</span>
        </div>
      </div>
    );
  }

  // Not logged in -> Redirect to sign in
  if (!user) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  // Role check
  const hasAccess = allowedRoles.includes(user.activeRole) || (user.activeRole === 'cm' && allowedRoles.includes('credit_manager'));

  if (!hasAccess) {
    // Redirect to their own role-authorized workspace
    const fallbackMap: Record<string, string> = {
      rm: '/rm',
      analyst: '/analyst',
      credit_manager: '/credit',
      cm: '/credit',
      owner: '/owner',
      risk_delegate: '/owner',
    };
    const target = fallbackMap[user.activeRole] || '/select-role';
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
};

export default RoleRoute;
