import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, apiGetMe, apiSignOut, apiSelectRole } from '../api/auth';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  setUser: (u: UserProfile | null) => void;
  switchRole: (role: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  setUser: () => {},
  switchRole: async () => {},
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('kestrel_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetMe()
      .then((data) => {
        setUser(data.user);
        localStorage.setItem('kestrel_user', JSON.stringify(data.user));
      })
      .catch(() => {
        // Not authenticated
        setUser(null);
        localStorage.removeItem('kestrel_user');
        localStorage.removeItem('kestrel_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSwitchRole = async (newRole: string) => {
    const res = await apiSelectRole(newRole);
    setUser(res.user);
  };

  const handleSignOut = async () => {
    await apiSignOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, setUser, switchRole: handleSwitchRole, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
