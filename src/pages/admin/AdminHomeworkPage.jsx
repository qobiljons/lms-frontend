import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
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
    <div
      className="ahw-avatar ahw-avatar-initials"
      style={{ width: size, height: size, background: bg }}
    >
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
      <span className="ahw-ring-label" style={{ color }}>
        {submitted}/{total}
      </span>
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
  if (b < 1048576) return `${(b/1024).toFixed(0)}KB`;
  return `${(b/1048576).toFixed(1)}MB`;
}

export default function AdminHomeworkPage() {
  const { user } = useAuth();
  const [homeworks, setHomeworks]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [courseFilter, setCourseFilter]   = useState("all");
  const [statusFilter, setStatusFilter]   = useState("all");
  const [expandedId, setExpandedId]       = useState(null);
  const [subsMap, setSubsMap]             = useState({});       // hwId -> submissions[]
  const [studentsMap, setStudentsMap]     = useState({});       // courseId -> students[]
  const [loadingExpand, setLoadingExpand] = useState(null);
  const [subFilter, setSubFilter]         = useState({});       // hwId -> "all"|"submitted"|"graded"|"missing"
  const [gradingId, setGradingId]         = useState(null);
  const [gradeForm, setGradeForm]         = useState({ score: "", feedback: "" });
  const [saving, setSaving]               = useState(false);
  const searchRef = useRef(null);

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

  const handleExpand = async (hw) => {
    if (expandedId === hw.id) { setExpandedId(null); return; }
    setExpandedId(hw.id);
    if (subsMap[hw.id]) return;
    setLoadingExpand(hw.id);
    try {
      const [subsRes, groupsRes] = await Promise.all([
        api.get(`/homework/submissions/?homework=${hw.id}&page_size=500`),
        hw.course_id ? api.get(`/groups/my/`) : Promise.resolve({ data: [] }),
      ]);
      const subs = subsRes.data.results || subsRes.data;

      const allGroups = groupsRes.data.results || groupsRes.data || [];
      const relevantGroups = allGroups.filter(g =>
        (g.courses || []).some(c => (typeof c === "object" ? c.id : c) === hw.course_id)
      );

      let students = [];
      if (relevantGroups.length > 0) {
        const detailRes = await Promise.all(
          relevantGroups.map(g => api.get(`/groups/${g.id}/`))
        );
        const seen = new Set();
        detailRes.forEach(r => {
          const detail = r.data;
          (detail.students_detail || []).forEach(s => {
            if (!seen.has(s.id)) { seen.add(s.id); students.push(s); }
          });
        });
      }

      setSubsMap(prev => ({ ...prev, [hw.id]: subs }));
      if (students.length > 0) {
        setStudentsMap(prev => ({ ...prev, [hw.course_id]: students }));
      }
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

  const courses = [...new Map(
    homeworks.filter(h => h.course_id).map(h => [h.course_id, { id: h.course_id, title: h.course_title || `Course #${h.course_id}` }])
  ).values()].sort((a, b) => a.title.localeCompare(b.title));

  const filtered = homeworks.filter(hw => {
    if (courseFilter !== "all" && String(hw.course_id) !== String(courseFilter)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(hw.title || "").toLowerCase().includes(q) && !(hw.course_title || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPendingGrading = homeworks.reduce((acc, hw) => {
    const subs = subsMap[hw.id] || [];
    return acc + subs.filter(s => s.status === "submitted").length;
  }, 0);

  const totalGraded = homeworks.reduce((acc, hw) => {
    const subs = subsMap[hw.id] || [];
    return acc + subs.filter(s => s.status === "graded").length;
  }, 0);

  return (
    <PageTransition>
      <div className="ahw-container">

        {/* Header */}
        <div className="ahw-header">
          <div>
            <h1>Homework Tracker</h1>
            <p className="ahw-subtitle">
              {filtered.length} assignment{filtered.length !== 1 ? "s" : ""}
              {courseFilter !== "all" && ` · filtered by course`}
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="ahw-stats">
          <motion.div className="ahw-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
            <div className="ahw-stat-icon" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <div className="ahw-stat-num">{homeworks.length}</div>
              <div className="ahw-stat-label">Total Homeworks</div>
            </div>
          </motion.div>

          <motion.div className="ahw-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
            <div className="ahw-stat-icon" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
              <div className="ahw-stat-num">{totalPendingGrading}</div>
              <div className="ahw-stat-label">Pending Review</div>
            </div>
          </motion.div>

          <motion.div className="ahw-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <div className="ahw-stat-icon" style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <div>
              <div className="ahw-stat-num">{totalGraded}</div>
              <div className="ahw-stat-label">Graded</div>
            </div>
          </motion.div>

          <motion.div className="ahw-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <div className="ahw-stat-icon" style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <div className="ahw-stat-num">
                {Object.values(subsMap).flat().length}
              </div>
              <div className="ahw-stat-label">Total Submissions</div>
            </div>
          </motion.div>
        </div>

        {/* Toolbar */}
        <div className="ahw-toolbar">
          <div className="ahw-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by homework or course..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="ahw-search-clear" onClick={() => setSearch("")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          <select className="ahw-select" value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
            <option value="all">All courses</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="ahw-skeleton-list">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="ahw-skeleton-card glass">
                <div className="skeleton-row" style={{ width: "60%", height: 18, borderRadius: 6 }} />
                <div className="skeleton-row" style={{ width: "35%", height: 13, borderRadius: 6, marginTop: 8 }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="ahw-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p>No homeworks found</p>
          </div>
        ) : (
          <div className="ahw-list">
            {filtered.map((hw, idx) => {
              const subs     = subsMap[hw.id] || [];
              const students = studentsMap[hw.course_id] || [];
              const enrolled = students.length || subs.length;

              const submitted  = subs.filter(s => s.status === "submitted").length;
              const graded     = subs.filter(s => s.status === "graded").length;
              const drafts     = subs.filter(s => s.status === "draft").length;
              const returned   = subs.filter(s => s.status === "returned").length;
              const totalSubs  = subs.length;

              const isExpanded = expandedId === hw.id;
              const isLoading  = loadingExpand === hw.id;
              const due        = hw.due_date ? new Date(hw.due_date) : null;
              const isOverdue  = due && due < new Date();
              const hwSubFilter = subFilter[hw.id] || "all";

              // Build the student rows (merged submissions + not-submitted students)
              let rows = [];
              if (students.length > 0) {
                // We have full student list
                rows = students.map(stu => {
                  const sub = subs.find(s => (s.student === stu.id || s.student?.id === stu.id));
                  return sub
                    ? { ...sub, _student: stu, _missing: false }
                    : { _student: stu, _missing: true, id: `missing-${stu.id}`, status: "missing" };
                });
                // Also add submissions from students not in our group list
                subs.forEach(sub => {
                  const sid = sub.student?.id ?? sub.student;
                  if (!students.find(s => s.id === sid)) rows.push({ ...sub, _student: null, _missing: false });
                });
              } else {
                rows = subs.map(sub => ({ ...sub, _student: null, _missing: false }));
              }

              const visibleRows = rows.filter(r => {
                if (hwSubFilter === "all") return true;
                if (hwSubFilter === "missing") return r._missing;
                if (hwSubFilter === "submitted") return r.status === "submitted";
                if (hwSubFilter === "graded") return r.status === "graded";
                if (hwSubFilter === "draft") return r.status === "draft";
                return true;
              });

              return (
                <motion.div
                  key={hw.id}
                  className={`ahw-card glass ${isExpanded ? "ahw-card-expanded" : ""}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.35 }}
                >
                  {/* Card header — clickable */}
                  <div className="ahw-card-header" onClick={() => handleExpand(hw)}>
                    <div className="ahw-card-left">
                      <div className="ahw-card-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                      </div>
                      <div className="ahw-card-info">
                        <div className="ahw-card-title">{hw.title}</div>
                        <div className="ahw-card-meta">
                          {hw.course_title && <span className="ahw-tag ahw-tag-course">{hw.course_title}</span>}
                          {hw.lesson_title && <span className="ahw-tag ahw-tag-lesson">{hw.lesson_title}</span>}
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

                      {/* Quick badges */}
                      <div className="ahw-card-badges">
                        {submitted > 0 && <span className="ahw-badge ahw-badge-submitted">{submitted} Submitted</span>}
                        {graded > 0   && <span className="ahw-badge ahw-badge-graded">{graded} Graded</span>}
                        {drafts > 0   && <span className="ahw-badge ahw-badge-draft">{drafts} Draft</span>}
                        {students.length > 0 && rows.filter(r => r._missing).length > 0 && (
                          <span className="ahw-badge ahw-badge-missing">
                            {rows.filter(r => r._missing).length} Missing
                          </span>
                        )}
                      </div>

                      <motion.span
                        className="ahw-chevron"
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </motion.span>
                    </div>
                  </div>

                  {/* Expanded content */}
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
                            {/* Sub-filter tabs */}
                            <div className="ahw-sub-tabs">
                              {[
                                { key: "all",       label: `All (${rows.length})` },
                                { key: "submitted", label: `Submitted (${submitted})` },
                                { key: "graded",    label: `Graded (${graded})` },
                                { key: "draft",     label: `Draft (${drafts})` },
                                ...(students.length > 0 ? [{ key: "missing", label: `Missing (${rows.filter(r => r._missing).length})` }] : []),
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

                            {/* Table */}
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
                                      const email = stu?.email || row.student_email || "";
                                      const files = row.uploaded_files || [];
                                      const isGrading = gradingId === row.id;

                                      return (
                                        <motion.tr
                                          key={row.id}
                                          initial={{ opacity: 0, x: -8 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: ri * 0.03 }}
                                        >
                                          {/* Student */}
                                          <td>
                                            <div className="ahw-student-cell">
                                              <Avatar profile={stu?.profile} name={name} size={34} />
                                              <div className="ahw-student-info">
                                                <span className="ahw-student-name">{name}</span>
                                                {email && <span className="ahw-student-email">{email}</span>}
                                              </div>
                                            </div>
                                          </td>

                                          {/* Status */}
                                          <td><StatusPill status={row.status} /></td>

                                          {/* Score */}
                                          <td>
                                            {row._missing
                                              ? <span className="ahw-no-score">—</span>
                                              : <ScoreBar score={row.score} total={hw.total_points} />
                                            }
                                          </td>

                                          {/* Files */}
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

                                          {/* Submitted date */}
                                          <td className="ahw-date-cell">
                                            {row._missing ? <span className="ahw-no-score">—</span> : formatDateTime(row.submitted_at)}
                                          </td>

                                          {/* Actions */}
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

                            {/* Feedback summary (if any graded) */}
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
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
