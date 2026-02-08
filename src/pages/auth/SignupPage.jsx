import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import Logo from "../../components/Logo";
import "./Auth.css";

export default function SignupPage() {
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    first_name: "",
    last_name: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signup(form);
      toast.success("Account created successfully!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const firstError = Object.values(data).flat()[0];
        toast.error(firstError || "Signup failed.");
      } else {
        toast.error("Signup failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fields = [
    { row: true, items: [
      { id: "first_name", label: "First Name", type: "text", placeholder: "John", icon: "user" },
      { id: "last_name", label: "Last Name", type: "text", placeholder: "Doe", icon: "user" },
    ]},
    { id: "email", label: "Email", type: "email", placeholder: "john@example.com", icon: "mail" },
    { id: "username", label: "Username", type: "text", placeholder: "johndoe", icon: "at", autoComplete: "username" },
    { id: "password", label: "Password", type: "password", placeholder: "Min 8 characters", icon: "lock", autoComplete: "new-password", minLength: 8 },
  ];

  const icons = {
    user: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    mail: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
    at: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>,
    lock: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  };

  const renderInput = (field, index) => (
    <motion.div
      className="input-group"
      key={field.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 + index * 0.08 }}
    >
      <label htmlFor={field.id}>{field.label}</label>
      <div className="input-wrapper">
        {icons[field.icon]}
        <input
          id={field.id}
          name={field.id}
          type={field.type}
          required
          placeholder={field.placeholder}
          value={form[field.id]}
          onChange={handleChange}
          autoComplete={field.autoComplete}
          minLength={field.minLength}
        />
      </div>
    </motion.div>
  );

  return (
    <div className="auth-page">
      <div className="auth-bg-orb auth-bg-orb-1" />
      <div className="auth-bg-orb auth-bg-orb-2" />

      <motion.div
        className="auth-card glow-border"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <motion.div
          className="auth-header"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="auth-logo">
            <Logo size={42} showText={false} />
          </div>
          <h2>Create account</h2>
          <p>Join the UpGreen learning platform</p>
        </motion.div>

        <form onSubmit={handleSubmit}>
          {fields.map((field, i) =>
            field.row ? (
              <div className="input-row" key="name-row">
                {field.items.map((f, j) => renderInput(f, i + j))}
              </div>
            ) : (
              renderInput(field, i + 1)
            )
          )}

          <motion.button
            type="submit"
            className="btn-submit"
            disabled={submitting}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            {submitting ? (
              <span className="btn-loading">
                <span className="btn-spinner" />
                Creating account...
              </span>
            ) : (
              "Create Account"
            )}
          </motion.button>
        </form>

        <motion.p
          className="auth-footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          Already have an account? <Link to="/login">Sign in</Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
