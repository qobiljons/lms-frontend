import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import PageTransition from "../../components/PageTransition";
import "./Homework.css";

const FILTERS = [
  { id: "all", label: "All", color: "#6b7280" },
  { id: "pending", label: "Pending", color: "#f59e0b" },
  { id: "done", label: "Done", color: "#16a34a" },
];

const PENDING_STATUSES = new Set(["not_started", "draft"]);
const DONE_STATUSES = new Set(["submitted", "graded", "returned"]);

function statusColor(s) {
  return ({
    not_started: "#9ca3af",
    draft: "#f59e0b",
    submitted: "#3b82f6",
    graded: "#16a34a",
    returned: "#8b5cf6",
  })[s] || "#9ca3af";
}

function statusLabel(s) {
  return ({
    not_started: "Not Started",
    draft: "Draft",
    submitted: "Submitted",
    graded: "Graded",
    returned: "Returned",
  })[s] || s;
}

function relativeDue(iso) {
  if (!iso) return null;
  const now = new Date();
  const due = new Date(iso);
  const diffMs = due - now;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffMs < 0) {
    const past = Math.abs(diffDays);
    if (past === 0) return "today (overdue)";
    if (past === 1) return "yesterday";
    if (past < 7) return `${past} days ago`;
    return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays < 7) return `in ${diffDays} days`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function HomeworkListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchHw = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/homework/?page_size=200");
      const list = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
      setHomework(list);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to load homework.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHw(); }, [fetchHw]);

  const enriched = useMemo(() => homework.map((hw) => {
    const status = hw.submission_status?.status || "not_started";
    const due = hw.due_date ? new Date(hw.due_date) : null;
    const overdue = due && due < new Date() && status !== "graded" && status !== "submitted";
    return { ...hw, _status: status, _overdue: overdue };
  }), [homework]);

  const courses = useMemo(() => {
    const map = new Map();
    enriched.forEach((hw) => {
      if (hw.course_id != null && !map.has(hw.course_id)) {
        map.set(hw.course_id, { id: hw.course_id, title: hw.course_title || `Course #${hw.course_id}` });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [enriched]);

  const counts = useMemo(() => {
    const c = { all: enriched.length, pending: 0, done: 0 };
    enriched.forEach((hw) => {
      if (DONE_STATUSES.has(hw._status)) c.done++;
      else c.pending++;
    });
    return c;
  }, [enriched]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (courseFilter !== "all") list = list.filter(hw => String(hw.course_id) === String(courseFilter));
    if (filter === "pending") list = list.filter(hw => !DONE_STATUSES.has(hw._status));
    else if (filter === "done") list = list.filter(hw => DONE_STATUSES.has(hw._status));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(hw =>
        (hw.title || "").toLowerCase().includes(q) ||
        (hw.description || "").toLowerCase().includes(q) ||
        (hw.lesson_title || "").toLowerCase().includes(q) ||
        (hw.course_title || "").toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const aDone = DONE_STATUSES.has(a._status);
      const bDone = DONE_STATUSES.has(b._status);
      if (aDone && !bDone) return 1;
      if (bDone && !aDone) return -1;
      const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return ad - bd;
    });
    return list;
  }, [enriched, filter, courseFilter, search]);

  return (
    <PageTransition>
      <div className="hwl-page">
        <header className="hwl-header">
          <div>
            <h1 className="hwl-title">My Homework</h1>
            <p className="hwl-sub">
              {counts.all} assignment{counts.all !== 1 ? "s" : ""}
              {(() => {
                const overdueCount = enriched.filter((hw) => hw._overdue).length;
                return overdueCount > 0 ? <span className="hwl-overdue-badge"> · {overdueCount} overdue</span> : null;
              })()}
            </p>
          </div>
        </header>

        <div className="hwl-toolbar">
          <div className="hwl-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="text"
              placeholder="Search by title, lesson, course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="hwl-search-clear" onClick={() => setSearch("")} aria-label="Clear">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          <select
            className="hwl-course-select"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="all">All courses ({enriched.length})</option>
            {courses.map((c) => {
              const courseCount = enriched.filter(hw => hw.course_id === c.id).length;
              return (
                <option key={c.id} value={c.id}>
                  {c.title} ({courseCount})
                </option>
              );
            })}
          </select>
        </div>

        <div className="hwl-chips">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`hwl-chip ${filter === f.id ? "active" : ""}`}
              onClick={() => setFilter(f.id)}
              style={filter === f.id ? { borderColor: f.color, color: f.color, background: `${f.color}12` } : {}}
            >
              <span className="hwl-chip-dot" style={{ background: f.color }} />
              {f.label}
              <span className="hwl-chip-count">{counts[f.id] ?? 0}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="hwl-loading">
            <div className="hw-spinner" />
            <p>Loading homework...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="hwl-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            <h3>{homework.length === 0 ? "No homework yet" : "Nothing matches"}</h3>
            <p>{homework.length === 0 ? "When your instructor assigns homework, it'll appear here." : "Try clearing the filter or search."}</p>
          </div>
        ) : (
          <div className="hwl-grid">
            {filtered.map((hw) => (
              <motion.div
                key={hw.id}
                className={`hwl-card ${hw._overdue ? "hwl-card-overdue" : ""}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                whileHover={{ y: -2 }}
                onClick={() => navigate(`/homework/${hw.id}`)}
              >
                  <div className="hwl-card-top">
                    <span className="hwl-pill" style={{ background: `${statusColor(hw._status)}1a`, color: statusColor(hw._status) }}>
                      {hw._overdue ? "Overdue" : statusLabel(hw._status)}
                    </span>
                    <span className="hwl-points">{hw.total_points} pts</span>
                  </div>
                  <h2 className="hwl-card-title">{hw.title}</h2>
                  <div className="hwl-card-meta-row">
                    {hw.course_title && (
                      <span className="hwl-course-tag" onClick={(e) => { e.stopPropagation(); setCourseFilter(String(hw.course_id)); }} title={`Filter to ${hw.course_title}`}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                        {hw.course_title}
                      </span>
                    )}
                    {hw.lesson_order && (
                      <span className="hwl-lesson-num">
                        Lesson {hw.lesson_order}{hw.lesson_total ? ` / ${hw.lesson_total}` : ""}
                      </span>
                    )}
                    {hw.lesson_title && (
                      <span className="hwl-lesson">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                        {hw.lesson_title}
                      </span>
                    )}
                  </div>
                  {hw.description && <p className="hwl-desc">{hw.description}</p>}
                  <div className="hwl-card-bottom">
                    {hw.due_date ? (
                      <span className={`hwl-due ${hw._overdue ? "hwl-due-overdue" : ""}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Due {relativeDue(hw.due_date)}
                      </span>
                    ) : <span className="hwl-due hwl-due-none">No due date</span>}
                    {hw.submission_status?.score && (
                      <span className="hwl-score">
                        {hw.submission_status.score}/{hw.total_points}
                      </span>
                    )}
                  </div>
                  <div className="hwl-card-actions">
                    <Link
                      to={`/homework/${hw.id}`}
                      className="hwl-btn-upload"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      {hw._status === "not_started" ? "Start & Upload" : hw._status === "graded" ? "View Result" : "Open / Upload"}
                    </Link>
                  </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
