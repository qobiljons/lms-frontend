import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { getAvatarUrl, avatarErrorHandler } from "../../utils/avatar";
import PageTransition from "../../components/PageTransition";
import "./Admin.css";

function generatePageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } },
};

const SORT_KEY_MAP = {
  name: "username",
  email: "email",
};

export default function UserListPage() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState(5);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "create" ? "create" : "list";
  const setActiveTab = (tab) => setSearchParams(tab === "create" ? { tab: "create" } : {});

  const [form, setForm] = useState({
    email: "", username: "", password: "", first_name: "", last_name: "", role: "student",
  });
  const [submitting, setSubmitting] = useState(false);

  const searchTimer = useRef(null);
  const navigate = useNavigate();

  const buildQuery = useCallback(
    (pageNum) => {
      const params = new URLSearchParams();
      params.set("page", pageNum);
      params.set("page_size", pageSize);
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      if (statusFilter) params.set("is_active", statusFilter);
      if (sortKey && SORT_KEY_MAP[sortKey]) {
        const field = SORT_KEY_MAP[sortKey];
        params.set("ordering", sortDir === "desc" ? `-${field}` : field);
      }
      return `/auth/users/?${params.toString()}`;
    },
    [search, roleFilter, statusFilter, sortKey, sortDir, pageSize]
  );

  const fetchUsers = useCallback(
    async (pageNum) => {
      setLoading(true);
      try {
        const { data } = await api.get(buildQuery(pageNum));
        setUsers(data.results);
        setTotal(data.count);
        setNext(data.next);
        setPrevious(data.previous);
        setPage(pageNum);
      } catch {
        toast.error("Failed to load users.");
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
    }, 400);
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleFormChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/auth/users/create/", form);
      toast.success("User created successfully!");
      setForm({ email: "", username: "", password: "", first_name: "", last_name: "", role: "student" });
      setActiveTab("list");
      fetchUsers(1);
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

  const createIcons = {
    user: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    mail: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
    at: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>,
    lock: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    shield: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  };

  const SortIcon = ({ column }) => (
    <span className={`sort-icon ${sortKey === column ? "sort-active" : ""}`}>
      {sortKey === column && sortDir === "desc" ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>
      )}
    </span>
  );

  const totalPages = Math.ceil(total / pageSize);

  return (
    <PageTransition>
      <div className="admin-container">
        <div className="admin-header">
          <div>
            <h1>User Management</h1>
            <p className="admin-subtitle">
              {total} user{total !== 1 ? "s" : ""} found
            </p>
          </div>
        </div>

        <div className="user-tabs">
          <button
            className={`user-tab ${activeTab === "list" ? "active" : ""}`}
            onClick={() => setActiveTab("list")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Users
            {activeTab === "list" && <motion.div className="user-tab-indicator" layoutId="userTab" />}
          </button>
          <button
            className={`user-tab ${activeTab === "create" ? "active" : ""}`}
            onClick={() => setActiveTab("create")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            Create User
            {activeTab === "create" && <motion.div className="user-tab-indicator" layoutId="userTab" />}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "list" ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <div className="user-toolbar">
                <div className="toolbar-search">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input
                    type="text"
                    placeholder="Search by name, email or username…"
                    value={search}
                    onChange={handleSearchChange}
                  />
                  {search && (
                    <button className="toolbar-search-clear" onClick={() => setSearch("")} title="Clear search">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
                <div className="toolbar-filters">
                  <select
                    className="toolbar-select"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="">All Roles</option>
                    <option value="student">Student</option>
                    <option value="instructor">Instructor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <select
                    className="toolbar-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                  <select
                    className="toolbar-select"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    <option value={5}>5 / page</option>
                    <option value={10}>10 / page</option>
                    <option value={20}>20 / page</option>
                    <option value={50}>50 / page</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="admin-loading">
                  <motion.div
                    className="table-skeleton glass"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {[...Array(5)].map((_, i) => (
                      <div className="skeleton-row" key={i} />
                    ))}
                  </motion.div>
                </div>
              ) : (
                <>
                  <motion.div
                    className="table-card glass glow-border"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="table-wrapper">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th className="sortable-th" onClick={() => handleSort("name")}>User <SortIcon column="name" /></th>
                            <th className="sortable-th col-email" onClick={() => handleSort("email")}>Email <SortIcon column="email" /></th>
                            <th>Role</th>
                            <th>Status</th>
                            <th className="col-id">ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          <AnimatePresence mode="wait">
                            {users.map((u, i) => (
                              <motion.tr
                                key={u.id}
                                custom={i}
                                variants={rowVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                onClick={() => navigate(`/admin/users/${u.username}`)}
                                whileHover={{ backgroundColor: "rgba(22, 163, 74, 0.04)" }}
                              >
                                <td>
                                  <div className="user-cell">
                                    <div className={`table-avatar role-bg-${u.role}`}>
                                      <img src={getAvatarUrl(u.profile)} alt={u.username} onError={avatarErrorHandler(u.profile)} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                                    </div>
                                    <div className="user-cell-info">
                                      <span className="user-cell-name">{u.first_name} {u.last_name}</span>
                                      <span className="user-cell-username">@{u.username}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="email-cell col-email">{u.email}</td>
                                <td><span className={`role-chip role-${u.role}`}>{u.role}</span></td>
                                <td><span className={`status-chip ${u.is_active ? "status-active" : "status-inactive"}`}>{u.is_active ? "Active" : "Inactive"}</span></td>
                                <td className="id-cell col-id">#{u.id}</td>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        </tbody>
                      </table>
                    </div>
                  </motion.div>

                  {totalPages > 1 && (
                    <motion.div
                      className="pagination"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      <div className="pagination-info">
                        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                      </div>
                      <div className="pagination-controls">
                        <motion.button className="page-btn" disabled={page === 1} onClick={() => fetchUsers(1)} whileTap={{ scale: 0.95 }} title="First page">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                        </motion.button>
                        <motion.button className="page-btn" disabled={!previous} onClick={() => fetchUsers(page - 1)} whileTap={{ scale: 0.95 }} title="Previous page">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </motion.button>
                        <div className="page-numbers">
                          {generatePageNumbers(page, totalPages).map((p, i) =>
                            p === "..." ? (
                              <span className="page-ellipsis" key={`e${i}`}>…</span>
                            ) : (
                              <motion.button key={p} className={`page-num ${p === page ? "active" : ""}`} onClick={() => fetchUsers(p)} whileTap={{ scale: 0.9 }}>{p}</motion.button>
                            )
                          )}
                        </div>
                        <motion.button className="page-btn" disabled={!next} onClick={() => fetchUsers(page + 1)} whileTap={{ scale: 0.95 }} title="Next page">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </motion.button>
                        <motion.button className="page-btn" disabled={page === totalPages} onClick={() => fetchUsers(totalPages)} whileTap={{ scale: 0.95 }} title="Last page">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="create-user-section"
            >
              <motion.div
                className="create-form-card glass glow-border"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="create-form-header">
                  <h2>New User</h2>
                  <p>Fill in the details below to create a new account.</p>
                </div>
                <form onSubmit={handleCreateSubmit}>
                  <div className="input-row">
                    <div className="input-group">
                      <label htmlFor="first_name">First Name</label>
                      <div className="input-wrapper">
                        {createIcons.user}
                        <input id="first_name" name="first_name" type="text" required placeholder="John" value={form.first_name} onChange={handleFormChange} />
                      </div>
                    </div>
                    <div className="input-group">
                      <label htmlFor="last_name">Last Name</label>
                      <div className="input-wrapper">
                        {createIcons.user}
                        <input id="last_name" name="last_name" type="text" required placeholder="Doe" value={form.last_name} onChange={handleFormChange} />
                      </div>
                    </div>
                  </div>

                  <div className="input-row">
                    <div className="input-group">
                      <label htmlFor="email">Email</label>
                      <div className="input-wrapper">
                        {createIcons.mail}
                        <input id="email" name="email" type="email" required placeholder="john@example.com" value={form.email} onChange={handleFormChange} />
                      </div>
                    </div>
                    <div className="input-group">
                      <label htmlFor="username">Username</label>
                      <div className="input-wrapper">
                        {createIcons.at}
                        <input id="username" name="username" type="text" required placeholder="johndoe" value={form.username} onChange={handleFormChange} />
                      </div>
                    </div>
                  </div>

                  <div className="input-row">
                    <div className="input-group">
                      <label htmlFor="password">Password</label>
                      <div className="input-wrapper">
                        {createIcons.lock}
                        <input id="password" name="password" type="password" required minLength={8} placeholder="Min 8 characters" value={form.password} onChange={handleFormChange} />
                      </div>
                    </div>
                    <div className="input-group">
                      <label htmlFor="role">Role</label>
                      <div className="input-wrapper">
                        {createIcons.shield}
                        <select id="role" name="role" value={form.role} onChange={handleFormChange}>
                          <option value="student">Student</option>
                          <option value="instructor">Instructor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <motion.button
                    type="submit"
                    className="btn-submit"
                    disabled={submitting}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
