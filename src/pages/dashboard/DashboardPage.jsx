import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import PageTransition from "../../components/PageTransition";
import "./Dashboard.css";

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState(false);

  const fetchStats = () => {
    setLoadingStats(true);
    setStatsError(false);
    api.get("/auth/dashboard/stats/")
      .then(({ data }) => setStats(data))
      .catch(() => setStatsError(true))
      .finally(() => setLoadingStats(false));
  };

  useEffect(() => {
    if (user.role === "admin") fetchStats();
  }, []);

  const roleConfig = {
    admin: {
      gradient: "linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.03))",
      border: "rgba(239, 68, 68, 0.15)",
      icon: "🛡️",
      description: "Full access to manage users, courses, and lessons.",
    },
    instructor: {
      gradient: "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.03))",
      border: "rgba(245, 158, 11, 0.15)",
      icon: "📚",
      description: "You can view and manage courses and lessons.",
    },
    student: {
      gradient: "linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.03))",
      border: "rgba(34, 197, 94, 0.15)",
      icon: "🎓",
      description: "Browse and view available courses and lessons.",
    },
  };

  const config = roleConfig[user.role] || roleConfig.student;

  const basicStats = [
    { label: "Role", value: user.role, accent: true },
    { label: "Account", value: "Active" },
    { label: "Member", value: "Since today" },
  ];

  return (
    <PageTransition>
      <div className="dashboard">
        <motion.div variants={stagger} initial="initial" animate="animate">
          <motion.div className="dash-welcome" variants={fadeUp}>
            <div className="welcome-text">
              <h1>
                Welcome back,{" "}
                <span className="highlight">
                  {user.first_name || user.username}
                </span>
              </h1>
              <p>{user.role === "admin" ? "Here\u2019s your platform overview" : "Here\u2019s your account overview"}</p>
            </div>
          </motion.div>

          {user.role === "admin" && stats && (
            <>
              <motion.div
                className="admin-stats-grid"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                {[
                  { label: "Total Users", value: stats.users.total, icon: "👥", color: "#16a34a", bg: "rgba(22,163,74,0.08)" },
                  { label: "Active Users", value: stats.users.active, icon: "✅", color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
                  { label: "Groups", value: stats.groups?.total ?? 0, icon: "👨‍👩‍👧‍👦", color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
                  { label: "Courses", value: stats.courses.total, icon: "📘", color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
                  { label: "Lessons", value: stats.lessons.total, icon: "📝", color: "#8b5cf6", bg: "rgba(139,92,246,0.08)" },
                ].map((s, i) => (
                  <motion.div
                    className="admin-stat"
                    key={s.label}
                    whileHover={{ y: -6, boxShadow: `0 8px 24px ${s.color}20`, transition: { duration: 0.2 } }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 300, damping: 25 }}
                    style={{ borderTop: `3px solid ${s.color}` }}
                  >
                    <div className="admin-stat-icon" style={{ background: s.bg }}>
                      <span>{s.icon}</span>
                    </div>
                    <div className="admin-stat-info">
                      <span className="admin-stat-value" style={{ color: s.color }}>
                        {s.value.toLocaleString()}
                      </span>
                      <span className="admin-stat-label">{s.label}</span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              <motion.div
                className="breakdown-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <h3 className="breakdown-title">User Breakdown</h3>
                <div className="breakdown-roles">
                  {[
                    { label: "Students", value: stats.users.students, color: "#22c55e", total: stats.users.total },
                    { label: "Instructors", value: stats.users.instructors, color: "#f59e0b", total: stats.users.total },
                    { label: "Admins", value: stats.users.admins, color: "#ef4444", total: stats.users.total },
                  ].map((item, i) => {
                    const pct = ((item.value / item.total) * 100).toFixed(1);
                    return (
                      <motion.div
                        className="breakdown-role"
                        key={item.label}
                        initial={{ opacity: 0, x: -15 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.35 + i * 0.1 }}
                      >
                        <div className="breakdown-role-dot" style={{ background: item.color }} />
                        <span className="breakdown-role-label">{item.label}</span>
                        <div className="breakdown-role-bar">
                          <motion.div
                            className="breakdown-role-fill"
                            style={{ backgroundColor: item.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(parseFloat(pct), 1.5)}%` }}
                            transition={{ delay: 0.5 + i * 0.12, duration: 0.7, ease: "easeOut" }}
                          />
                        </div>
                        <span className="breakdown-role-count" style={{ color: item.color }}>{item.value.toLocaleString()}</span>
                        <span className="breakdown-role-pct">{pct}%</span>
                      </motion.div>
                    );
                  })}
                </div>
                {stats.users.inactive > 0 && (
                  <motion.div
                    className="breakdown-inactive"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                  >
                    <span className="breakdown-inactive-dot" />
                    <span>{stats.users.inactive.toLocaleString()} inactive user{stats.users.inactive !== 1 ? "s" : ""}</span>
                  </motion.div>
                )}
              </motion.div>
            </>
          )}

          {user.role === "admin" && loadingStats && (
            <motion.div className="admin-stats-grid" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              {[...Array(5)].map((_, i) => (
                <div className="stat-card stat-skeleton" key={i}>
                  <div className="skeleton-row" style={{ width: "60%", height: 12 }} />
                  <div className="skeleton-row" style={{ width: "40%", height: 24, marginTop: 8 }} />
                </div>
              ))}
            </motion.div>
          )}

          {user.role === "admin" && statsError && !loadingStats && (
            <motion.div className="dash-card stats-error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <p>Failed to load dashboard stats.</p>
              <motion.button
                className="retry-btn"
                whileTap={{ scale: 0.95 }}
                onClick={fetchStats}
              >
                Retry
              </motion.button>
            </motion.div>
          )}

          {user.role !== "admin" && (
            <motion.div className="dash-stats" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
              {basicStats.map((stat, i) => (
                <motion.div
                  className="stat-card"
                  key={stat.label}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <span className="stat-label">{stat.label}</span>
                  <span className={`stat-value ${stat.accent ? "accent" : ""}`}>
                    {stat.value}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          )}

          {user.role !== "admin" && (
            <>
              <motion.div className="dash-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                <div className="card-header">
                  <h3>Profile Information</h3>
                </div>
                <div className="profile-grid">
                  <ProfileField label="Username" value={user.username} />
                  <ProfileField label="Email" value={user.email} />
                  <ProfileField label="First Name" value={user.first_name} />
                  <ProfileField label="Last Name" value={user.last_name} />
                </div>
              </motion.div>

              <motion.div
                className="dash-card role-card"
                style={{
                  background: config.gradient,
                  border: `1px solid ${config.border}`,
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                whileHover={{ scale: 1.005, transition: { duration: 0.2 } }}
              >
                <div className="role-card-content">
                  <span className="role-icon">{config.icon}</span>
                  <div>
                    <h3>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)} Access
                    </h3>
                    <p>{config.description}</p>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>
    </PageTransition>
  );
}

function ProfileField({ label, value }) {
  return (
    <div className="profile-field">
      <span className="field-label">{label}</span>
      <span className="field-value">{value || "—"}</span>
    </div>
  );
}
