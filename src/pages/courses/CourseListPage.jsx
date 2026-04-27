import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import PageTransition from "../../components/PageTransition";
import "./Courses.css";
import "../admin/Admin.css";

const bookIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </svg>
);

export default function CourseListPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isInstructor = user?.role === "instructor";
  const isStaff = isAdmin || isInstructor;
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [lessonCounts, setLessonCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const searchTimer = useRef(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = isAdmin && searchParams.get("tab") === "create" ? "create" : "list";
  const setActiveTab = (tab) => setSearchParams(tab === "create" ? { tab: "create" } : {});

  const [form, setForm] = useState({ title: "", description: "", price: "" });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const getApiErrorMessage = (err, fallback) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    return fallback;
  };

  const normalizeCourseList = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  };

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page_size", 50);
      if (search) params.set("search", search);
      const { data } = await api.get(`/courses/?${params.toString()}`);
      const courseList = normalizeCourseList(data);
      setCourses(courseList);

      const counts = {};
      await Promise.all(
        courseList.map(async (course) => {
          try {
            const res = await api.get(`/lessons/?course=${course.id}&page_size=1`);
            counts[course.id] = res.data.count ?? (res.data.results || res.data || []).length;
          } catch (err) {
            console.warn(`Failed to load lesson count for course ${course.id}:`, err);
            counts[course.id] = 0;
          }
        })
      );
      setLessonCounts(counts);
    } catch (err) {
      console.error("Failed to fetch courses:", err);
      const errorMsg = getApiErrorMessage(err, "Failed to load courses.");
      toast.error(errorMsg);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {}, 400);
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
      formData.append("price", form.price || "0");
      if (logoFile) formData.append("logo", logoFile);
      await api.post("/courses/", formData);
      toast.success("Course created successfully!");
      setForm({ title: "", description: "", price: "" });
      setLogoFile(null);
      setLogoPreview(null);
      setActiveTab("list");
      fetchCourses();
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

  const [firstLessonByCourse, setFirstLessonByCourse] = useState({});

  useEffect(() => {
    let cancelled = false;
    const fetchFirsts = async () => {
      const map = {};
      await Promise.all(
        courses.map(async (c) => {
          if (!c.is_accessible && user?.role !== "admin" && user?.role !== "instructor") return;
          try {
            const { data } = await api.get(`/lessons/?course=${c.id}&page_size=1&ordering=created_at`);
            const first = (data?.results || data || [])[0];
            if (first?.id) map[c.id] = first.id;
          } catch {}
        })
      );
      if (!cancelled) setFirstLessonByCourse(map);
    };
    if (courses.length > 0) fetchFirsts();
    return () => { cancelled = true; };
  }, [courses, user?.role]);

  const getCoursePath = (course) => {
    const accessible = course?.is_accessible || user?.role === "admin" || user?.role === "instructor";
    if (accessible && firstLessonByCourse[course.id]) {
      return `/lessons/${firstLessonByCourse[course.id]}`;
    }
    if (course?.slug) return `/courses/${course.slug}`;
    if (course?.id != null) return `/courses/${course.id}`;
    return null;
  };

  const cardColors = [
    "linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)",
    "linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%)",
    "linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%)",
    "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%)",
    "linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)",
    "linear-gradient(135deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%)",
  ];

  return (
    <PageTransition>
      <div className="courses-container courses-container--wide">
        <div className="courses-header">
          <div>
            <h1>Courses</h1>
            <p className="courses-subtitle">
              {courses.length} course{courses.length !== 1 ? "s" : ""} available
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="user-tabs">
            <button className={`user-tab ${activeTab === "list" ? "active" : ""}`} onClick={() => setActiveTab("list")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
              All Courses
              {activeTab === "list" && <motion.div className="user-tab-indicator" layoutId="courseTab" />}
            </button>
            <button className={`user-tab ${activeTab === "create" ? "active" : ""}`} onClick={() => setActiveTab("create")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Create Course
              {activeTab === "create" && <motion.div className="user-tab-indicator" layoutId="courseTab" />}
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === "list" ? (
            <motion.div key="list" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
              <div className="user-toolbar">
                <div className="toolbar-search">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                  <input type="text" placeholder="Search courses…" value={search} onChange={handleSearchChange} />
                  {search && (
                    <button className="toolbar-search-clear" onClick={() => setSearch("")} title="Clear search">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="course-cards-grid">
                  {[...Array(4)].map((_, i) => (
                    <div className="course-card-skeleton" key={i}>
                      <div className="skeleton-row" style={{ height: "160px", borderRadius: "12px" }} />
                      <div className="skeleton-row" style={{ height: "20px", width: "70%" }} />
                      <div className="skeleton-row" style={{ height: "14px", width: "100%" }} />
                    </div>
                  ))}
                </div>
              ) : courses.length === 0 ? (
                <div className="course-empty">
                  <h2>No courses found</h2>
                  <p>{search ? "Try a different search term." : (isAdmin ? "No courses have been created yet." : "No courses assigned yet.")}</p>
                </div>
              ) : (
                <div className="cl-grid">
                  {courses.map((course, ci) => {
                    const count = lessonCounts[course.id] ?? 0;
                    const accentList = ["#16a34a", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];
                    const accent = accentList[ci % accentList.length];
                    const coursePath = getCoursePath(course);
                    const accessible = course.is_accessible || isStaff;

                    return (
                      <motion.div
                        key={course.id}
                        className={`cl-card ${accessible ? "cl-card-accessible" : "cl-card-locked"}`}
                        style={{ "--accent": accent }}
                        onClick={() => coursePath && navigate(coursePath)}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(ci * 0.04, 0.3), duration: 0.25 }}
                        whileHover={{ y: -3 }}
                      >
                        <div className="cl-card-icon" style={{ background: accent }}>
                          {course.logo ? (
                            <img src={course.logo} alt="" />
                          ) : (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                          )}
                        </div>

                        <h2 className="cl-card-title">{course.title}</h2>
                        <p className="cl-card-desc">{course.description}</p>

                        <div className="cl-card-meta">
                          <span className="cl-meta-pill">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                            {count} lesson{count !== 1 ? "s" : ""}
                          </span>
                          {!isStaff && course.is_purchased && (
                            <span className="cl-meta-pill cl-meta-owned">✓ Owned</span>
                          )}
                          {!isStaff && !course.is_purchased && course.price === 0 && (
                            <span className="cl-meta-pill cl-meta-free">Free</span>
                          )}
                          {!isStaff && !course.is_accessible && course.price > 0 && (
                            <span className="cl-meta-pill cl-meta-price">${Number(course.price).toFixed(2)}</span>
                          )}
                        </div>

                        <span className="cl-card-cta" style={{ color: accent }}>
                          {accessible ? "Continue learning" : "View course"}
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="create" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="create-user-section">
              <motion.div className="create-form-card glass glow-border" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="create-form-header">
                  <h2>New Course</h2>
                  <p>Fill in the details below to create a new course.</p>
                </div>
                <form onSubmit={handleCreateSubmit}>
                  <div className="input-group">
                    <label htmlFor="title">Title</label>
                    <div className="input-wrapper">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
                      <input id="title" name="title" type="text" required placeholder="e.g. Django 101" value={form.title} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label htmlFor="description">Description</label>
                    <div className="input-wrapper">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" /></svg>
                      <input id="description" name="description" type="text" placeholder="Brief course description" value={form.description} onChange={handleFormChange} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label htmlFor="price">Price (USD)</label>
                    <div className="input-wrapper">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      <input id="price" name="price" type="number" step="0.01" min="0" placeholder="0.00 (free)" value={form.price} onChange={handleFormChange} />
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Leave at 0 or empty for a free course</span>
                  </div>
                  <div className="input-group">
                    <label htmlFor="logo">Logo</label>
                    <div className="logo-upload-area">
                      {logoPreview ? (
                        <div className="logo-preview-wrap">
                          <img src={logoPreview} alt="Preview" className="logo-preview-img" />
                          <button type="button" className="logo-remove-btn" onClick={() => { setLogoFile(null); setLogoPreview(null); }} title="Remove">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          </button>
                        </div>
                      ) : (
                        <label htmlFor="logo" className="logo-upload-label">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                          <span>Choose an image</span>
                        </label>
                      )}
                      <input id="logo" type="file" accept="image/*" onChange={handleLogoChange} className="logo-file-input" />
                    </div>
                  </div>
                  <motion.button type="submit" className="btn-submit" disabled={submitting} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                    {submitting ? (<span className="btn-loading"><span className="btn-spinner" />Creating...</span>) : "Create Course"}
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
