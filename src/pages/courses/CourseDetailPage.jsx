import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import PageTransition from "../../components/PageTransition";
import "./Courses.css";
import "../admin/Admin.css";

const lessonVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

export default function CourseDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const normalizedRole = (user?.role || "").toLowerCase();
  const isAdmin = normalizedRole === "admin";
  const isInstructor = normalizedRole === "instructor" || normalizedRole === "teacher";
  const canEditCourse = isAdmin || isInstructor;

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", price: "0" });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteName, setConfirmDeleteName] = useState("");

  // Lessons state
  const [lessons, setLessons] = useState([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [lessonForm, setLessonForm] = useState({
    title: "",
    content: "",
    video_provider: "",
    youtube_url: "",
    homework: "",
  });
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [showCreateLesson, setShowCreateLesson] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [editLessonForm, setEditLessonForm] = useState({
    title: "",
    content: "",
    video_provider: "",
    youtube_url: "",
    homework: "",
  });
  const [savingLesson, setSavingLesson] = useState(false);
  const [deletingLessonId, setDeletingLessonId] = useState(null);
  const [confirmDeleteLessonId, setConfirmDeleteLessonId] = useState(null);
  const [accessError, setAccessError] = useState(null);

  const getApiErrorMessage = (err, fallback) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    return fallback;
  };

  const isPurchaseRequiredError = (err) => {
    if (err?.response?.status !== 403) return false;
    const detail = err?.response?.data?.detail;
    if (typeof detail !== "string") return false;
    return detail.toLowerCase().includes("purchase");
  };

  const isNotAssignedError = (err) => {
    if (err?.response?.status !== 403) return false;
    const detail = err?.response?.data?.detail;
    if (typeof detail !== "string") return false;
    return detail.toLowerCase().includes("not assigned");
  };

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        setAccessError(null);
        const { data } = await api.get(`/courses/${slug}/`);
        setCourse(data);
        setForm({ title: data.title, description: data.description || "", price: data.price || "0" });
      } catch (err) {
        const message = getApiErrorMessage(err, "Failed to load course.");
        setAccessError({
          message,
          status: err?.response?.status ?? null,
          purchaseRequired: isPurchaseRequiredError(err),
          notAssigned: isNotAssignedError(err),
        });
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [slug]);

  const fetchLessons = useCallback(async () => {
    if (!course?.id) {
      setLessons([]);
      return;
    }
    setLessonsLoading(true);
    try {
      let url = `/lessons/?course=${course.id}`;
      const collected = [];
      while (url) {
        const { data } = await api.get(url);
        const results = data.results || data || [];
        collected.push(...results);
        url = data?.next || null;
      }
      const filtered = collected.filter((lesson) => {
        const lessonCourse = typeof lesson.course === "object" ? lesson.course?.id : lesson.course;
        return lessonCourse === course.id;
      });
      setLessons(filtered);
    } catch (err) {
      const message = getApiErrorMessage(err, "Failed to load lessons.");
      if (err?.response?.status === 403) {
        setAccessError({
          message,
          status: 403,
          purchaseRequired: isPurchaseRequiredError(err),
          notAssigned: isNotAssignedError(err),
        });
      }
      toast.error(message);
    } finally {
      setLessonsLoading(false);
    }
  }, [course?.id]);

  const canAccessCourse = isAdmin || course?.is_accessible;
  useEffect(() => {
    if (course?.id && canAccessCourse) fetchLessons();
  }, [course?.id, canAccessCourse, fetchLessons]);

  // Check for purchase success redirect
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const success = searchParams.get("purchase_success");
    if (success === "true" && sessionId) {
      api.get(`/payments/course-checkout/success/?session_id=${sessionId}`)
        .then(() => {
          toast.success("Course purchased successfully!");
          // Reload course to get updated is_accessible
          api.get(`/courses/${slug}/`).then(({ data }) => setCourse(data));
        })
        .catch(() => toast.error("Could not verify purchase. Please refresh."));
    }
  }, []);

  const handlePurchase = async () => {
    if (!course) return;
    setPurchasing(true);
    try {
      const { data } = await api.post("/payments/course-checkout/", { course_id: course.id });
      if (data.demo) {
        toast.success("Course purchased successfully!");
        const { data: updated } = await api.get(`/courses/${slug}/`);
        setCourse(updated);
        fetchLessons();
      } else if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to purchase course.");
    } finally {
      setPurchasing(false);
    }
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

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("price", form.price || "0");
      if (logoFile) formData.append("logo", logoFile);
      const { data } = await api.patch(`/courses/${slug}/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCourse(data);
      setEditing(false);
      setLogoFile(null);
      setLogoPreview(null);
      toast.success("Course updated!");
      if (data.slug && data.slug !== slug) navigate(`/courses/${data.slug}`, { replace: true });
    } catch (err) {
      const errData = err.response?.data;
      if (errData && typeof errData === "object") {
        const firstError = Object.values(errData).flat()[0];
        toast.error(firstError || "Failed to update course.");
      } else {
        toast.error("Failed to update course.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!course || confirmDeleteName !== course.title) {
      toast.error("Please type the exact course name to confirm deletion.");
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/courses/${slug}/`);
      toast.success("Course deleted.");
      navigate("/courses");
    } catch {
      toast.error("Failed to delete course.");
    } finally {
      setDeleting(false);
    }
  };

  // Lesson handlers
  const handleCreateLesson = async (e) => {
    e.preventDefault();
    if (!course?.id || !user?.id) {
      toast.error("Missing course or user information.");
      return;
    }
    setCreatingLesson(true);
    try {
      await api.post("/lessons/", {
        ...lessonForm,
        course: course.id,
        user: user.id,
      });
      toast.success("Lesson created!");
      setLessonForm({ title: "", content: "", video_provider: "", youtube_url: "", homework: "" });
      setShowCreateLesson(false);
      fetchLessons();
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const firstError = Object.values(data).flat()[0];
        toast.error(firstError || "Failed to create lesson.");
      } else {
        toast.error("Failed to create lesson.");
      }
    } finally {
      setCreatingLesson(false);
    }
  };

  const handleUpdateLesson = async (e, lessonId) => {
    e.preventDefault();
    setSavingLesson(true);
    try {
      const { data } = await api.patch(`/lessons/${lessonId}/`, editLessonForm);
      setEditingLessonId(null);
      if (selectedLesson?.id === lessonId) {
        setSelectedLesson(data);
      }
      toast.success("Lesson updated!");
      fetchLessons();
    } catch (err) {
      const errData = err.response?.data;
      if (errData && typeof errData === "object") {
        const firstError = Object.values(errData).flat()[0];
        toast.error(firstError || "Failed to update lesson.");
      } else {
        toast.error("Failed to update lesson.");
      }
    } finally {
      setSavingLesson(false);
    }
  };

  const handleDeleteLesson = async (lessonId) => {
    setDeletingLessonId(lessonId);
    try {
      await api.delete(`/lessons/${lessonId}/`);
      setConfirmDeleteLessonId(null);
      setSelectedLesson(null);
      toast.success("Lesson deleted.");
      fetchLessons();
    } catch {
      toast.error("Failed to delete lesson.");
    } finally {
      setDeletingLessonId(null);
    }
  };

  const startEditLesson = (lesson) => {
    setEditingLessonId(lesson.id);
    setEditLessonForm({
      title: lesson.title,
      content: lesson.content || "",
      video_provider: lesson.video_provider || "",
      youtube_url: lesson.youtube_url || "",
      homework: lesson.homework || "",
    });
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}`;
    }
    return null;
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="courses-container">
          <div className="detail-skeleton glass">
            {[...Array(4)].map((_, i) => (
              <div className="skeleton-row" key={i} />
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!course) {
    if (accessError?.status === 403) {
      return (
        <PageTransition>
          <div className="courses-container">
            <div className="course-empty">
              <h2>Access Restricted</h2>
              <p>{accessError.message}</p>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1rem", flexWrap: "wrap" }}>
                {accessError.notAssigned && (
                  <motion.button
                    className="course-btn course-btn-edit"
                    onClick={() => navigate("/my-groups")}
                    whileTap={{ scale: 0.95 }}
                  >
                    Back to My Groups
                  </motion.button>
                )}
                {accessError.purchaseRequired && (
                  <motion.button
                    className="course-btn course-btn-save"
                    onClick={() => navigate("/payments")}
                    whileTap={{ scale: 0.95 }}
                  >
                    Go to Payments
                  </motion.button>
                )}
                <Link to="/courses" className="back-link">← Back to Courses</Link>
              </div>
            </div>
          </div>
        </PageTransition>
      );
    }
    return (
      <PageTransition>
        <div className="courses-container">
          <div className="course-empty">
            <h2>Course not found</h2>
            <Link to="/courses" className="back-link">← Back to Courses</Link>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="courses-container">
        <motion.div
          className="detail-breadcrumb"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Link to="/courses" className="back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            All Courses
          </Link>
        </motion.div>

        <motion.div
          className="course-detail-card glass glow-border"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <AnimatePresence mode="wait">
            {editing ? (
              <motion.form
                key="edit"
                className="course-edit-form"
                onSubmit={handleSave}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="input-group">
                  <label htmlFor="edit-title">Title</label>
                  <input
                    id="edit-title"
                    name="title"
                    type="text"
                    required
                    value={form.title}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="edit-description">Description</label>
                  <textarea
                    id="edit-description"
                    name="description"
                    value={form.description}
                    onChange={handleFormChange}
                    rows={5}
                  />
                </div>
                {isAdmin && (
                  <div className="input-group">
                    <label htmlFor="edit-price">Price (USD)</label>
                    <input
                      id="edit-price"
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.price}
                      onChange={handleFormChange}
                      placeholder="0.00 (free)"
                    />
                  </div>
                )}
                <div className="input-group">
                  <label htmlFor="edit-logo">Logo</label>
                  <div className="logo-upload-area">
                    {(logoPreview || course.logo) ? (
                      <div className="logo-preview-wrap">
                        <img src={logoPreview || course.logo} alt="Logo" className="logo-preview-img" />
                        <button type="button" className="logo-remove-btn" onClick={() => { setLogoFile(null); setLogoPreview(null); }} title="Remove">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    ) : (
                      <label htmlFor="edit-logo" className="logo-upload-label">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                        <span>Choose an image</span>
                      </label>
                    )}
                    <input id="edit-logo" type="file" accept="image/*" onChange={handleLogoChange} className="logo-file-input" />
                  </div>
                </div>
                <div className="course-actions" style={{ borderTop: "none", marginTop: 0, paddingTop: 0 }}>
                  <motion.button
                    type="submit"
                    className="course-btn course-btn-save"
                    disabled={saving}
                    whileTap={{ scale: 0.95 }}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </motion.button>
                  <motion.button
                    type="button"
                    className="course-btn course-btn-cancel"
                    onClick={() => {
                      setEditing(false);
                      setForm({ title: course.title, description: course.description || "", price: course.price || "0" });
                      setLogoFile(null);
                      setLogoPreview(null);
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.form>
            ) : (
              <motion.div
                key="view"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="course-detail-title">{course.title}</h2>
                <p className="course-detail-date">Created {formatDate(course.created_at)}</p>
                {course.logo && (
                  <div className="course-detail-logo-wrap">
                    <img src={course.logo} alt={course.title} className="course-detail-logo" />
                  </div>
                )}
                <div className="course-detail-section">
                  <h3>Description</h3>
                  <p>{course.description || "No description provided."}</p>
                </div>

                {/* Price display */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1rem 0" }}>
                  <span style={{
                    display: "inline-block", padding: "0.3rem 0.75rem", borderRadius: 8,
                    fontSize: "0.9rem", fontWeight: 700,
                    background: course.price > 0 ? "rgba(245,158,11,0.12)" : "rgba(22,163,74,0.12)",
                    color: course.price > 0 ? "#f59e0b" : "#16a34a",
                    border: `1px solid ${course.price > 0 ? "rgba(245,158,11,0.2)" : "rgba(22,163,74,0.2)"}`,
                  }}>
                    {course.price > 0 ? `$${Number(course.price).toFixed(2)}` : "Free"}
                  </span>
                  {!isAdmin && course.is_accessible && course.price > 0 && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "0.3rem",
                      padding: "0.3rem 0.6rem", borderRadius: 8, fontSize: "0.8rem", fontWeight: 600,
                      background: "rgba(22,163,74,0.12)", color: "#16a34a",
                      border: "1px solid rgba(22,163,74,0.2)",
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {course.is_purchased ? "Purchased" : "VIP Access"}
                    </span>
                  )}
                </div>

                {canEditCourse && (
                  <div className="course-actions">
                    <motion.button
                      className="course-btn course-btn-edit"
                      onClick={() => setEditing(true)}
                      whileTap={{ scale: 0.95 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      Edit
                    </motion.button>

                    {isAdmin && (
                      <AnimatePresence mode="wait">
                        {confirmDelete ? (
                          <motion.div
                            key="confirm"
                            className="course-confirm-row"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <span className="course-confirm-text">Type the course name to confirm.</span>
                            <input
                              className="course-confirm-input"
                              type="text"
                              value={confirmDeleteName}
                              onChange={(e) => setConfirmDeleteName(e.target.value)}
                              placeholder={course.title}
                              aria-label="Confirm course name"
                            />
                            <motion.button
                              className="course-btn course-btn-delete"
                              onClick={handleDelete}
                              disabled={deleting || confirmDeleteName !== course.title}
                              whileTap={{ scale: 0.95 }}
                            >
                              {deleting ? "Deleting..." : "Yes, Delete"}
                            </motion.button>
                            <motion.button
                              className="course-btn course-btn-cancel"
                              onClick={() => {
                                setConfirmDelete(false);
                                setConfirmDeleteName("");
                              }}
                              whileTap={{ scale: 0.95 }}
                            >
                              No
                            </motion.button>
                          </motion.div>
                        ) : (
                          <motion.button
                            key="delete"
                            className="course-btn course-btn-delete"
                            onClick={() => {
                              setConfirmDelete(true);
                              setConfirmDeleteName("");
                            }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            Delete
                          </motion.button>
                        )}
                      </AnimatePresence>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Purchase CTA for locked courses */}
        {!isAdmin && !course.is_accessible && course.price > 0 && (
          <motion.div
            className="course-detail-card glass glow-border"
            style={{ marginTop: "1.5rem", textAlign: "center", padding: "2rem" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "1rem", opacity: 0.5 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
             <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>Unlock This Course</h3>
             <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
               {accessError?.message || "Purchase this course to access all lessons and content."}
             </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
              <motion.button
                className="course-btn course-btn-save"
                onClick={handlePurchase}
                disabled={purchasing}
                whileTap={{ scale: 0.95 }}
                style={{ padding: "0.6rem 1.5rem", fontSize: "0.95rem" }}
              >
                {purchasing ? "Processing..." : `Buy for $${Number(course.price).toFixed(2)}`}
              </motion.button>
              <motion.button
                className="course-btn course-btn-edit"
                onClick={() => navigate("/billing")}
                whileTap={{ scale: 0.95 }}
                style={{ padding: "0.6rem 1.5rem", fontSize: "0.95rem" }}
              >
                Subscribe to VIP
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Lessons section — only show if accessible or admin */}
        {(isAdmin || course.is_accessible) && (<>
        <motion.div
          className="lessons-section-header"
          style={{ marginTop: "1.5rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--text-secondary)" }}>Lessons</h3>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginLeft: "0.25rem" }}>({lessons.length})</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
              {isAdmin && (
                <div style={{ marginBottom: "1rem" }}>
                  {showCreateLesson ? (
                    <motion.div
                      className="lesson-create-card glass glow-border"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <form onSubmit={handleCreateLesson} className="course-edit-form">
                        <div className="input-group">
                          <label htmlFor="lesson-title">Lesson Title</label>
                          <input
                            id="lesson-title"
                            type="text"
                            required
                            placeholder="e.g. Introduction to Variables"
                            value={lessonForm.title}
                            onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                          />
                        </div>
                        <div className="input-group">
                          <label htmlFor="lesson-content">Content</label>
                          <textarea
                            id="lesson-content"
                            placeholder="Lesson content…"
                            value={lessonForm.content}
                            onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })}
                            rows={4}
                          />
                        </div>
                        <div className="input-group">
                          <label htmlFor="lesson-video-provider">Video Provider</label>
                          <input
                            id="lesson-video-provider"
                            type="text"
                            placeholder="e.g. YouTube, Vimeo"
                            value={lessonForm.video_provider}
                            onChange={(e) => setLessonForm({ ...lessonForm, video_provider: e.target.value })}
                          />
                        </div>
                        <div className="input-group">
                          <label htmlFor="lesson-youtube-url">YouTube URL</label>
                          <input
                            id="lesson-youtube-url"
                            type="url"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={lessonForm.youtube_url}
                            onChange={(e) => setLessonForm({ ...lessonForm, youtube_url: e.target.value })}
                          />
                        </div>
                        <div className="input-group">
                          <label htmlFor="lesson-homework">Homework</label>
                          <textarea
                            id="lesson-homework"
                            placeholder="Homework instructions…"
                            value={lessonForm.homework}
                            onChange={(e) => setLessonForm({ ...lessonForm, homework: e.target.value })}
                            rows={3}
                          />
                        </div>
                        <div className="course-actions" style={{ borderTop: "none", marginTop: 0, paddingTop: 0 }}>
                          <motion.button type="submit" className="course-btn course-btn-save" disabled={creatingLesson} whileTap={{ scale: 0.95 }}>
                            {creatingLesson ? "Creating..." : "Create Lesson"}
                          </motion.button>
                          <motion.button type="button" className="course-btn course-btn-cancel" onClick={() => { setShowCreateLesson(false); setLessonForm({ title: "", content: "", video_provider: "", youtube_url: "", homework: "" }); }} whileTap={{ scale: 0.95 }}>
                            Cancel
                          </motion.button>
                        </div>
                      </form>
                    </motion.div>
                  ) : (
                    <motion.button
                      className="course-btn course-btn-save"
                      onClick={() => setShowCreateLesson(true)}
                      whileTap={{ scale: 0.95 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Add Lesson
                    </motion.button>
                  )}
                </div>
              )}

              {lessonsLoading ? (
                <div className="admin-loading">
                  <motion.div className="table-skeleton glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {[...Array(3)].map((_, i) => <div className="skeleton-row" key={i} />)}
                  </motion.div>
                </div>
              ) : lessons.length === 0 ? (
                <div className="course-empty">
                  <h2>No lessons yet</h2>
                  <p>{isAdmin ? "Add the first lesson to this course." : "No lessons have been added to this course yet."}</p>
                </div>
              ) : selectedLesson ? (
                /* Lesson Detail View */
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.button
                    className="back-link"
                    onClick={() => setSelectedLesson(null)}
                    whileTap={{ scale: 0.95 }}
                    style={{ marginBottom: "1rem", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Back to Lessons
                  </motion.button>

                  <motion.div className="lesson-detail-card glass glow-border">
                    {editingLessonId === selectedLesson.id ? (
                      /* Edit Form */
                      <form onSubmit={(e) => handleUpdateLesson(e, selectedLesson.id)} className="course-edit-form">
                        <div className="input-group">
                          <label>Title</label>
                          <input
                            type="text"
                            required
                            value={editLessonForm.title}
                            onChange={(e) => setEditLessonForm({ ...editLessonForm, title: e.target.value })}
                          />
                        </div>
                        <div className="input-group">
                          <label>Content</label>
                          <textarea
                            value={editLessonForm.content}
                            onChange={(e) => setEditLessonForm({ ...editLessonForm, content: e.target.value })}
                            rows={6}
                          />
                        </div>
                        <div className="input-group">
                          <label>Video Provider</label>
                          <input
                            type="text"
                            value={editLessonForm.video_provider}
                            onChange={(e) => setEditLessonForm({ ...editLessonForm, video_provider: e.target.value })}
                            placeholder="e.g., YouTube"
                          />
                        </div>
                        <div className="input-group">
                          <label>YouTube URL</label>
                          <input
                            type="url"
                            value={editLessonForm.youtube_url}
                            onChange={(e) => setEditLessonForm({ ...editLessonForm, youtube_url: e.target.value })}
                            placeholder="https://www.youtube.com/watch?v=..."
                          />
                        </div>
                        <div className="input-group">
                          <label>Homework</label>
                          <textarea
                            value={editLessonForm.homework}
                            onChange={(e) => setEditLessonForm({ ...editLessonForm, homework: e.target.value })}
                            rows={4}
                          />
                        </div>
                        <div className="course-actions" style={{ borderTop: "none", marginTop: 0, paddingTop: 0 }}>
                          <motion.button type="submit" className="course-btn course-btn-save" disabled={savingLesson} whileTap={{ scale: 0.95 }}>
                            {savingLesson ? "Saving..." : "Save Changes"}
                          </motion.button>
                          <motion.button type="button" className="course-btn course-btn-cancel" onClick={() => setEditingLessonId(null)} whileTap={{ scale: 0.95 }}>
                            Cancel
                          </motion.button>
                        </div>
                      </form>
                    ) : (
                      /* Lesson Content Display */
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1.5rem" }}>
                          <div>
                            <h2 className="course-detail-title">{selectedLesson.title}</h2>
                            <p className="course-detail-date">Created {formatDate(selectedLesson.created_at)}</p>
                          </div>
                          {canEditCourse && (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <motion.button
                                className="course-btn course-btn-edit"
                                onClick={() => startEditLesson(selectedLesson)}
                                whileTap={{ scale: 0.95 }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                Edit
                              </motion.button>
                              {isAdmin && (
                                <AnimatePresence mode="wait">
                                  {confirmDeleteLessonId === selectedLesson.id ? (
                                    <motion.div key="confirm" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                      <span style={{ fontSize: "0.875rem" }}>Delete?</span>
                                      <motion.button className="course-btn course-btn-delete" onClick={() => handleDeleteLesson(selectedLesson.id)} disabled={deletingLessonId === selectedLesson.id} whileTap={{ scale: 0.95 }}>
                                        {deletingLessonId === selectedLesson.id ? "..." : "Yes"}
                                      </motion.button>
                                      <motion.button className="course-btn course-btn-cancel" onClick={() => setConfirmDeleteLessonId(null)} whileTap={{ scale: 0.95 }}>
                                        No
                                      </motion.button>
                                    </motion.div>
                                  ) : (
                                    <motion.button key="del" className="course-btn course-btn-delete" onClick={() => setConfirmDeleteLessonId(selectedLesson.id)} whileTap={{ scale: 0.95 }}>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                      Delete
                                    </motion.button>
                                  )}
                                </AnimatePresence>
                              )}
                            </div>
                          )}
                        </div>

                        {/* YouTube Video Embed */}
                        {selectedLesson.youtube_url && getYouTubeEmbedUrl(selectedLesson.youtube_url) && (
                          <div className="lesson-video-section" style={{ marginBottom: "2rem" }}>
                            <div className="lesson-video-wrapper" style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "12px", backgroundColor: "rgba(0,0,0,0.1)" }}>
                              <iframe
                                src={getYouTubeEmbedUrl(selectedLesson.youtube_url)}
                                title={selectedLesson.title}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: "12px" }}
                              />
                            </div>
                            {selectedLesson.video_provider && (
                              <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", opacity: 0.7 }}>
                                Provider: {selectedLesson.video_provider}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Lesson Content */}
                        {selectedLesson.content && (
                          <div className="course-detail-section">
                            <h3>Lesson Content</h3>
                            <p style={{ whiteSpace: "pre-wrap", lineHeight: "1.6" }}>{selectedLesson.content}</p>
                          </div>
                        )}

                        {/* Homework Section */}
                        {selectedLesson.homework && (
                          <div className="course-detail-section">
                            <h3>Homework</h3>
                            <p style={{ whiteSpace: "pre-wrap", lineHeight: "1.6" }}>{selectedLesson.homework}</p>
                          </div>
                        )}

                        {/* External Link */}
                        {selectedLesson.youtube_url && (
                          <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                            <a
                              href={selectedLesson.youtube_url}
                              target="_blank"
                              rel="noreferrer"
                              className="lesson-card-link"
                              style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                              Watch on YouTube
                            </a>
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                </motion.div>
              ) : (
                /* Lessons List View */
                <div className="lesson-list">
                  <AnimatePresence mode="wait">
                    {lessons.map((lesson, i) => (
                      <motion.div
                        key={lesson.id}
                        className="lesson-card glass"
                        custom={i}
                        variants={lessonVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={() => setSelectedLesson(lesson)}
                        style={{ cursor: "pointer" }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="lesson-card-header">
                          <div className="lesson-card-order">#{lesson.id}</div>
                          <div className="lesson-card-body">
                            <span className="lesson-card-title">{lesson.title}</span>
                            {lesson.content && <p className="lesson-card-content" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{lesson.content}</p>}
                            {(lesson.video_provider || lesson.youtube_url) && (
                              <div className="lesson-card-meta">
                                {lesson.video_provider && <span className="lesson-card-chip">{lesson.video_provider}</span>}
                                {lesson.youtube_url && (
                                  <span className="lesson-card-chip" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                                    Video
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div style={{ marginLeft: "auto", paddingLeft: "1rem" }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
        </motion.div>
        </>)}
      </div>
    </PageTransition>
  );
}
