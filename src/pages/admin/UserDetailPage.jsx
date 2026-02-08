import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
import PageTransition from "../../components/PageTransition";
import "./Admin.css";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export default function UserDetailPage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await api.get(`/auth/users/${id}/`);
        setUser(data);
      } catch {
        toast.error("Failed to load user.");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id]);

  if (loading) {
    return (
      <PageTransition>
        <div className="admin-container">
          <div className="detail-skeleton glass">
            {[...Array(4)].map((_, i) => (
              <div className="skeleton-row" key={i} />
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!user) {
    return (
      <PageTransition>
        <div className="admin-container">
          <div className="detail-empty">
            <h2>User not found</h2>
            <Link to="/admin/users" className="back-link">← Back to Users</Link>
          </div>
        </div>
      </PageTransition>
    );
  }

  const fields = [
    { label: "User ID", value: `#${user.id}` },
    { label: "Username", value: user.username },
    { label: "Email", value: user.email },
    { label: "First Name", value: user.first_name || "—" },
    { label: "Last Name", value: user.last_name || "—" },
  ];

  return (
    <PageTransition>
      <div className="admin-container">
        <motion.div
          className="detail-breadcrumb"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Link to="/admin/users" className="back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            All Users
          </Link>
        </motion.div>

        <motion.div
          className="detail-header"
          variants={fadeUp}
          initial="initial"
          animate="animate"
        >
          <div className={`detail-avatar role-bg-${user.role}`}>
            {(user.first_name?.[0] || user.username[0]).toUpperCase()}
          </div>
          <div className="detail-header-info">
            <h1>{user.first_name} {user.last_name}</h1>
            <div className="detail-header-meta">
              <span className="detail-username">@{user.username}</span>
              <span className={`role-chip role-${user.role}`}>{user.role}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="detail-card glass glow-border"
          variants={fadeUp}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.1 }}
        >
          <h3>Account Information</h3>
          <div className="detail-grid">
            {fields.map((field, i) => (
              <motion.div
                className="detail-field"
                key={field.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
              >
                <span className="detail-label">{field.label}</span>
                <span className="detail-value">{field.value}</span>
              </motion.div>
            ))}
            <motion.div
              className="detail-field"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + fields.length * 0.05 }}
            >
              <span className="detail-label">Role</span>
              <span className={`role-chip role-${user.role}`}>{user.role}</span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
}
