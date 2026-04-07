import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
import PageTransition from "../../components/PageTransition";
import { useAuth } from "../../context/AuthContext";
import "./Admin.css";

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } },
};

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

export default function AdminCoursesPage() {
  const { user } = useAuth();
  const role = (user?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const [courses, setCourses] = useState([]);
  const [lessonCounts, setLessonCounts] = useState({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [nextPage, setNextPage] = useState(null);
  const [previousPage, setPreviousPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const searchTimer = useRef(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "create" ? "create" : "list";
  const setActiveTab = (tab) => setSearchParams(tab === "create" ? { tab: "create" } : {});

  // Create form
  const [form, setForm] = useState({ title: "", description: "", price: "0" });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", price: "0" });
  const [editLogoFile, setEditLogoFile] = useState(null);
  const [editLogoPreview, setEditLogoPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCourses = useCallback(
    async (pageNum) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", pageNum);
        params.set("page_size", pageSize);
        if (search) params.set("search", search);
        const { data } = await api.get(`/courses/?${params.toString()}`);
        const courseList = data.results || data;
        setCourses(courseList);
        setTotal(data.count || courseList.length);
        setNextPage(data.next);
        setPreviousPage(data.previous);
        setPage(pageNum);

        // Fetch lesson counts
        const counts = {};
        await Promise.all(
          courseList.map(async (course) => {
            try {
              const res = await api.get(`/lessons/?course=${course.id}&page_size=1`);
              counts[course.id] = res.data.count ?? (res.data.results || res.data || []).length;
            } catch {
              counts[course.id] = 0;
            }
          })
        );
        setLessonCounts(counts);
      } catch {
        toast.error("Failed to load courses.");
      } finally {
        setLoading(false);
      }
    },
    [search, pageSize]
  );

  useEffect(() => {
    fetchCourses(1);
  }, [fetchCourses]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
    }, 400);
  };

  // Create handlers
  const handleFormChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("price", parseFloat(form.price) || 0);
      if (logoFile) formData.append("logo", logoFile);
      await api.post("/courses/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Course created successfully!");
      setForm({ title: "", description: "", price: "0" });
      setLogoFile(null);
      setLogoPreview(null);
      setActiveTab("list");
      fetchCourses(1);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const firstError = Object.values(data).flat()[0];
        toast.error(firstError || "Failed to create course.");
      } else {
        toast.error("Failed to create course.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Edit handlers
  const startEdit = (course) => {
    setEditingId(course.id);
    setEditForm({ title: course.title, description: course.description || "", price: course.price ?? "0" });
    setEditLogoFile(null);
    setEditLogoPreview(course.logo || null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ title: "", description: "", price: "0" });
    setEditLogoFile(null);
    setEditLogoPreview(null);
  };

  const handleEditLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditLogoFile(file);
      setEditLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleEditSubmit = async (e, slug) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", editForm.title);
      formData.append("description", editForm.description);
      formData.append("price", parseFloat(editForm.price) || 0);
      if (editLogoFile) formData.append("logo", editLogoFile);
      await api.patch(`/courses/${slug}/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Course updated!");
      cancelEdit();
      fetchCourses(page);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const firstError = Object.values(data).flat()[0];
        toast.error(firstError || "Failed to update course.");
      } else {
        toast.error("Failed to update course.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Delete handler
  const handleDelete = async (slug) => {
    setDeleting(true);
    try {
      await api.delete(`/courses/${slug}/`);
      toast.success("Course deleted.");
      setConfirmDeleteId(null);
      fetchCourses(page);
    } catch {
      toast.error("Failed to delete course.");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  const totalPages = Math.ceil(total / pageSize);

  const createIcons = {
    book: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>,
    desc: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>,
    image: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>,
  };

  return (
    <PageTransition>
      <div className="admin-container">
        <div className="admin-header">
          <div>
            <h1>Course Management</h1>
            <p className="admin-subtitle">
              {total} course{total !== 1 ? "s" : ""} found
            </p>
          </div>
        </div>

        <div className="user-tabs">
          <button
            className={`user-tab ${activeTab === "list" ? "active" : ""}`}
            onClick={() => setActiveTab("list")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            Courses
            {activeTab === "list" && <motion.div className="user-tab-indicator" layoutId="adminCourseTab" />}
          </button>
          <button
            className={`user-tab ${activeTab === "create" ? "active" : ""}`}
            onClick={() => setActiveTab("create")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Course
            {activeTab === "create" && <motion.div className="user-tab-indicator" layoutId="adminCourseTab" />}
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
                    placeholder="Search courses…"
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
                  <select className="toolbar-select" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                    <option value={5}>5 / page</option>
                    <option value={10}>10 / page</option>
                    <option value={20}>20 / page</option>
                    <option value={50}>50 / page</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="admin-loading">
                  <motion.div className="table-skeleton glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {[...Array(5)].map((_, i) => <div className="skeleton-row" key={i} />)}
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
                            <th>Course</th>
                            <th className="col-email">Description</th>
                            <th>Price</th>
                            <th>Lessons</th>
                            <th>Created</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          <AnimatePresence mode="wait">
                            {courses.map((course, i) => (
                              editingId === course.id ? (
                                <motion.tr key={course.id} className="editing-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                  <td colSpan={6}>
                                    <form onSubmit={(e) => handleEditSubmit(e, course.slug)} className="inline-edit-form">
                                      <div className="inline-edit-fields">
                                        <div className="input-group" style={{ flex: 1 }}>
                                          <label>Title</label>
                                          <input
                                            type="text"
                                            required
                                            value={editForm.title}
                                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                          />
                                        </div>
                                        <div className="input-group" style={{ flex: 2 }}>
                                          <label>Description</label>
                                          <input
                                            type="text"
                                            value={editForm.description}
                                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                          />
                                        </div>
                                        <div className="input-group" style={{ flex: "0 0 110px" }}>
                                          <label>Price ($)</label>
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={editForm.price}
                                            onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                                          />
                                        </div>
                                        <div className="input-group">
                                          <label>Logo</label>
                                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            {editLogoPreview && (
                                              <img src={editLogoPreview} alt="Logo" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
                                            )}
                                            <input type="file" accept="image/*" onChange={handleEditLogoChange} style={{ fontSize: "0.8rem" }} />
                                          </div>
                                        </div>
                                      </div>
                                      <div className="inline-edit-actions">
                                        <motion.button type="submit" className="action-btn-primary" disabled={saving} whileTap={{ scale: 0.95 }}>
                                          {saving ? "Saving…" : "Save"}
                                        </motion.button>
                                        <motion.button type="button" className="action-btn-outline" onClick={cancelEdit} whileTap={{ scale: 0.95 }}>
                                          Cancel
                                        </motion.button>
                                      </div>
                                    </form>
                                  </td>
                                </motion.tr>
                              ) : (
                                <motion.tr
                                  key={course.id}
                                  custom={i}
                                  variants={rowVariants}
                                  initial="hidden"
                                  animate="visible"
                                  exit="exit"
                                >
                                  <td>
                                    <div className="user-cell">
                                      <div className="table-avatar" style={{ borderRadius: 8, background: "linear-gradient(135deg, #059669, #34d399)" }}>
                                        {course.logo ? (
                                          <img src={course.logo} alt={course.title} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                                        ) : (
                                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                                        )}
                                      </div>
                                      <div className="user-cell-info">
                                        <span className="user-cell-name">{course.title}</span>
                                        <span className="user-cell-username">{course.slug}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="email-cell col-email">
                                    <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                      {course.description || "—"}
                                    </span>
                                  </td>
                                  <td>
                                    {parseFloat(course.price) > 0 ? (
                                      <span style={{ fontWeight: 700, color: "#16a34a", fontSize: "0.9rem" }}>
                                        ${parseFloat(course.price).toFixed(2)}
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Free</span>
                                    )}
                                  </td>
                                  <td>
                                    <span className="role-chip role-student">{lessonCounts[course.id] ?? 0} lessons</span>
                                  </td>
                                  <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                                    {formatDate(course.created_at)}
                                  </td>
                                  <td>
                                    <div className="table-actions">
                                      <motion.button
                                        className="action-btn-ghost"
                                        onClick={() => startEdit(course)}
                                        whileTap={{ scale: 0.95 }}
                                        title="Edit"
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                      </motion.button>
                                      {isAdmin && (
                                        confirmDeleteId === course.id ? (
                                          <div className="table-actions" style={{ gap: "0.25rem" }}>
                                            <motion.button
                                              className="action-btn-danger"
                                              onClick={() => handleDelete(course.slug)}
                                              disabled={deleting}
                                              whileTap={{ scale: 0.95 }}
                                            >
                                              {deleting ? "…" : "Yes"}
                                            </motion.button>
                                            <motion.button
                                              className="action-btn-outline"
                                              onClick={() => setConfirmDeleteId(null)}
                                              whileTap={{ scale: 0.95 }}
                                            >
                                              No
                                            </motion.button>
                                          </div>
                                        ) : (
                                          <motion.button
                                            className="action-btn-ghost action-btn-ghost-danger"
                                            onClick={() => setConfirmDeleteId(course.id)}
                                            whileTap={{ scale: 0.95 }}
                                            title="Delete"
                                          >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                          </motion.button>
                                        )
                                      )}
                                    </div>
                                  </td>
                                </motion.tr>
                              )
                            ))}
                          </AnimatePresence>
                        </tbody>
                      </table>
                    </div>
                  </motion.div>

                  {totalPages > 1 && (
                    <motion.div className="pagination" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                      <div className="pagination-info">
                        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                      </div>
                      <div className="pagination-controls">
                        <motion.button className="page-btn" disabled={page === 1} onClick={() => fetchCourses(1)} whileTap={{ scale: 0.95 }} title="First page">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                        </motion.button>
                        <motion.button className="page-btn" disabled={!previousPage} onClick={() => fetchCourses(page - 1)} whileTap={{ scale: 0.95 }} title="Previous">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </motion.button>
                        <div className="page-numbers">
                          {generatePageNumbers(page, totalPages).map((p, i) =>
                            p === "..." ? (
                              <span className="page-ellipsis" key={`e${i}`}>…</span>
                            ) : (
                              <motion.button key={p} className={`page-num ${p === page ? "active" : ""}`} onClick={() => fetchCourses(p)} whileTap={{ scale: 0.9 }}>{p}</motion.button>
                            )
                          )}
                        </div>
                        <motion.button className="page-btn" disabled={!nextPage} onClick={() => fetchCourses(page + 1)} whileTap={{ scale: 0.95 }} title="Next">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </motion.button>
                        <motion.button className="page-btn" disabled={page === totalPages} onClick={() => fetchCourses(totalPages)} whileTap={{ scale: 0.95 }} title="Last page">
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
                  <h2>New Course</h2>
                  <p>Fill in the details below to create a new course.</p>
                </div>
                <form onSubmit={handleCreateSubmit}>
                  <div className="input-group">
                    <label htmlFor="title">Title</label>
                    <div className="input-wrapper">
                      {createIcons.book}
                      <input id="title" name="title" type="text" required placeholder="e.g. Django 101" value={form.title} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label htmlFor="description">Description</label>
                    <div className="input-wrapper">
                      {createIcons.desc}
                      <input id="description" name="description" type="text" placeholder="Brief course description" value={form.description} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label htmlFor="price">Price (USD) — leave 0 for free</label>
                    <div className="input-wrapper">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      <input id="price" name="price" type="number" min="0" step="0.01" placeholder="0.00" value={form.price} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label htmlFor="logo">Logo</label>
                    <div className="logo-upload-area-admin">
                      {logoPreview ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <img src={logoPreview} alt="Preview" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", border: "1px solid rgba(0,0,0,0.08)" }} />
                          <button type="button" className="action-btn-outline" onClick={() => { setLogoFile(null); setLogoPreview(null); }}>Remove</button>
                        </div>
                      ) : (
                        <label htmlFor="logo" className="logo-upload-label-admin">
                          {createIcons.image}
                          <span>Choose an image</span>
                        </label>
                      )}
                      <input id="logo" type="file" accept="image/*" onChange={handleLogoChange} style={{ display: "none" }} />
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
                      <span className="btn-loading"><span className="btn-spinner" />Creating...</span>
                    ) : (
                      "Create Course"
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
