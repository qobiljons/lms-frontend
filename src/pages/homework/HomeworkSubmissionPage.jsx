import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import PageTransition from "../../components/PageTransition";
import "./Homework.css";

const ACCEPTED_EXTS = [
  ".py", ".sql", ".txt", ".md", ".csv", ".json", ".zip",
  ".pbit", ".pbix", ".pdf", ".dax", ".dtsx", ".sln", ".dtproj",
  ".xlsx", ".xls", ".docx", ".rtf",
];

const AI_TYPES = [
  { value: "python", label: "Python", color: "#3776ab", desc: "Auto-grade Python scripts (.py, .zip)" },
  { value: "sql", label: "SQL", color: "#e38c00", desc: "Auto-grade SQL queries (.sql, .txt)" },
  { value: "ssis", label: "SSIS Package", color: "#0078d4", desc: "Auto-grade SSIS packages (.dtsx, .zip)" },
  { value: "power_bi", label: "Power BI", color: "#f2c811", desc: "Auto-grade Power BI reports (.pbit, .pbix, .pdf, .zip)" },
];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function StatusBadge({ status }) {
  const colors = {
    draft: { bg: "rgba(245,158,11,0.12)", color: "#d97706", label: "Draft" },
    submitted: { bg: "rgba(59,130,246,0.12)", color: "#2563eb", label: "Submitted" },
    graded: { bg: "rgba(22,163,74,0.12)", color: "#16a34a", label: "Graded" },
    returned: { bg: "rgba(139,92,246,0.12)", color: "#7c3aed", label: "Returned" },
  };
  const c = colors[status] || { bg: "rgba(107,114,128,0.12)", color: "#6b7280", label: status || "—" };
  return <span className="hw-status-pill" style={{ background: c.bg, color: c.color }}>{c.label}</span>;
}

