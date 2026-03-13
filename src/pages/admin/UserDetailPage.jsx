import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { getAvatarUrl, avatarErrorHandler } from "../../utils/avatar";
import PageTransition from "../../components/PageTransition";
import "./Admin.css";

const detailTabs = [
  {
    id: "info",
    label: "Account",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: "actions",
    label: "Actions",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
];

const contentVariants = {
  enter: { opacity: 0, y: 12 },
  center: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
};

export default function UserDetailPage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("info");
  const [editRole, setEditRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [savingRole, setSavingRole] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await api.get(`/auth/users/${username}/`);
        setUser(data);
        setSelectedRole(data.role);
      } catch {
        toast.error("Failed to load user.");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [username]);

  const handleRoleSave = async () => {
    setSavingRole(true);
    try {
      const { data } = await api.patch(`/auth/users/${username}/`, { role: selectedRole });
      setUser(data);
      setEditRole(false);
      toast.success("Role updated!");
    } catch {
      toast.error("Failed to update role.");
    } finally {
      setSavingRole(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const { data } = await api.patch(`/auth/users/${username}/`, { is_active: !user.is_active });
      setUser(data);
      toast.success(data.is_active ? "User activated!" : "User deactivated!");
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setTogglingActive(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSavingPw(true);
    try {
      await api.post(`/auth/users/${username}/set-password/`, { new_password: newPassword });
      toast.success("Password reset successfully!");
      setNewPassword("");
      setShowResetPw(false);
    } catch {
      toast.error("Failed to reset password.");
    } finally {
      setSavingPw(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/auth/users/${username}/`);
      toast.success("User deleted.");
      navigate("/admin/users");
    } catch {
      toast.error("Failed to delete user.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="admin-container detail-page-container">
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
        <div className="admin-container detail-page-container">
          <div className="detail-empty">
            <h2>User not found</h2>
            <Link to="/admin/users" className="back-link">← Back to Users</Link>
          </div>
        </div>
      </PageTransition>
    );
  }

  const avatarSrc = getAvatarUrl(user.profile);

  const fields = [
    { label: "Username", value: user.username },
    { label: "Email", value: user.email },
    { label: "First Name", value: user.first_name || "—" },
    { label: "Last Name", value: user.last_name || "—" },
    { label: "Phone", value: user.profile?.phone || "—" },
    { label: "Bio", value: user.profile?.bio || "—" },
  ];

  return (
    <PageTransition>
      <div className="admin-container detail-page-container">
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
          className="detail-hero"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="detail-hero-avatar">
            <img src={avatarSrc} alt={user.username} onError={avatarErrorHandler(user.profile)} />
          </div>
          <div className="detail-hero-info">
            <h1>{user.first_name} {user.last_name}</h1>
            <p className="detail-hero-email">{user.email}</p>
            <div className="detail-hero-badges">
              <span className={`role-chip role-${user.role}`}>{user.role}</span>
              <span className={`status-chip ${user.is_active ? "status-active" : "status-inactive"}`}>
                {user.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="detail-tabs"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {detailTabs.map((tab) => (
            <button
              key={tab.id}
              className={`detail-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  className="detail-tab-indicator"
                  layoutId="detailTabIndicator"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </motion.div>

        <div className="detail-tab-content">
          <AnimatePresence mode="wait">
            {activeTab === "info" && (
              <motion.div
                key="info"
                className="detail-card"
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <div className="section-head">
                  <h3>Account Information</h3>
                  <p>User details and profile data</p>
                </div>
                <div className="detail-grid">
                  {fields.map((field, i) => (
                    <motion.div
                      className="detail-field"
                      key={field.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + i * 0.04 }}
                    >
                      <span className="detail-label">{field.label}</span>
                      <span className="detail-value">{field.value}</span>
                    </motion.div>
                  ))}
                  <motion.div
                    className="detail-field"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + fields.length * 0.04 }}
                  >
                    <span className="detail-label">Role</span>
                    <span className={`role-chip role-${user.role}`}>{user.role}</span>
                  </motion.div>
                  <motion.div
                    className="detail-field"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + (fields.length + 1) * 0.04 }}
                  >
                    <span className="detail-label">Status</span>
                    <span className={`status-chip ${user.is_active ? "status-active" : "status-inactive"}`}>
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </motion.div>
                  {user.groups && user.groups.length > 0 && (
                    <motion.div
                      className="detail-field"
                      style={{ gridColumn: "1 / -1" }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + (fields.length + 2) * 0.04 }}
                    >
                      <span className="detail-label">Groups</span>
                      <div className="group-chips">
                        {user.groups.map((g) => (
                          <span key={g.id} className="group-chip">{g.name}</span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "actions" && (
              <motion.div
                key="actions"
                className="detail-card"
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <div className="section-head">
                  <h3>Admin Actions</h3>
                  <p>Manage this user&apos;s role, access, and credentials</p>
                </div>
                <div className="detail-actions">
                  <div className="action-row">
                    <div className="action-info">
                      <span className="action-title">Change Role</span>
                      <span className="action-desc">Assign a different role to this user</span>
                    </div>
                    {editRole ? (
                      <div className="action-inline">
                        <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="action-select">
                          <option value="student">Student</option>
                          <option value="instructor">Instructor</option>
                          <option value="admin">Admin</option>
                        </select>
                        <motion.button className="action-btn action-btn-primary" onClick={handleRoleSave} disabled={savingRole} whileTap={{ scale: 0.95 }}>
                          {savingRole ? "Saving..." : "Save"}
                        </motion.button>
                        <motion.button className="action-btn action-btn-ghost" onClick={() => { setEditRole(false); setSelectedRole(user.role); }} whileTap={{ scale: 0.95 }}>
                          Cancel
                        </motion.button>
                      </div>
                    ) : (
                      <motion.button className="action-btn action-btn-outline" onClick={() => setEditRole(true)} whileTap={{ scale: 0.95 }}>
                        Edit
                      </motion.button>
                    )}
                  </div>

                  <div className="action-row">
                    <div className="action-info">
                      <span className="action-title">{user.is_active ? "Deactivate User" : "Activate User"}</span>
                      <span className="action-desc">{user.is_active ? "User will not be able to log in" : "Restore user access to the platform"}</span>
                    </div>
                    <motion.button
                      className={`action-btn ${user.is_active ? "action-btn-warning" : "action-btn-primary"}`}
                      onClick={handleToggleActive}
                      disabled={togglingActive}
                      whileTap={{ scale: 0.95 }}
                    >
                      {togglingActive ? "..." : user.is_active ? "Deactivate" : "Activate"}
                    </motion.button>
                  </div>

                  <div className="action-row">
                    <div className="action-info">
                      <span className="action-title">Reset Password</span>
                      <span className="action-desc">Set a new password for this user</span>
                    </div>
                    {showResetPw ? (
                      <form className="action-inline" onSubmit={handleResetPassword}>
                        <input
                          type="password"
                          className="action-input"
                          placeholder="New password (min 8)"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          minLength={8}
                          required
                        />
                        <motion.button type="submit" className="action-btn action-btn-primary" disabled={savingPw} whileTap={{ scale: 0.95 }}>
                          {savingPw ? "Saving..." : "Reset"}
                        </motion.button>
                        <motion.button type="button" className="action-btn action-btn-ghost" onClick={() => { setShowResetPw(false); setNewPassword(""); }} whileTap={{ scale: 0.95 }}>
                          Cancel
                        </motion.button>
                      </form>
                    ) : (
                      <motion.button className="action-btn action-btn-outline" onClick={() => setShowResetPw(true)} whileTap={{ scale: 0.95 }}>
                        Reset
                      </motion.button>
                    )}
                  </div>

                  <div className="action-row action-row-danger">
                    <div className="action-info">
                      <span className="action-title action-title-danger">Delete User</span>
                      <span className="action-desc">Permanently remove this user and all their data</span>
                    </div>
                    <AnimatePresence mode="wait">
                      {confirmDelete ? (
                        <motion.div className="action-inline" key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <span className="action-confirm-text">Are you sure?</span>
                          <motion.button className="action-btn action-btn-danger" onClick={handleDelete} disabled={deleting} whileTap={{ scale: 0.95 }}>
                            {deleting ? "Deleting..." : "Yes, Delete"}
                          </motion.button>
                          <motion.button className="action-btn action-btn-ghost" onClick={() => setConfirmDelete(false)} whileTap={{ scale: 0.95 }}>
                            No
                          </motion.button>
                        </motion.div>
                      ) : (
                        <motion.button key="delete" className="action-btn action-btn-danger" onClick={() => setConfirmDelete(true)} whileTap={{ scale: 0.95 }}>
                          Delete
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
