import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Spinner from "./Spinner";

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner text="Authenticating..." />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export function RoleRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner text="Authenticating..." />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!roles.includes(user.role)) {
    return (
      <div className="unauthorized">
        <h2>403 — Unauthorized</h2>
        <p>You don't have permission to access this page.</p>
      </div>
    );
  }
  return children;
}

export function GuestRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <Spinner text="Loading..." />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}