export default function HomeworkSubmissionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [homework, setHomework] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiGrading, setAiGrading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiType, setAiType] = useState("python");
  const fileInputRef = useRef(null);
  const ensureSubRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const isStudent = user?.role === "student";
  const isStaff = user?.role === "admin" || user?.role === "instructor";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: hw } = await api.get(`/homework/${id}/`);
      setHomework(hw);

      const subs = await api.get(`/homework/submissions/?homework=${id}`);
      const list = Array.isArray(subs.data?.results) ? subs.data.results : (Array.isArray(subs.data) ? subs.data : []);
      const mine = list.find(s => s.student === user.id || s.student?.id === user.id);
      if (mine) {
        const detailed = await api.get(`/homework/submissions/${mine.id}/`);
        setSubmission(detailed.data);
        if (detailed.data.ai_feedback && Object.keys(detailed.data.ai_feedback).length) {
          setAiResult(detailed.data.ai_feedback);
        }
      } else {
        setSubmission(null);
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to load homework.");
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => { load(); }, [load]);

  const ensureSubmission = async () => {
    if (submission) return submission;
    if (ensureSubRef.current) return ensureSubRef.current;
    const promise = (async () => {
      try {
        const { data } = await api.post("/homework/submissions/", {
          homework: Number(id),
          answers: [],
        });
        setSubmission(data);
        return data;
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Could not start submission.");
        return null;
      } finally {
        ensureSubRef.current = null;
      }
    })();
    ensureSubRef.current = promise;
    return promise;
  };

  const uploadFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const sub = await ensureSubmission();
    if (!sub) return;

    setUploading(true);
    let ok = 0;
    let fail = 0;
    for (const f of Array.from(fileList)) {
      const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
      if (!ACCEPTED_EXTS.includes(ext)) {
        toast.error(`"${f.name}" — file type ${ext} not allowed.`);
        fail++;
        continue;
      }
      const fd = new FormData();
      fd.append("file", f);
      try {
        await api.post(`/homework/submissions/${sub.id}/upload/`, fd);
        ok++;
      } catch (err) {
        toast.error(`"${f.name}": ${err?.response?.data?.detail || "upload failed"}`);
        fail++;
      }
    }
    setUploading(false);
    if (ok > 0) toast.success(`${ok} file${ok !== 1 ? "s" : ""} uploaded.`);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await load();
  };

  const onFileChange = (e) => uploadFiles(e.target.files);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    if (!submission) return;
    if ((submission.uploaded_files || []).length === 0) {
      toast.warn("Upload at least one file before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/homework/submissions/${submission.id}/`, { status: "submitted" });
      toast.success("Homework submitted!");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAiTest = async () => {
    if (!submission) {
      toast.warn("Upload files first.");
      return;
    }
    if ((submission.uploaded_files || []).length === 0) {
      toast.warn("Upload at least one file first.");
      return;
    }
    setAiGrading(true);
    setAiResult(null);
    try {
      const { data } = await api.post(`/homework/submissions/${submission.id}/ai-grade/`, {
        type: aiType,
      });
      setAiResult(data);
      toast.success(`Tutor AI scored your work: ${data.score ?? "—"}/100`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "AI grading failed.");
    } finally {
      setAiGrading(false);
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="hw-page">
          <div className="hw-loading">
            <div className="hw-spinner" />
            <p>Loading homework...</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!homework) {
    return (
      <PageTransition>
        <div className="hw-page">
          <div className="hw-empty">
            <p>Homework not found.</p>
            <button className="hw-btn-primary" onClick={() => navigate(-1)}>← Back</button>
          </div>
        </div>
      </PageTransition>
    );
  }

  const status = submission?.status || "draft";
  const files = submission?.uploaded_files || [];
  const dueDate = homework.due_date ? new Date(homework.due_date) : null;
  const isOverdue = dueDate && dueDate < new Date() && status !== "graded";

  return (
    <PageTransition>
      <div className="hw-page">
        <Link to={-1} onClick={(e) => { e.preventDefault(); navigate(-1); }} className="hw-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </Link>

        <motion.div className="hw-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="hw-hero-top">
            <div>
              <h1 className="hw-title">{homework.title}</h1>
              {(homework.course_title || homework.lesson_order) && (
                <div className="hw-breadcrumb">
                  {homework.course_title && <span className="hw-breadcrumb-course">{homework.course_title}</span>}
                  {homework.lesson_order && (
                    <>
                      {homework.course_title && <span className="hw-breadcrumb-sep">·</span>}
                      <span className="hw-breadcrumb-lesson">Lesson {homework.lesson_order}{homework.lesson_total ? ` of ${homework.lesson_total}` : ""}</span>
                    </>
                  )}
                  {homework.lesson_title && (
                    <>
                      <span className="hw-breadcrumb-sep">·</span>
                      <span className="hw-breadcrumb-lesson-title">{homework.lesson_title}</span>
                    </>
                  )}
                </div>
              )}
              <div className="hw-meta">
                <span className="hw-meta-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  {homework.total_points} pts
                </span>
                {dueDate && (
                  <span className={`hw-meta-item ${isOverdue ? "hw-overdue" : ""}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Due {formatDate(homework.due_date)}{isOverdue && " (overdue)"}
                  </span>
                )}
                <StatusBadge status={status} />
              </div>
            </div>
            {submission?.score != null && (
              <div className="hw-score-block">
                <span className="hw-score-num" style={{ color: Number(submission.score) / homework.total_points >= 0.6 ? "#16a34a" : "#ef4444" }}>
                  {submission.score}<span className="hw-score-out">/{homework.total_points}</span>
                </span>
                <span className="hw-score-lbl">Final score</span>
              </div>
            )}
          </div>
          {homework.description && (
            <p className="hw-description">{homework.description}</p>
          )}
        </motion.div>

        <div className="hw-grid">
          <motion.div className="hw-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <h2 className="hw-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              Your files
            </h2>
            <div
              className={`hw-dropzone ${dragOver ? "hw-dropzone-over" : ""} ${uploading ? "hw-dropzone-uploading" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <div>
                <strong>{uploading ? "Uploading..." : "Drag files here"}</strong>
                <div className="hw-dropzone-hint">
                  Accepted: {ACCEPTED_EXTS.join(", ")}
                </div>
              </div>
              <button
                type="button"
                className="hw-btn-upload"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <span className="hw-spinner-sm" style={{ borderTopColor: "#16a34a", borderColor: "rgba(22,163,74,0.25)" }} />
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Choose Files
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_EXTS.join(",")}
                onChange={onFileChange}
                style={{ display: "none" }}
              />
            </div>

            {files.length > 0 ? (
              <div className="hw-file-list">
                {files.map((f) => (
                  <div key={f.id} className="hw-file-item">
                    <div className="hw-file-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div className="hw-file-info">
                      <span className="hw-file-name">{f.filename}</span>
                      <span className="hw-file-meta">{formatBytes(f.file_size || 0)} · {formatDate(f.uploaded_at)}</span>
                    </div>
                    {f.file && (
                      <a className="hw-file-dl" href={f.file} target="_blank" rel="noopener noreferrer" title="Download">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="hw-no-files">No files uploaded yet.</div>
            )}

            {files.length > 0 && (
              <button className="hw-btn-primary hw-submit-btn" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Homework"}
              </button>
            )}
            {status === "submitted" && (
              <div className="hw-info-box">
                ✓ Submitted! Waiting for instructor review.
              </div>
            )}
          </motion.div>

          {isStudent && (
            <motion.div className="hw-card hw-ai-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h2 className="hw-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v2"/><path d="M9 7a3 3 0 0 1 6 0v1H9V7z"/><rect x="4" y="8" width="16" height="12" rx="3"/><circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/></svg>
                Self-test with Tutor AI
              </h2>
              <p className="hw-ai-desc">
                Get instant AI feedback on your work before submitting. This won't affect your final grade — it's just to help you improve.
              </p>

              <div className="hw-ai-types">
                {AI_TYPES.map((t) => (
                  <button
                    key={t.value}
                    className={`hw-ai-type ${aiType === t.value ? "active" : ""}`}
                    onClick={() => setAiType(t.value)}
                    style={aiType === t.value ? { borderColor: t.color, color: t.color, background: `${t.color}12` } : {}}
                    title={t.desc}
                    disabled={aiGrading}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <button
                className="hw-btn-ai"
                onClick={handleAiTest}
                disabled={aiGrading || files.length === 0}
              >
                {aiGrading ? (
                  <>
                    <span className="hw-spinner-sm" />
                    Analyzing your work...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    Test with AI
                  </>
                )}
              </button>

              <AnimatePresence>
                {aiResult && (
                  <motion.div
                    className="hw-ai-result"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="hw-ai-result-head">
                      <span className="hw-ai-result-label">AI Score</span>
                      <span className="hw-ai-result-score" style={{ color: (aiResult.score ?? 0) >= 70 ? "#16a34a" : (aiResult.score ?? 0) >= 50 ? "#f59e0b" : "#ef4444" }}>
                        {aiResult.score ?? "—"}/100
                      </span>
                    </div>
                    {aiResult.feedback && (
                      <div className="hw-ai-feedback">
                        {String(aiResult.feedback).split("\n").map((line, i) => (
                          <p key={i}>{line || <br />}</p>
                        ))}
                      </div>
                    )}
                    <div className="hw-ai-disclaimer">
                      ⚠️ This is AI-generated feedback to help you learn. Your real grade comes from your instructor.
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {(submission?.feedback || submission?.score != null) && (
          <motion.div className="hw-card hw-feedback-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <h2 className="hw-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Instructor Feedback
            </h2>
            {submission.feedback ? (
              <div className="hw-instructor-feedback">
                {submission.feedback.split("\n").map((line, i) => (
                  <p key={i}>{line || <br />}</p>
                ))}
              </div>
            ) : (
              <p className="hw-no-feedback">No written feedback. Score: {submission.score}/{homework.total_points}</p>
            )}
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
