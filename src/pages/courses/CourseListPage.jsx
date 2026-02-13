import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import PageTransition from "../../components/PageTransition";
import "./Courses.css";
import "../admin/Admin.css";

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

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

const bookIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </svg>
);

export default function CourseListPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const searchTimer = useRef(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = isAdmin && searchParams.get("tab") === "create" ? "create" : "list";
  const setActiveTab = (tab) => setSearchParams(tab === "create" ? { tab: "create" } : {});

  const [form, setForm] = useState({ title: "", description: "" });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const buildQuery = useCallback(
    (pageNum) => {
      const params = new URLSearchParams();
      params.set("page", pageNum);
      params.set("page_size", pageSize);
      if (search) params.set("search", search);
      return `/courses/?${params.toString()}`;
    },
    [search, pageSize]
  );

  const fetchCourses = useCallback(
    async (pageNum) => {
      setLoading(true);
      try {
        const { data } = await api.get(buildQuery(pageNum));
        setCourses(data.results);
        setTotal(data.count);
        setNext(data.next);
        setPrevious(data.previous);
        setPage(pageNum);
      } catch {
        toast.error("Failed to load courses.");
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
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
      if (logoFile) formData.append("logo", logoFile);
      await api.post("/courses/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Course created successfully!");
      setForm({ title: "", description: "" });
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

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <PageTransition>
      <div className="courses-container">
        <div className="courses-header">
          <div>
            <h1>Courses</h1>
            <p className="courses-subtitle">
              {total} course{total !== 1 ? "s" : ""} available
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="user-tabs">
            <button
              className={`user-tab ${activeTab === "list" ? "active" : ""}`}
              onClick={() => setActiveTab("list")}
            >
              {bookIcon}
              All Courses
              {activeTab === "list" && <motion.div className="user-tab-indicator" layoutId="courseTab" />}
            </button>
            <button
              className={`user-tab ${activeTab === "create" ? "active" : ""}`}
              onClick={() => setActiveTab("create")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Create Course
              {activeTab === "create" && <motion.div className="user-tab-indicator" layoutId="courseTab" />}
            </button>
          </div>
        )}

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
              ) : courses.length === 0 ? (
                <div className="course-empty">
                  <h2>No courses found</h2>
                  <p>{search ? "Try a different search term." : "No courses have been created yet."}</p>
                </div>
              ) : (
                <>
                  <div className="course-card-grid">
                    <AnimatePresence mode="wait">
                      {courses.map((c, i) => (
                        <motion.div
                          key={c.id}
                          className="course-card"
                          custom={i}
                          variants={cardVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          onClick={() => navigate(`/courses/${c.slug}`)}
                          whileHover={{ scale: 1.005 }}
                        >
                          <div className="course-card-media">
                            {c.logo ? (
                              <img src={c.logo} alt={c.title} className="course-card-image" />
                            ) : (
                              <div className="course-card-icon">{bookIcon}</div>
                            )}
                          </div>
                          <div className="course-card-body">
                            <p className="course-card-title">{c.title}</p>
                            <p className="course-card-desc">{c.description || "No description"}</p>
                          </div>
                          <div className="course-card-meta">
                            <div className="course-card-date">{formatDate(c.created_at)}</div>
                            <div className="course-card-id">#{c.id}</div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

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
                        <motion.button className="page-btn" disabled={page === 1} onClick={() => fetchCourses(1)} whileTap={{ scale: 0.95 }} title="First page">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                        </motion.button>
                        <motion.button className="page-btn" disabled={!previous} onClick={() => fetchCourses(page - 1)} whileTap={{ scale: 0.95 }} title="Previous page">
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
                        <motion.button className="page-btn" disabled={!next} onClick={() => fetchCourses(page + 1)} whileTap={{ scale: 0.95 }} title="Next page">
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
                      {bookIcon}
                      <input
                        id="title"
                        name="title"
                        type="text"
                        required
                        placeholder="e.g. Django 101"
                        value={form.title}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label htmlFor="description">Description</label>
                    <div className="input-wrapper">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                      <input
                        id="description"
                        name="description"
                        type="text"
                        placeholder="Brief course description"
                        value={form.description}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label htmlFor="logo">Logo</label>
                    <div className="logo-upload-area">
                      {logoPreview ? (
                        <div className="logo-preview-wrap">
                          <img src={logoPreview} alt="Preview" className="logo-preview-img" />
                          <button type="button" className="logo-remove-btn" onClick={() => { setLogoFile(null); setLogoPreview(null); }} title="Remove">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ) : (
                        <label htmlFor="logo" className="logo-upload-label">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                          <span>Choose an image</span>
                        </label>
                      )}
                      <input id="logo" type="file" accept="image/*" onChange={handleLogoChange} className="logo-file-input" />
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
