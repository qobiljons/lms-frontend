import { useAuth } from "../context/AuthContext";
import Sidebar from "./Sidebar";
import "./AppLayout.css";

export default function AppLayout({ children }) {
  const { user } = useAuth();
  const hasSidebar = user && (user.role === "admin" || user.role === "instructor");

  return (
    <div className={`app-layout ${hasSidebar ? "with-sidebar" : ""}`}>
      {hasSidebar && <Sidebar />}
      <main className="app-content">{children}</main>
    </div>
  );
}
