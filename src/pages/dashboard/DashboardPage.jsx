import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
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

  const stats = [
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
              <p>Here&apos;s your account overview</p>
            </div>
            <div className="welcome-avatar">
              <motion.div
                className="avatar-large"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              >
                {(user.first_name?.[0] || user.username[0]).toUpperCase()}
              </motion.div>
            </div>
          </motion.div>

          <motion.div className="dash-stats" variants={fadeUp}>
            {stats.map((stat, i) => (
              <motion.div
                className="stat-card glass glow-border"
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

          <motion.div className="dash-card glass glow-border" variants={fadeUp}>
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
            variants={fadeUp}
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
