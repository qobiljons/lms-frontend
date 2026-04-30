import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { getAvatarUrl, avatarErrorHandler } from "../../utils/avatar";
import PageTransition from "../../components/PageTransition";
import "./AdminHomeworkPage.css";

const STATUS_META = {
  draft:     { label: "Draft",     color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  submitted: { label: "Submitted", color: "#3b82f6", bg: "rgba(59,130,246,0.1)"  },
  graded:    { label: "Graded",    color: "#16a34a", bg: "rgba(22,163,74,0.1)"   },
  returned:  { label: "Returned",  color: "#8b5cf6", bg: "rgba(139,92,246,0.1)"  },
  missing:   { label: "Missing",   color: "#ef4444", bg: "rgba(239,68,68,0.08)"  },
};

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.missing;
  return (
    <span className="ahw-pill" style={{ color: m.color, background: m.bg }}>
      <span className="ahw-pill-dot" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

function Avatar({ profile, name, size = 32 }) {
  const url = getAvatarUrl(profile);
  const initials = (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  if (url) {
    return (
      <img
        className="ahw-avatar"
        src={url}
        alt={name}
        style={{ width: size, height: size }}
        onError={avatarErrorHandler(profile)}
      />
    );
  }
  const colors = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#16a34a","#3b82f6","#ef4444"];
  const bg = colors[(name || "").charCodeAt(0) % colors.length];
  return (
    <div className="ahw-avatar ahw-avatar-initials" style={{ width: size, height: size, background: bg }}>
      {initials}
    </div>
  );
}

function ScoreBar({ score, total }) {
  if (score == null || !total) return <span className="ahw-no-score">—</span>;
  const pct = Math.min(100, (Number(score) / Number(total)) * 100);
  const color = pct >= 70 ? "#16a34a" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="ahw-score-wrap">
      <span className="ahw-score-num" style={{ color }}>{score}<span className="ahw-score-denom">/{total}</span></span>
      <div className="ahw-score-bar">
        <div className="ahw-score-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function ProgressRing({ submitted, total }) {
  const pct = total > 0 ? submitted / total : 0;
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const color = pct === 1 ? "#16a34a" : pct >= 0.5 ? "#f59e0b" : "#ef4444";
  return (
    <div className="ahw-ring-wrap">
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="3.5" />
        <circle
          cx="22" cy="22" r={r} fill="none"
          stroke={color} strokeWidth="3.5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <span className="ahw-ring-label" style={{ color }}>{submitted}/{total}</span>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function formatBytes(b) {
  if (!b) return "";
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / 1048576).toFixed(1)}MB`;
}

const COURSE_COLORS = [
  { color: "#6366f1", iconBg: "rgba(99,102,241,0.15)",  cardAccent: "rgba(99,102,241,0.06)"  },
  { color: "#ec4899", iconBg: "rgba(236,72,153,0.15)",  cardAccent: "rgba(236,72,153,0.06)"  },
  { color: "#f59e0b", iconBg: "rgba(245,158,11,0.15)",  cardAccent: "rgba(245,158,11,0.06)"  },
  { color: "#16a34a", iconBg: "rgba(22,163,74,0.15)",   cardAccent: "rgba(22,163,74,0.06)"   },
  { color: "#3b82f6", iconBg: "rgba(59,130,246,0.15)",  cardAccent: "rgba(59,130,246,0.06)"  },
  { color: "#ef4444", iconBg: "rgba(239,68,68,0.15)",   cardAccent: "rgba(239,68,68,0.06)"   },
  { color: "#14b8a6", iconBg: "rgba(20,184,166,0.15)",  cardAccent: "rgba(20,184,166,0.06)"  },
];

export default function AdminHomeworkPage() {
  const [homeworks, setHomeworks]           = useState([]);
  const [loading, setLoading]               = useState(true);

  // Navigation drill-down
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedGroup, setSelectedGroup]   = useState(null);
  const [courseGroups, setCourseGroups]     = useState([]);
  const [loadingGroups, setLoadingGroups]   = useState(false);

  // Submissions per homework id
  const [subsMap, setSubsMap]               = useState({});
  const [expandedId, setExpandedId]         = useState(null);
  const [loadingExpand, setLoadingExpand]   = useState(null);
  const [subFilter, setSubFilter]           = useState({});

  // Inline grading
  const [gradingId, setGradingId]           = useState(null);
  const [gradeForm, setGradeForm]           = useState({ score: "", feedback: "" });
  const [saving, setSaving]                 = useState(false);

  const fetchHomeworks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/homework/?page_size=200");
      setHomeworks(data.results || data);
    } catch {
      toast.error("Failed to load homeworks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHomeworks(); }, [fetchHomeworks]);

  // Unique courses extracted from homeworks
  const courses = [...new Map(
    homeworks.filter(h => h.course_id).map(h => [h.course_id, { id: h.course_id, title: h.course_title || `Course #${h.course_id}` }])
  ).values()]
    .map(c => ({ ...c, count: homeworks.filter(h => h.course_id === c.id).length }))
    .sort((a, b) => a.title.localeCompare(b.title));

  // ── Phase handlers ──────────────────────────────────────────────────────────

  const handleSelectCourse = async (course) => {
    setSelectedCourse(course);
    setSelectedGroup(null);
    setCourseGroups([]);
    setSubsMap({});
    setExpandedId(null);
    setLoadingGroups(true);
    try {
      const { data } = await api.get("/groups/my/");
      const all = data.results || data || [];
      const relevant = all.filter(g =>
        (g.courses || []).some(c => (typeof c === "object" ? c.id : c) === course.id)
      );
      if (relevant.length === 0) { setCourseGroups([]); return; }
      const details = await Promise.all(relevant.map(g => api.get(`/groups/${g.id}/`)));
      setCourseGroups(details.map(r => r.data));
    } catch {
      toast.error("Failed to load groups.");
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
    setSubsMap({});
    setExpandedId(null);
    setSubFilter({});
  };

  const handleBack = () => {
    if (selectedGroup) {
      setSelectedGroup(null);
      setSubsMap({});
      setExpandedId(null);
    } else if (selectedCourse) {
      setSelectedCourse(null);
      setCourseGroups([]);
    }
  };

  const goToRoot = () => {
    setSelectedCourse(null);
    setSelectedGroup(null);
    setCourseGroups([]);
    setSubsMap({});
    setExpandedId(null);
  };

  const goToCourse = () => {
    setSelectedGroup(null);
    setSubsMap({});
    setExpandedId(null);
  };

  // ── Expansion & grading ────────────────────────────────────────────────────

  const handleExpand = async (hw) => {
    if (expandedId === hw.id) { setExpandedId(null); return; }
    setExpandedId(hw.id);
    if (subsMap[hw.id]) return;
    setLoadingExpand(hw.id);
    try {
      const { data } = await api.get(`/homework/submissions/?homework=${hw.id}&page_size=500`);
      setSubsMap(prev => ({ ...prev, [hw.id]: data.results || data }));
    } catch {
      toast.error("Failed to load submissions.");
    } finally {
      setLoadingExpand(null);
    }
  };

  const refreshSubs = async (hwId) => {
    try {
      const { data } = await api.get(`/homework/submissions/?homework=${hwId}&page_size=500`);
      setSubsMap(prev => ({ ...prev, [hwId]: data.results || data }));
    } catch {}
  };

  const handleGrade = async (subId, hwId) => {
    if (!gradeForm.score && !gradeForm.feedback) {
      toast.warn("Enter a score or feedback to save.");
      return;
    }
    setSaving(true);
    try {
      const payload = {};
      if (gradeForm.score !== "") payload.score = Number(gradeForm.score);
      if (gradeForm.feedback !== "") payload.feedback = gradeForm.feedback;
      await api.patch(`/homework/submissions/${subId}/`, payload);
      toast.success("Grade saved!");
      setGradingId(null);
      setGradeForm({ score: "", feedback: "" });
      await refreshSubs(hwId);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save grade.");
    } finally {
      setSaving(false);
    }
  };

  // ── Derived data for Phase 3 ──────────────────────────────────────────────

  const courseHomeworks = homeworks.filter(h => h.course_id === selectedCourse?.id);

  const lessonMap = courseHomeworks.reduce((acc, hw) => {
    const key = hw.lesson_order ?? 0;
    if (!acc[key]) acc[key] = { order: key, title: hw.lesson_title, homeworks: [] };
    acc[key].homeworks.push(hw);
    return acc;
  }, {});
  const lessonGroups = Object.values(lessonMap).sort((a, b) => (a.order || 0) - (b.order || 0));

  const groupStudents = selectedGroup ? (selectedGroup.students_detail || []) : [];
  const totalPending  = courseHomeworks.reduce((acc, hw) => acc + (subsMap[hw.id] || []).filter(s => s.status === "submitted").length, 0);
  const totalGraded   = courseHomeworks.reduce((acc, hw) => acc + (subsMap[hw.id] || []).filter(s => s.status === "graded").length, 0);

  const phase = !selectedCourse ? 1 : !selectedGroup ? 2 : 3;

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderHomeworkCard = (hw, hi) => {
    const subs       = subsMap[hw.id] || [];
    const isExpanded = expandedId === hw.id;
    const isLoading  = loadingExpand === hw.id;
    const due        = hw.due_date ? new Date(hw.due_date) : null;
    const isOverdue  = due && due < new Date();
    const hwSubFilter = subFilter[hw.id] || "all";

    const submitted    = subs.filter(s => s.status === "submitted").length;
    const graded       = subs.filter(s => s.status === "graded").length;
    const drafts       = subs.filter(s => s.status === "draft").length;
    const totalSubs    = subs.length;
    const enrolled     = groupStudents.length || subs.length;

    let rows = [];
    if (groupStudents.length > 0) {
      rows = groupStudents.map(stu => {
        const sub = subs.find(s => (s.student === stu.id || s.student?.id === stu.id));
        return sub
          ? { ...sub, _student: stu, _missing: false }
          : { _student: stu, _missing: true, id: `missing-${stu.id}`, status: "missing" };
      });
      subs.forEach(sub => {
        const sid = sub.student?.id ?? sub.student;
        if (!groupStudents.find(s => s.id === sid)) rows.push({ ...sub, _student: null, _missing: false });
      });
    } else {
      rows = subs.map(sub => ({ ...sub, _student: null, _missing: false }));
    }

    const missingCount = rows.filter(r => r._missing).length;

    const visibleRows = rows.filter(r => {
      if (hwSubFilter === "all")       return true;
      if (hwSubFilter === "missing")   return r._missing;
      if (hwSubFilter === "submitted") return r.status === "submitted";
      if (hwSubFilter === "graded")    return r.status === "graded";
      if (hwSubFilter === "draft")     return r.status === "draft";
      return true;
    });

    return (
      <motion.div
        key={hw.id}
        className={`ahw-card glass ${isExpanded ? "ahw-card-expanded" : ""}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: hi * 0.04 }}
      >
        <div className="ahw-card-header" onClick={() => handleExpand(hw)}>
          <div className="ahw-card-left">
            <div className="ahw-card-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div className="ahw-card-info">
              <div className="ahw-card-title">{hw.title}</div>
              <div className="ahw-card-meta">
                {due && (
                  <span className={`ahw-tag ${isOverdue ? "ahw-tag-overdue" : "ahw-tag-due"}`}>
                    Due {formatDate(hw.due_date)}
                  </span>
                )}
                <span className="ahw-tag ahw-tag-pts">{hw.total_points} pts</span>
              </div>
            </div>
          </div>

          <div className="ahw-card-right">
            {isLoading ? (
              <div className="ahw-expand-spinner" />
            ) : subsMap[hw.id] ? (
              <ProgressRing submitted={totalSubs} total={enrolled} />
            ) : null}
            <div className="ahw-card-badges">
              {submitted > 0    && <span className="ahw-badge ahw-badge-submitted">{submitted} Submitted</span>}
              {graded > 0       && <span className="ahw-badge ahw-badge-graded">{graded} Graded</span>}
              {drafts > 0       && <span className="ahw-badge ahw-badge-draft">{drafts} Draft</span>}
              {missingCount > 0 && <span className="ahw-badge ahw-badge-missing">{missingCount} Missing</span>}
            </div>
            <motion.span className="ahw-chevron" animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </motion.span>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="ahw-expand"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              {isLoading ? (
                <div className="ahw-expand-loading">
                  <div className="ahw-expand-spinner" />
                  Loading submissions...
                </div>
              ) : (
                <>
                  <div className="ahw-sub-tabs">
                    {[
                      { key: "all",       label: `All (${rows.length})` },
                      { key: "submitted", label: `Submitted (${submitted})` },
                      { key: "graded",    label: `Graded (${graded})` },
                      { key: "draft",     label: `Draft (${drafts})` },
                      { key: "missing",   label: `Missing (${missingCount})` },
                    ].map(t => (
                      <button
                        key={t.key}
                        className={`ahw-sub-tab ${hwSubFilter === t.key ? "active" : ""}`}
                        onClick={() => setSubFilter(prev => ({ ...prev, [hw.id]: t.key }))}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {visibleRows.length === 0 ? (
                    <div className="ahw-no-subs">No submissions in this category.</div>
                  ) : (
                    <div className="ahw-table-wrap">
                      <table className="ahw-table">
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Status</th>
                            <th>Score</th>
                            <th>Files</th>
                            <th>Submitted</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map((row, ri) => {
                            const stu  = row._student;
                            const name = stu
                              ? `${stu.first_name} ${stu.last_name}`.trim() || stu.username
                              : row.student_name || `Student #${row.student}`;
                            const email    = stu?.email || row.student_email || "";
                            const files    = row.uploaded_files || [];
                            const isGrading = gradingId === row.id;

                            return (
                              <motion.tr
                                key={row.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: ri * 0.03 }}
                              >
                                <td>
                                  <div className="ahw-student-cell">
                                    <Avatar profile={stu?.profile} name={name} size={34} />
                                    <div className="ahw-student-info">
                                      <span className="ahw-student-name">{name}</span>
                                      {email && <span className="ahw-student-email">{email}</span>}
                                    </div>
                                  </div>
                                </td>
                                <td><StatusPill status={row.status} /></td>
                                <td>
                                  {row._missing
                                    ? <span className="ahw-no-score">—</span>
                                    : <ScoreBar score={row.score} total={hw.total_points} />
                                  }
                                </td>
                                <td>
                                  {row._missing || files.length === 0
                                    ? <span className="ahw-no-files">No files</span>
                                    : (
                                      <div className="ahw-files">
                                        {files.map(f => (
                                          <a
                                            key={f.id}
                                            href={f.file}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ahw-file-chip"
                                            title={f.filename}
                                          >
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                            <span className="ahw-file-name">{f.filename}</span>
                                            {f.file_size > 0 && <span className="ahw-file-size">{formatBytes(f.file_size)}</span>}
                                          </a>
                                        ))}
                                      </div>
                                    )
                                  }
                                </td>
                                <td className="ahw-date-cell">
                                  {row._missing ? <span className="ahw-no-score">—</span> : formatDateTime(row.submitted_at)}
                                </td>
                                <td>
                                  {!row._missing && (
                                    isGrading ? (
                                      <div className="ahw-grade-form">
                                        <input
                                          type="number"
                                          className="ahw-grade-input"
                                          placeholder={`Score /${hw.total_points}`}
                                          min="0"
                                          max={hw.total_points}
                                          value={gradeForm.score}
                                          onChange={e => setGradeForm(p => ({ ...p, score: e.target.value }))}
                                        />
                                        <textarea
                                          className="ahw-grade-textarea"
                                          placeholder="Feedback (optional)"
                                          rows={2}
                                          value={gradeForm.feedback}
                                          onChange={e => setGradeForm(p => ({ ...p, feedback: e.target.value }))}
                                        />
                                        <div className="ahw-grade-actions">
                                          <motion.button
                                            className="ahw-btn-save"
                                            onClick={() => handleGrade(row.id, hw.id)}
                                            disabled={saving}
                                            whileTap={{ scale: 0.95 }}
                                          >
                                            {saving ? "Saving…" : "Save"}
                                          </motion.button>
                                          <motion.button
                                            className="ahw-btn-cancel"
                                            onClick={() => { setGradingId(null); setGradeForm({ score: "", feedback: "" }); }}
                                            whileTap={{ scale: 0.95 }}
                                          >
                                            Cancel
                                          </motion.button>
                                        </div>
                                      </div>
                                    ) : (
                                      <motion.button
                                        className="ahw-btn-grade"
                                        onClick={() => {
                                          setGradingId(row.id);
                                          setGradeForm({
                                            score: row.score != null ? String(row.score) : "",
                                            feedback: row.feedback || "",
                                          });
                                        }}
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.95 }}
                                      >
                                        {row.status === "graded" ? "Re-grade" : "Grade"}
                                      </motion.button>
                                    )
                                  )}
                                </td>
                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {rows.filter(r => r.feedback).length > 0 && (
                    <div className="ahw-feedback-summary">
                      <div className="ahw-feedback-title">Feedback given</div>
                      {rows.filter(r => r.feedback).map(r => {
                        const n = r._student
                          ? `${r._student.first_name} ${r._student.last_name}`.trim() || r._student.username
                          : r.student_name;
                        return (
                          <div key={r.id} className="ahw-feedback-row">
                            <span className="ahw-feedback-who">{n}</span>
                            <span className="ahw-feedback-text">{r.feedback}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <PageTransition>
      <div className="ahw-container">

        {/* Header + breadcrumb */}
        <div className="ahw-header">
          <div className="ahw-header-inner">
            {/* Breadcrumb */}
            <div className="ahw-breadcrumb">
              <span
                className={`ahw-bc-item ${phase === 1 ? "ahw-bc-active" : "ahw-bc-link"}`}
                onClick={phase > 1 ? goToRoot : undefined}
              >
                Homework Tracker
              </span>
              {selectedCourse && (
                <>
                  <span className="ahw-bc-sep">›</span>
                  <span
                    className={`ahw-bc-item ${phase === 2 ? "ahw-bc-active" : "ahw-bc-link"}`}
                    onClick={phase > 2 ? goToCourse : undefined}
                  >
                    {selectedCourse.title}
                  </span>
                </>
              )}
              {selectedGroup && (
                <>
                  <span className="ahw-bc-sep">›</span>
                  <span className="ahw-bc-item ahw-bc-active">{selectedGroup.name}</span>
                </>
              )}
            </div>

            {/* Title row */}
            <div className="ahw-title-row">
              {phase > 1 && (
                <button className="ahw-back-btn" onClick={handleBack}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Back
                </button>
              )}
              <div>
                <h1>
                  {phase === 1 && "Homework Tracker"}
                  {phase === 2 && selectedCourse.title}
                  {phase === 3 && selectedGroup.name}
                </h1>
                <p className="ahw-subtitle">
                  {phase === 1 && "Select a course category to get started"}
                  {phase === 2 && `Select a group · ${selectedCourse.title}`}
                  {phase === 3 && `${courseHomeworks.length} assignment${courseHomeworks.length !== 1 ? "s" : ""} · ${selectedCourse.title}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Phase 1: Course / category cards ── */}
        {phase === 1 && (
          loading ? (
            <div className="ahw-course-grid">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="ahw-course-card glass">
                  <div className="ahw-course-icon skeleton-box" style={{ width: 46, height: 46, borderRadius: 12 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-row" style={{ width: "65%", height: 16, borderRadius: 6 }} />
                    <div className="skeleton-row" style={{ width: "38%", height: 12, borderRadius: 6, marginTop: 7 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="ahw-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              <p>No homework assignments found</p>
            </div>
          ) : (
            <div className="ahw-course-grid">
              {courses.map((course, i) => {
                const theme = COURSE_COLORS[i % COURSE_COLORS.length];
                return (
                  <motion.div
                    key={course.id}
                    className="ahw-course-card glass"
                    style={{ "--c-color": theme.color, "--c-accent": theme.cardAccent }}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    whileHover={{ y: -4, boxShadow: "0 12px 40px rgba(0,0,0,0.13)" }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSelectCourse(course)}
                  >
                    <div className="ahw-course-icon" style={{ background: theme.iconBg, color: theme.color }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                    </div>
                    <div className="ahw-course-body">
                      <div className="ahw-course-title">{course.title}</div>
                      <div className="ahw-course-count">{course.count} homework{course.count !== 1 ? "s" : ""}</div>
                    </div>
                    <svg className="ahw-course-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </motion.div>
                );
              })}
            </div>
          )
        )}

        {/* ── Phase 2: Group cards ── */}
        {phase === 2 && (
          loadingGroups ? (
            <div className="ahw-group-grid">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="ahw-group-card glass">
                  <div className="skeleton-row" style={{ width: "55%", height: 16, borderRadius: 6 }} />
                  <div className="skeleton-row" style={{ width: "35%", height: 12, borderRadius: 6, marginTop: 7 }} />
                </div>
              ))}
            </div>
          ) : courseGroups.length === 0 ? (
            <div className="ahw-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-4-4h-4"/><circle cx="17" cy="7" r="3"/></svg>
              <p>No groups found for this course</p>
            </div>
          ) : (
            <div className="ahw-group-grid">
              {courseGroups.map((group, i) => {
                const stuCount = (group.students_detail || group.students || []).length;
                return (
                  <motion.div
                    key={group.id}
                    className="ahw-group-card glass"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    whileHover={{ y: -3, boxShadow: "0 8px 28px rgba(0,0,0,0.1)" }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSelectGroup(group)}
                  >
                    <div className="ahw-group-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-4-4h-4"/><circle cx="17" cy="7" r="3"/></svg>
                    </div>
                    <div className="ahw-group-body">
                      <div className="ahw-group-name">{group.name}</div>
                      <div className="ahw-group-count">{stuCount} student{stuCount !== 1 ? "s" : ""}</div>
                    </div>
                    <svg className="ahw-group-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </motion.div>
                );
              })}
            </div>
          )
        )}

        {/* ── Phase 3: Lesson + homework tracker ── */}
        {phase === 3 && (
          <>
            {/* Stat cards */}
            <div className="ahw-stats">
              <motion.div className="ahw-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                <div className="ahw-stat-icon" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div>
                  <div className="ahw-stat-num">{courseHomeworks.length}</div>
                  <div className="ahw-stat-label">Assignments</div>
                </div>
              </motion.div>

              <motion.div className="ahw-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
                <div className="ahw-stat-icon" style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div>
                  <div className="ahw-stat-num">{groupStudents.length}</div>
                  <div className="ahw-stat-label">Students</div>
                </div>
              </motion.div>

              <motion.div className="ahw-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                <div className="ahw-stat-icon" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div>
                  <div className="ahw-stat-num">{totalPending}</div>
                  <div className="ahw-stat-label">Pending Review</div>
                </div>
              </motion.div>

              <motion.div className="ahw-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                <div className="ahw-stat-icon" style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                </div>
                <div>
                  <div className="ahw-stat-num">{totalGraded}</div>
                  <div className="ahw-stat-label">Graded</div>
                </div>
              </motion.div>
            </div>

            {/* Homeworks grouped by lesson */}
            {lessonGroups.length === 0 ? (
              <div className="ahw-empty">
                <p>No homeworks in this course.</p>
              </div>
            ) : (
              lessonGroups.map((lg, li) => (
                <motion.div
                  key={lg.order}
                  className="ahw-lesson-section"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: li * 0.05 }}
                >
                  <div className="ahw-lesson-header">
                    <span className="ahw-lesson-num-badge">Lesson {lg.order || "—"}</span>
                    {lg.title && <span className="ahw-lesson-title-text">{lg.title}</span>}
                    <span className="ahw-lesson-hw-pill">
                      {lg.homeworks.length} hw
                    </span>
                  </div>

                  <div className="ahw-list">
                    {lg.homeworks.map((hw, hi) => renderHomeworkCard(hw, hi))}
                  </div>
                </motion.div>
              ))
            )}
          </>
        )}

      </div>
    </PageTransition>
  );
}
