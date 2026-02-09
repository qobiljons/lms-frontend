import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { getAvatarUrl, avatarErrorHandler } from "../../utils/avatar";
import { toast } from "react-toastify";
import PageTransition from "../../components/PageTransition";
import "./Profile.css";

const tabs = [
  {
    id: "account",
    label: "Account",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Profile",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      </svg>
    ),
  },
  {
    id: "security",
    label: "Security",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
];

const contentVariants = {
  enter: { opacity: 0, y: 12 },
  center: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("account");

  const [userForm, setUserForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
  });

  const [profileForm, setProfileForm] = useState({
    phone: "",
    bio: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [savingUser, setSavingUser] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setUserForm({
        username: user.username || "",
        email: user.email || "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
      });
    }
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data } = await api.get("/auth/me/profile/");
      setProfileForm({
        phone: data.phone || "",
        bio: data.bio || "",
      });
      if (data.avatar) setAvatarPreview(getAvatarUrl(data));
    } catch {
    }
  };

  const handleUserChange = (e) =>
    setUserForm({ ...userForm, [e.target.name]: e.target.value });

  const handleProfileChange = (e) =>
    setProfileForm({ ...profileForm, [e.target.name]: e.target.value });

  const handlePasswordChange = (e) =>
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const extractError = (err) => {
    const data = err.response?.data;
    if (data && typeof data === "object") {
      const first = Object.values(data).flat()[0];
      return typeof first === "string" ? first : "Something went wrong.";
    }
    return "Something went wrong.";
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      const { data } = await api.patch("/auth/me/", userForm);
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      localStorage.setItem("user", JSON.stringify(data));
      localStorage.setItem("tokens", JSON.stringify(tokens));
      window.location.reload();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setSavingUser(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const formData = new FormData();
      formData.append("phone", profileForm.phone);
      formData.append("bio", profileForm.bio);
      if (avatar) formData.append("avatar", avatar);
      await api.patch("/auth/me/profile/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Profile updated!");
      setAvatar(null);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("New passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await api.post("/auth/me/change-password/", {
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      });
      toast.success("Password changed successfully!");
      setPasswordForm({ old_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setSavingPassword(false);
    }
  };

  const icons = {
    user: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    mail: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
    phone: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    lock: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    edit: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>,
  };

  const roleColors = { student: "#16a34a", instructor: "#f59e0b", admin: "#ef4444" };

  return (
    <PageTransition>
      <div className="profile-page">
        <motion.div
          className="profile-hero"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="profile-hero-avatar">
            <img src={avatarPreview || getAvatarUrl(user?.profile)} alt={user?.username} onError={avatarErrorHandler(user?.profile)} />
          </div>
          <div className="profile-hero-info">
            <h1>{user?.first_name} {user?.last_name}</h1>
            <p className="profile-hero-email">{user?.email}</p>
            <span
              className="profile-hero-role"
              style={{ background: `${roleColors[user?.role] || "#16a34a"}18`, color: roleColors[user?.role] || "#16a34a", border: `1px solid ${roleColors[user?.role] || "#16a34a"}33` }}
            >
              {user?.role}
            </span>
          </div>
        </motion.div>

        <motion.div
          className="profile-tabs"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`profile-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  className="tab-indicator"
                  layoutId="profileTabIndicator"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </motion.div>

        <div className="profile-tab-content">
          <AnimatePresence mode="wait">
            {activeTab === "account" && (
              <motion.div
                key="account"
                className="profile-section"
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <div className="section-head">
                  <h3>Account Information</h3>
                  <p>Update your name, username, and email address</p>
                </div>
                <form onSubmit={handleUserSubmit}>
                  <div className="input-row">
                    <div className="input-group">
                      <label htmlFor="first_name">First Name</label>
                      <div className="input-wrapper">
                        {icons.user}
                        <input id="first_name" name="first_name" type="text" value={userForm.first_name} onChange={handleUserChange} placeholder="First name" />
                      </div>
                    </div>
                    <div className="input-group">
                      <label htmlFor="last_name">Last Name</label>
                      <div className="input-wrapper">
                        {icons.user}
                        <input id="last_name" name="last_name" type="text" value={userForm.last_name} onChange={handleUserChange} placeholder="Last name" />
                      </div>
                    </div>
                  </div>
                  <div className="input-group">
                    <label htmlFor="username">Username</label>
                    <div className="input-wrapper">
                      {icons.edit}
                      <input id="username" name="username" type="text" value={userForm.username} onChange={handleUserChange} placeholder="Username" />
                    </div>
                  </div>
                  <div className="input-group">
                    <label htmlFor="email">Email</label>
                    <div className="input-wrapper">
                      {icons.mail}
                      <input id="email" name="email" type="email" value={userForm.email} onChange={handleUserChange} placeholder="Email" />
                    </div>
                  </div>
                  <motion.button type="submit" className="btn-save" disabled={savingUser} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                    {savingUser ? <span className="btn-loading"><span className="btn-spinner" />Saving...</span> : "Save Changes"}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {activeTab === "profile" && (
              <motion.div
                key="profile"
                className="profile-section"
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <div className="section-head">
                  <h3>Profile Details</h3>
                  <p>Manage your photo, phone number, and bio</p>
                </div>
                <form onSubmit={handleProfileSubmit}>
                  <div className="avatar-section">
                    <div className="avatar-upload">
                      <div className="avatar-preview">
                        <img src={avatarPreview || getAvatarUrl(user?.profile)} alt={user?.username} onError={avatarErrorHandler(user?.profile)} />
                      </div>
                      <div className="avatar-upload-info">
                        <label htmlFor="avatar-input" className="avatar-btn">
                          Change Photo
                          <input id="avatar-input" type="file" accept="image/*" onChange={handleAvatarChange} hidden />
                        </label>
                        <span className="avatar-hint">JPG, PNG or GIF. Max 2MB.</span>
                      </div>
                    </div>
                  </div>
                  <div className="input-group">
                    <label htmlFor="phone">Phone</label>
                    <div className="input-wrapper">
                      {icons.phone}
                      <input id="phone" name="phone" type="tel" value={profileForm.phone} onChange={handleProfileChange} placeholder="Phone number" />
                    </div>
                  </div>
                  <div className="input-group">
                    <label htmlFor="bio">Bio</label>
                    <div className="textarea-wrapper">
                      <textarea id="bio" name="bio" rows="3" value={profileForm.bio} onChange={handleProfileChange} placeholder="Tell us about yourself..." />
                    </div>
                  </div>
                  <motion.button type="submit" className="btn-save" disabled={savingProfile} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                    {savingProfile ? <span className="btn-loading"><span className="btn-spinner" />Saving...</span> : "Update Profile"}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {activeTab === "security" && (
              <motion.div
                key="security"
                className="profile-section"
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <div className="section-head">
                  <h3>Change Password</h3>
                  <p>Ensure your account stays secure</p>
                </div>
                <form onSubmit={handlePasswordSubmit}>
                  <div className="input-group">
                    <label htmlFor="old_password">Current Password</label>
                    <div className="input-wrapper">
                      {icons.lock}
                      <input id="old_password" name="old_password" type="password" required value={passwordForm.old_password} onChange={handlePasswordChange} placeholder="Current password" />
                    </div>
                  </div>
                  <div className="input-row">
                    <div className="input-group">
                      <label htmlFor="new_password">New Password</label>
                      <div className="input-wrapper">
                        {icons.lock}
                        <input id="new_password" name="new_password" type="password" required minLength={8} value={passwordForm.new_password} onChange={handlePasswordChange} placeholder="New password" />
                      </div>
                    </div>
                    <div className="input-group">
                      <label htmlFor="confirm_password">Confirm Password</label>
                      <div className="input-wrapper">
                        {icons.lock}
                        <input id="confirm_password" name="confirm_password" type="password" required minLength={8} value={passwordForm.confirm_password} onChange={handlePasswordChange} placeholder="Confirm password" />
                      </div>
                    </div>
                  </div>
                  <motion.button type="submit" className="btn-save btn-save-warning" disabled={savingPassword} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                    {savingPassword ? <span className="btn-loading"><span className="btn-spinner" />Changing...</span> : "Change Password"}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
