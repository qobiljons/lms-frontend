import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import PageTransition from "../../components/PageTransition";
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

export default function AdminLessonsPage() {
  const { user } = useAuth();
  const role = (user?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const [lessons, setLessons] = useState([]);
  const [courses, setCourses] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [nextPage, setNextPage] = useState(null);
  const [previousPage, setPreviousPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const searchTimer = useRef(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "create" ? "create" : "list";
  const setActiveTab = (tab) => setSearchParams(tab === "create" ? { tab: "create" } : {});

  // Create form
  const [form, setForm] = useState({
    title: "",
    content: "",
    course: "",
    video_provider: "",
    youtube_url: "",
    homework: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    video_provider: "",
    youtube_url: "",
    homework: "",
  });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch courses for dropdown
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data } = await api.get("/courses/?page_size=100");
        setCourses(data.results || data);
      } catch {
        /* silent */
      }
    };
    fetchCourses();
  }, []);

  const fetchLessons = useCallback(
    async (pageNum) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", pageNum);
        params.set("page_size", pageSize);
        if (search) params.set("search", search);
        if (courseFilter) params.set("course", courseFilter);
        const { data } = await api.get(`/lessons/?${params.toString()}`);
        const lessonList = data.results || data;
        setLessons(lessonList);
        setTotal(data.count || lessonList.length);
        setNextPage(data.next);
        setPreviousPage(data.previous);
        setPage(pageNum);
      } catch {
        toast.error("Failed to load lessons.");
      } finally {
        setLoading(false);
      }
    },
    [search, pageSize, courseFilter]
  );

  useEffect(() => {
    fetchLessons(1);
  }, [fetchLessons]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
    }, 400);
  };

  const getCourseName = (lesson) => {
    if (typeof lesson.course === "object" && lesson.course?.title) return lesson.course.title;
    const found = courses.find((c) => c.id === lesson.course);
    return found ? found.title : `Course #${lesson.course}`;
  };

  // Create handlers
  const handleFormChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!form.course) {
      toast.error("Please select a course.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/lessons/", {
        ...form,
        course: Number(form.course),
        user: user.id,
      });
      toast.success("Lesson created successfully!");
      setForm({ title: "", content: "", course: "", video_provider: "", youtube_url: "", homework: "" });
      setActiveTab("list");
      fetchLessons(1);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const firstError = Object.values(data).flat()[0];
        toast.error(firstError || "Failed to create lesson.");
      } else {
        toast.error("Failed to create lesson.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Edit handlers
  const startEdit = (lesson) => {
    setEditingId(lesson.id);
    setEditForm({
      title: lesson.title,
      content: lesson.content || "",
      video_provider: lesson.video_provider || "",
      youtube_url: lesson.youtube_url || "",
      homework: lesson.homework || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ title: "", content: "", video_provider: "", youtube_url: "", homework: "" });
  };

  const handleEditSubmit = async (e, lessonId) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/lessons/${lessonId}/`, editForm);
      toast.success("Lesson updated!");
      cancelEdit();
      fetchLessons(page);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const firstError = Object.values(data).flat()[0];
        toast.error(firstError || "Failed to update lesson.");
      } else {
        toast.error("Failed to update lesson.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Delete handler
  const handleDelete = async (lessonId) => {
    setDeleting(true);
    try {
      await api.delete(`/lessons/${lessonId}/`);
      toast.success("Lesson deleted.");
      setConfirmDeleteId(null);
      fetchLessons(page);
    } catch {
      toast.error("Failed to delete lesson.");
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
    title: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
    content: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>,
    course: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>,
    video: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
    link: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    homework: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>,
  };

  return (
    <PageTransition>
      <div className="admin-container">
        <div className="admin-header">
          <div>
            <h1>Lesson Management</h1>
            <p className="admin-subtitle">
              {total} lesson{total !== 1 ? "s" : ""} found
            </p>
          </div>
        </div>

        <div className="user-tabs">
          <button
            className={`user-tab ${activeTab === "list" ? "active" : ""}`}
            onClick={() => setActiveTab("list")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            Lessons
            {activeTab === "list" && <motion.div className="user-tab-indicator" layoutId="adminLessonTab" />}
          </button>
          <button
            className={`user-tab ${activeTab === "create" ? "active" : ""}`}
            onClick={() => setActiveTab("create")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Lesson
            {activeTab === "create" && <motion.div className="user-tab-indicator" layoutId="adminLessonTab" />}
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
                    placeholder="Search lessons…"
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
                    value={courseFilter}
                    onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}
                  >
                    <option value="">All Courses</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
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
                            <th>Lesson</th>
                            <th>Course</th>
                            <th>Video</th>
                            <th>Created</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          <AnimatePresence mode="wait">
                            {lessons.map((lesson, i) => (
                              editingId === lesson.id ? (
                                <motion.tr key={lesson.id} className="editing-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                  <td colSpan={5}>
                                    <form onSubmit={(e) => handleEditSubmit(e, lesson.id)} className="inline-edit-form">
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
                                        <div className="input-group" style={{ flex: 1 }}>
                                          <label>YouTube URL</label>
                                          <input
                                            type="url"
                                            value={editForm.youtube_url}
                                            onChange={(e) => setEditForm({ ...editForm, youtube_url: e.target.value })}
                                            placeholder="https://www.youtube.com/watch?v=..."
                                          />
                                        </div>
                                        <div className="input-group" style={{ flex: 0.5 }}>
                                          <label>Provider</label>
                                          <input
                                            type="text"
                                            value={editForm.video_provider}
                                            onChange={(e) => setEditForm({ ...editForm, video_provider: e.target.value })}
                                            placeholder="YouTube"
                                          />
                                        </div>
                                      </div>
                                      <div className="inline-edit-fields" style={{ marginTop: "0.5rem" }}>
                                        <div className="input-group" style={{ flex: 1 }}>
                                          <label>Content</label>
                                          <textarea
                                            value={editForm.content}
                                            onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                                            rows={3}
                                            style={{ width: "100%", resize: "vertical" }}
                                          />
                                        </div>
                                        <div className="input-group" style={{ flex: 1 }}>
                                          <label>Homework</label>
                                          <textarea
                                            value={editForm.homework}
                                            onChange={(e) => setEditForm({ ...editForm, homework: e.target.value })}
                                            rows={3}
                                            style={{ width: "100%", resize: "vertical" }}
                                          />
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
                                  key={lesson.id}
                                  custom={i}
                                  variants={rowVariants}
                                  initial="hidden"
                                  animate="visible"
                                  exit="exit"
                                >
                                  <td>
                                    <div className="user-cell">
                                      <div className="table-avatar" style={{ borderRadius: 8, background: "linear-gradient(135deg, #8b5cf6, #a78bfa)" }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                      </div>
                                      <div className="user-cell-info">
                                        <span className="user-cell-name">{lesson.title}</span>
                                        <span className="user-cell-username">#{lesson.id}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="role-chip role-instructor">{getCourseName(lesson)}</span>
                                  </td>
                                  <td>
                                    {lesson.youtube_url ? (
                                      <span className="status-chip status-active" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                                        Yes
                                      </span>
                                    ) : (
                                      <span className="status-chip status-inactive">No</span>
                                    )}
                                  </td>
                                  <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                                    {formatDate(lesson.created_at)}
                                  </td>
                                  <td>
                                    <div className="table-actions">
                                      <motion.button
                                        className="action-btn-ghost"
                                        onClick={() => startEdit(lesson)}
                                        whileTap={{ scale: 0.95 }}
                                        title="Edit"
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                      </motion.button>
                                      {isAdmin && (
                                        confirmDeleteId === lesson.id ? (
                                          <div className="table-actions" style={{ gap: "0.25rem" }}>
                                            <motion.button
                                              className="action-btn-danger"
                                              onClick={() => handleDelete(lesson.id)}
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
                                            onClick={() => setConfirmDeleteId(lesson.id)}
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
                        <motion.button className="page-btn" disabled={page === 1} onClick={() => fetchLessons(1)} whileTap={{ scale: 0.95 }} title="First page">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                        </motion.button>
                        <motion.button className="page-btn" disabled={!previousPage} onClick={() => fetchLessons(page - 1)} whileTap={{ scale: 0.95 }} title="Previous">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </motion.button>
                        <div className="page-numbers">
                          {generatePageNumbers(page, totalPages).map((p, i) =>
                            p === "..." ? (
                              <span className="page-ellipsis" key={`e${i}`}>…</span>
                            ) : (
                              <motion.button key={p} className={`page-num ${p === page ? "active" : ""}`} onClick={() => fetchLessons(p)} whileTap={{ scale: 0.9 }}>{p}</motion.button>
                            )
                          )}
                        </div>
                        <motion.button className="page-btn" disabled={!nextPage} onClick={() => fetchLessons(page + 1)} whileTap={{ scale: 0.95 }} title="Next">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </motion.button>
                        <motion.button className="page-btn" disabled={page === totalPages} onClick={() => fetchLessons(totalPages)} whileTap={{ scale: 0.95 }} title="Last page">
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
                  <h2>New Lesson</h2>
                  <p>Fill in the details below to create a new lesson.</p>
                </div>
                <form onSubmit={handleCreateSubmit}>
                  <div className="input-row">
                    <div className="input-group">
                      <label htmlFor="lesson-title">Title</label>
                      <div className="input-wrapper">
                        {createIcons.title}
                        <input id="lesson-title" name="title" type="text" required placeholder="e.g. Introduction to Variables" value={form.title} onChange={handleFormChange} />
                      </div>
                    </div>
                    <div className="input-group">
                      <label htmlFor="lesson-course">Course</label>
                      <div className="input-wrapper">
                        {createIcons.course}
                        <select id="lesson-course" name="course" value={form.course} onChange={handleFormChange} required>
                          <option value="">Select a course</option>
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="input-group">
                    <label htmlFor="lesson-content">Content</label>
                    <div className="input-wrapper input-wrapper-textarea">
                      {createIcons.content}
                      <textarea id="lesson-content" name="content" placeholder="Lesson content…" value={form.content} onChange={handleFormChange} rows={4} />
                    </div>
                  </div>

                  <div className="input-row">
                    <div className="input-group">
                      <label htmlFor="lesson-video-provider">Video Provider</label>
                      <div className="input-wrapper">
                        {createIcons.video}
                        <input id="lesson-video-provider" name="video_provider" type="text" placeholder="e.g. YouTube" value={form.video_provider} onChange={handleFormChange} />
                      </div>
                    </div>
                    <div className="input-group">
                      <label htmlFor="lesson-youtube-url">YouTube URL</label>
                      <div className="input-wrapper">
                        {createIcons.link}
                        <input id="lesson-youtube-url" name="youtube_url" type="url" placeholder="https://www.youtube.com/watch?v=..." value={form.youtube_url} onChange={handleFormChange} />
                      </div>
                    </div>
                  </div>

                  <div className="input-group">
                    <label htmlFor="lesson-homework">Homework</label>
                    <div className="input-wrapper input-wrapper-textarea">
                      {createIcons.homework}
                      <textarea id="lesson-homework" name="homework" placeholder="Homework instructions…" value={form.homework} onChange={handleFormChange} rows={3} />
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
                      "Create Lesson"
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
