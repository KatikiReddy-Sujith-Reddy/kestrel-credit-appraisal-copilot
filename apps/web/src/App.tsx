import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './state/AuthContext';
import RoleRoute from './components/RoleRoute';
import SignIn from './routes/shared/SignIn';
import SelectRole from './routes/shared/SelectRole';
import RmDashboard from './routes/rm/RmDashboard';
import RmApplicationDetail from './routes/rm/RmApplicationDetail';
import AnalystQueue from './routes/analyst/AnalystQueue';
import AnalystWorkspace from './routes/analyst/AnalystWorkspace';
import CreditManagerQueue from './routes/credit/CreditManagerQueue';
import CreditManagerReview from './routes/credit/CreditManagerReview';
import OwnerDashboard from './routes/owner/OwnerDashboard';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/sign-in" replace />;
  if (user.activeRole === 'rm') return <Navigate to="/rm" replace />;
  if (user.activeRole === 'analyst') return <Navigate to="/analyst" replace />;
  if (user.activeRole === 'credit_manager' || user.activeRole === 'cm') return <Navigate to="/credit" replace />;
  if (user.activeRole === 'owner' || user.activeRole === 'risk_delegate') return <Navigate to="/owner" replace />;
  return <Navigate to="/select-role" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col font-sans">
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/select-role" element={<SelectRole />} />

            {/* Journey 1: Relationship Manager (Strict RBAC Guard) */}
            <Route
              path="/rm"
              element={
                <RoleRoute allowedRoles={['rm']}>
                  <RmDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/rm/applications/:id"
              element={
                <RoleRoute allowedRoles={['rm']}>
                  <RmApplicationDetail />
                </RoleRoute>
              }
            />

            {/* Journey 2: Credit Analyst (Strict RBAC Guard) */}
            <Route
              path="/analyst"
              element={
                <RoleRoute allowedRoles={['analyst']}>
                  <AnalystQueue />
                </RoleRoute>
              }
            />
            <Route
              path="/analyst/applications/:id"
              element={
                <RoleRoute allowedRoles={['analyst']}>
                  <AnalystWorkspace />
                </RoleRoute>
              }
            />

            {/* Journey 3: Credit Manager (Strict RBAC Guard) */}
            <Route
              path="/credit"
              element={
                <RoleRoute allowedRoles={['credit_manager', 'cm']}>
                  <CreditManagerQueue />
                </RoleRoute>
              }
            />
            <Route
              path="/credit/applications/:id"
              element={
                <RoleRoute allowedRoles={['credit_manager', 'cm']}>
                  <CreditManagerReview />
                </RoleRoute>
              }
            />

            {/* Journey 4: System Owner & Governance (Strict RBAC Guard) */}
            <Route
              path="/owner"
              element={
                <RoleRoute allowedRoles={['owner', 'risk_delegate']}>
                  <OwnerDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/owner/*"
              element={
                <RoleRoute allowedRoles={['owner', 'risk_delegate']}>
                  <OwnerDashboard />
                </RoleRoute>
              }
            />

            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}
