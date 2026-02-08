import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
import PageTransition from "../../components/PageTransition";
import "./Admin.css";

export default function CreateUserPage() {
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "student",
  });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/auth/users/create/", form);
      toast.success("User created successfully!");
      navigate("/admin/users");
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const firstError = Object.values(data).flat()[0];
        toast.error(firstError || "Failed to create user.");
      } else {
        toast.error("Failed to create user.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const icons = {
    user: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    mail: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
    at: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>,
    lock: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    shield: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  };

  return (
    <PageTransition>
      <div className="admin-container create-user-container">
        <div className="admin-header" style={{ justifyContent: "center", textAlign: "center" }}>
          <div>
            <h1>Create User</h1>
            <p className="admin-subtitle">Add a new user to the system</p>
          </div>
        </div>

        <motion.div
          className="create-form-card glass glow-border"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <form onSubmit={handleSubmit}>
            <div className="input-row">
              <motion.div
                className="input-group"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <label htmlFor="first_name">First Name</label>
                <div className="input-wrapper">
                  {icons.user}
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    required
                    placeholder="John"
                    value={form.first_name}
                    onChange={handleChange}
                  />
                </div>
              </motion.div>
              <motion.div
                className="input-group"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
              >
                <label htmlFor="last_name">Last Name</label>
                <div className="input-wrapper">
                  {icons.user}
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    required
                    placeholder="Doe"
                    value={form.last_name}
                    onChange={handleChange}
                  />
                </div>
              </motion.div>
            </div>

            <motion.div className="input-group" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <label htmlFor="email">Email</label>
              <div className="input-wrapper">
                {icons.mail}
                <input id="email" name="email" type="email" required placeholder="john@example.com" value={form.email} onChange={handleChange} />
              </div>
            </motion.div>

            <motion.div className="input-group" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
              <label htmlFor="username">Username</label>
              <div className="input-wrapper">
                {icons.at}
                <input id="username" name="username" type="text" required placeholder="johndoe" value={form.username} onChange={handleChange} />
              </div>
            </motion.div>

            <motion.div className="input-group" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                {icons.lock}
                <input id="password" name="password" type="password" required minLength={8} placeholder="Min 8 characters" value={form.password} onChange={handleChange} />
              </div>
            </motion.div>

            <motion.div className="input-group" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 }}>
              <label htmlFor="role">Role</label>
              <div className="input-wrapper">
                {icons.shield}
                <select id="role" name="role" value={form.role} onChange={handleChange}>
                  <option value="student">Student</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </motion.div>

            <motion.button
              type="submit"
              className="btn-submit"
              disabled={submitting}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {submitting ? (
                <span className="btn-loading">
                  <span className="btn-spinner" />
                  Creating...
                </span>
              ) : (
                "Create User"
              )}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </PageTransition>
  );
}
