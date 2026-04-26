import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import PageTransition from "../../components/PageTransition";
import "./Attendance.css";

const STATUS_OPTIONS = [
  { value: "attended", label: "Present", color: "#16a34a" },
  { value: "attended_online", label: "Online", color: "#3b82f6" },
  { value: "late", label: "Late", color: "#f59e0b" },
  { value: "excused", label: "Excused", color: "#8b5cf6" },
  { value: "absent", label: "Absent", color: "#ef4444" },
];

const STATUS_BY_VALUE = STATUS_OPTIONS.reduce((acc, s) => { acc[s.value] = s; return acc; }, {});

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function getApiErrorMessage(err, fallback) {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  if (data.non_field_errors?.length) return data.non_field_errors[0];
  if (typeof data === "object") {
    const first = Object.values(data).flat?.()[0];
    if (first) return String(first);
  }
  return fallback;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00"));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function monthName(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00"));
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long" });
}

function StatusPill({ status, onChange, editable = false }) {
  const [open, setOpen] = useState(false);
  const opt = STATUS_BY_VALUE[status];
  const color = opt?.color || "#6b7280";
  const label = opt?.label || status || "—";

  if (!editable) {
    return (
      <span className="jf-pill" style={{ background: `${color}1c`, color }}>{label}</span>
    );
  }

  return (
    <div className="jf-pill-wrap">
      <button className="jf-pill jf-pill-editable" style={{ background: `${color}1c`, color }} onClick={() => setOpen(!open)}>
        {label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <>
          <div className="jf-pill-backdrop" onClick={() => setOpen(false)} />
          <div className="jf-pill-menu">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                className="jf-pill-option"
                style={{ "--opt-color": s.color }}
                onClick={() => { onChange?.(s.value); setOpen(false); }}
              >
                <span className="jf-pill-dot" style={{ background: s.color }} />
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MonthPill({ value }) {
  if (!value) return <span className="jf-secondary">—</span>;
  return <span className="jf-month-pill">{value}</span>;
}

function SessionSummaryBar({ records }) {
  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s.value] = (records || []).filter(r => r.status === s.value).length;
    return acc;
  }, {});
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return (
    <div className="jf-summary-bar">
      <div className="jf-summary-track">
        {STATUS_OPTIONS.map((s) => {
          const v = counts[s.value];
          if (!v) return null;
          const pct = (v / total) * 100;
          return (
            <div key={s.value} className="jf-summary-seg" style={{ width: `${pct}%`, background: s.color }} title={`${s.label}: ${v}`} />
          );
        })}
      </div>
      <div className="jf-summary-counts">
        {STATUS_OPTIONS.filter(s => counts[s.value] > 0).map((s) => (
          <span key={s.value} className="jf-summary-count">
            <span className="jf-pill-dot" style={{ background: s.color }} />
            <strong style={{ color: s.color }}>{counts[s.value]}</strong>
            <span className="jf-secondary">{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = "Delete", danger = true }) {
  if (!open) return null;
  return (
    <>
      <div className="jf-modal-backdrop" onClick={onCancel} />
      <motion.div
        className="jf-modal jf-modal-sm"
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        <h3 className="jf-modal-title">{title}</h3>
        <p className="jf-modal-msg">{message}</p>
        <div className="jf-modal-actions">
          <button className="jf-btn jf-btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={`jf-btn ${danger ? "jf-btn-danger" : "jf-btn-primary"}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </motion.div>
    </>
  );
}

function SessionDrawer({ open, mode, session, groups, groupStudents, groupCourses, recordDraft, autoAbsent, onAutoAbsentChange, onClose, onSubmit, onLoadGroup, onSetStudentStatus, submitting, duplicateWarning }) {
  const [form, setForm] = useState({
    group: "",
    course: "",
    session_date: new Date().toISOString().slice(0, 10),
    note: "",
  });

  useEffect(() => {
    if (mode === "edit" && session) {
      setForm({
        group: String(session.group?.id || session.group || ""),
        course: String(session.course?.id || session.course || ""),
        session_date: session.session_date || "",
        note: session.note || "",
      });
    } else if (mode === "create") {
      setForm({ group: "", course: "", session_date: new Date().toISOString().slice(0, 10), note: "" });
    }
  }, [mode, session, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  if (!open) return null;
  return (
    <>
      <div className="jf-drawer-backdrop" onClick={onClose} />
      <motion.div
        className="jf-drawer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 220 }}
      >
        <div className="jf-drawer-head">
          <div>
            <span className="jf-drawer-eyebrow">{mode === "edit" ? "Edit Session" : "New Session"}</span>
            <h2 className="jf-drawer-title">{mode === "edit" ? `Session #${session?.id}` : "Take Attendance"}</h2>
          </div>
          <button className="jf-icon-btn" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form className="jf-drawer-body" onSubmit={handleSubmit}>
          {duplicateWarning && (
            <div className={`jf-alert ${duplicateWarning.includes("already exists") ? "jf-alert-error" : "jf-alert-warn"}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              {duplicateWarning}
            </div>
          )}

          <div className="jf-field-row">
            <label className="jf-field">
              <span className="jf-field-label">Group <span className="jf-required">*</span></span>
              <select
                className="jf-input"
                value={form.group}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, group: e.target.value, course: "" }));
                  onLoadGroup(e.target.value);
                }}
                required
                disabled={mode === "edit"}
              >
                <option value="">Select group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </label>

            <label className="jf-field">
              <span className="jf-field-label">Course</span>
              <select className="jf-input" value={form.course} onChange={(e) => setForm((p) => ({ ...p, course: e.target.value }))}>
                <option value="">No course</option>
                {groupCourses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </label>

            <label className="jf-field">
              <span className="jf-field-label">Date <span className="jf-required">*</span></span>
              <input
                type="date"
                className="jf-input"
                value={form.session_date}
                onChange={(e) => setForm((p) => ({ ...p, session_date: e.target.value }))}
                required
              />
            </label>
          </div>

          <label className="jf-field">
            <span className="jf-field-label">Note</span>
            <textarea
              className="jf-input jf-textarea"
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              placeholder="Optional note for this session..."
              rows={2}
            />
          </label>

          <label className="jf-checkbox">
            <input
              type="checkbox"
              checked={autoAbsent}
              onChange={(e) => onAutoAbsentChange(e.target.checked)}
            />
            <span>Auto-mark unset students as absent</span>
          </label>

          {groupStudents.length > 0 ? (
            <div className="jf-students">
              <div className="jf-students-head">
                <span>Students ({groupStudents.length})</span>
                <div className="jf-quick-set">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      className="jf-quick-btn"
                      style={{ color: s.color, borderColor: `${s.color}40` }}
                      onClick={() => groupStudents.forEach(st => onSetStudentStatus(st.id, s.value))}
                      title={`Mark all as ${s.label}`}
                    >
                      All {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="jf-student-list">
                {groupStudents.map((student) => {
                  const cur = recordDraft[student.id];
                  return (
                    <div key={student.id} className="jf-student-row">
                      <div className="jf-student-info">
                        <div className="jf-avatar">{(student.first_name?.[0] || student.username?.[0] || "?").toUpperCase()}</div>
                        <div>
                          <div className="jf-student-name">{student.first_name} {student.last_name}</div>
                          <div className="jf-student-meta">@{student.username}</div>
                        </div>
                      </div>
                      <div className="jf-status-picker">
                        {STATUS_OPTIONS.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            className={`jf-status-chip ${cur === s.value ? "active" : ""}`}
                            onClick={() => onSetStudentStatus(student.id, s.value)}
                            style={cur === s.value ? { background: s.color, color: "#fff", borderColor: s.color } : { color: s.color, borderColor: `${s.color}33` }}
                            title={s.label}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            form.group ? (
              <div className="jf-empty-inline">No students in this group yet.</div>
            ) : (
              <div className="jf-empty-inline">Select a group to mark attendance.</div>
            )
          )}

          <div className="jf-drawer-foot">
            <button type="button" className="jf-btn jf-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="jf-btn jf-btn-primary" disabled={submitting}>
              {submitting ? (mode === "edit" ? "Saving..." : "Creating...") : (mode === "edit" ? "Save Changes" : "Create Session")}
            </button>
          </div>
        </form>
      </motion.div>
    </>
  );
}

export default function AttendanceManagePage() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState("table");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [groups, setGroups] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [overview, setOverview] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState("create");
  const [editingSession, setEditingSession] = useState(null);
  const [groupStudents, setGroupStudents] = useState([]);
  const [groupCourses, setGroupCourses] = useState([]);
  const [recordDraft, setRecordDraft] = useState({});
  const [autoAbsent, setAutoAbsent] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filterGroup, setFilterGroup] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [sortKey, setSortKey] = useState("session_date");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [expanded, setExpanded] = useState(new Set());
  const [selected, setSelected] = useState(new Set());
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);

  const isAdmin = user?.role === "admin";
  const groupsEndpoint = isAdmin ? "/groups/?page_size=1000" : "/groups/my/";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsRes, sessionsRes, overviewRes] = await Promise.all([
        api.get(groupsEndpoint),
        api.get("/attendance/?page_size=1000"),
        api.get("/attendance/overview/"),
      ]);
      setGroups(normalizeList(groupsRes.data));
      setSessions(normalizeList(sessionsRes.data));
      setOverview(overviewRes.data || null);
    } catch {
      toast.error("Failed to load attendance data.");
    } finally {
      setLoading(false);
    }
  }, [groupsEndpoint]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadGroupDetails = useCallback(async (groupId) => {
    if (!groupId) {
      setGroupStudents([]);
      setGroupCourses([]);
      return;
    }
    try {
      const { data } = await api.get(`/groups/${groupId}/`);
      setGroupStudents(data.students_detail || []);
      setGroupCourses(data.courses_detail || []);
    } catch {
      const g = groups.find(x => String(x.id) === String(groupId));
      setGroupStudents(g?.students_detail || []);
      setGroupCourses(g?.courses_detail || []);
    }
  }, [groups]);

  const availableMonths = useMemo(() => {
    const set = new Set();
    sessions.forEach(s => set.add(monthName(s.session_date)));
    return Array.from(set).filter(Boolean);
  }, [sessions]);

  const flatRecords = useMemo(() => {
    const out = [];
    sessions.forEach((s) => {
      const sessionMonth = monthName(s.session_date);
      const sessionGroup = s.group_name || s.group?.name || `Group #${s.group}`;
      const sessionCourse = s.course_title || s.course?.title || "General";
      (s.records || []).forEach((r) => {

        const detail = r.student_detail || (typeof r.student === "object" ? r.student : null) || {};
        const studentId = detail.id ?? (typeof r.student === "number" || typeof r.student === "string" ? r.student : null);
        const fullName = `${detail.first_name || ""} ${detail.last_name || ""}`.trim();
        out.push({
          recordId: r.id,
          sessionId: s.id,
          studentId,
          sessionDate: s.session_date,
          sessionDateDisplay: formatDate(s.session_date),
          studentName: fullName || detail.username || (studentId != null ? `Student #${studentId}` : "Unknown"),
          studentUsername: detail.username || "",
          group: sessionGroup,
          groupId: s.group?.id || s.group,
          course: sessionCourse,
          status: r.status,
          note: s.note || "",
          month: sessionMonth,
          taken_by: s.taken_by_name || "",
        });
      });
    });
    return out;
  }, [sessions]);

  const filtered = useMemo(() => {
    return flatRecords.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (filterGroup && String(r.groupId) !== String(filterGroup)) return false;
      if (filterMonth && r.month !== filterMonth) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.studentUsername.toLowerCase().includes(q) ||
        r.group.toLowerCase().includes(q) ||
        r.course.toLowerCase().includes(q) ||
        r.month.toLowerCase().includes(q) ||
        r.sessionDateDisplay.toLowerCase().includes(q) ||
        (r.note || "").toLowerCase().includes(q)
      );
    });
  }, [flatRecords, search, statusFilter, filterGroup, filterMonth]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (sortKey === "session_date" || sortKey === "sessionDate") {
        av = a.sessionDate;
        bv = b.sessionDate;
      }
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const counts = useMemo(() => {
    const out = { all: flatRecords.length };
    STATUS_OPTIONS.forEach((s) => {
      out[s.value] = flatRecords.filter((r) => r.status === s.value).length;
    });
    return out;
  }, [flatRecords]);

  const overallRate = useMemo(() => {
    const tot = flatRecords.length;
    if (tot === 0) return 0;
    const present = flatRecords.filter(r => ["attended", "attended_online", "late"].includes(r.status)).length;
    return Math.round((present / tot) * 1000) / 10;
  }, [flatRecords]);

  const sessionsById = useMemo(() => {
    const m = new Map();
    sessions.forEach(s => m.set(s.id, s));
    return m;
  }, [sessions]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const toggleSelectAll = () => {
    if (selected.size === pageRows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pageRows.map(r => `${r.sessionId}-${r.recordId}`)));
    }
  };

  const toggleSelect = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const selectedSessionIds = useMemo(() => {
    const ids = new Set();
    selected.forEach(key => {
      const [sid] = key.split("-");
      ids.add(Number(sid));
    });
    return Array.from(ids);
  }, [selected]);

  const openCreate = () => {
    setDrawerMode("create");
    setEditingSession(null);
    setRecordDraft({});
    setGroupStudents([]);
    setGroupCourses([]);
    setDrawerOpen(true);
  };

  const openEdit = async (sessionId) => {
    try {
      const { data } = await api.get(`/attendance/${sessionId}/`);
      const records = data.records || [];
      const mapping = {};
      records.forEach((rec) => {
        const studentId = rec.student?.id || rec.student;
        if (studentId) mapping[studentId] = rec.status;
      });
      setRecordDraft(mapping);
      setEditingSession({ ...data, records });
      setDrawerMode("edit");
      await loadGroupDetails(data.group?.id || data.group);
      setDrawerOpen(true);
    } catch {
      toast.error("Failed to load session details.");
    }
  };

  const setStudentStatus = (studentId, status) => {
    setRecordDraft((prev) => ({ ...prev, [studentId]: status }));
  };

  const buildRecords = () => {
    return groupStudents
      .map((student) => {
        const status = recordDraft[student.id] || (autoAbsent ? "absent" : "");
        if (!status) return null;
        return { student: student.id, status };
      })
      .filter(Boolean);
  };

  const handleSubmit = async (form) => {
    if (!form.group || !form.session_date) {
      toast.error("Group and date are required.");
      return;
    }
    const records = buildRecords();
    if (!records.length) {
      toast.error("Mark at least one student or enable auto-absent.");
      return;
    }
    setSubmitting(true);
    try {
      if (drawerMode === "edit" && editingSession) {
        await api.patch(`/attendance/${editingSession.id}/`, {
          group: Number(form.group),
          course: form.course ? Number(form.course) : null,
          session_date: form.session_date,
          note: form.note,
          records,
          auto_mark_absent: autoAbsent,
        });
        toast.success("Session updated.");
      } else {
        await api.post("/attendance/", {
          group: Number(form.group),
          course: form.course ? Number(form.course) : null,
          session_date: form.session_date,
          note: form.note,
          records,
          auto_mark_absent: autoAbsent,
        });
        toast.success("Session created.");
      }
      setDrawerOpen(false);
      setRecordDraft({});
      setEditingSession(null);
      await loadData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save session."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleInlineStatusChange = async (row, newStatus) => {
    const session = sessionsById.get(row.sessionId);
    if (!session) return;
    const updatedRecords = (session.records || []).map((r) => {
      const detail = r.student_detail || (typeof r.student === "object" ? r.student : null) || {};
      const sid = detail.id ?? (typeof r.student === "number" || typeof r.student === "string" ? r.student : null);
      const status = r.id === row.recordId ? newStatus : r.status;
      return { student: sid, status };
    }).filter(rec => rec.student != null);
    try {
      await api.patch(`/attendance/${row.sessionId}/`, {
        group: session.group?.id || session.group,
        course: session.course?.id || session.course || null,
        session_date: session.session_date,
        note: session.note || "",
        records: updatedRecords,
        auto_mark_absent: false,
      });
      toast.success("Status updated.");
      await loadData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update status."));
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await api.delete(`/attendance/${sessionId}/`);
      toast.success("Session deleted.");
      setPendingDelete(null);
      await loadData();
    } catch {
      toast.error("Failed to delete session.");
    }
  };

  const handleBulkDelete = async () => {
    setPendingBulkDelete(false);
    let success = 0;
    let fail = 0;
    for (const sid of selectedSessionIds) {
      try {
        await api.delete(`/attendance/${sid}/`);
        success++;
      } catch {
        fail++;
      }
    }
    if (success > 0) toast.success(`${success} session(s) deleted.`);
    if (fail > 0) toast.error(`${fail} session(s) failed to delete.`);
    setSelected(new Set());
    await loadData();
  };

  const exportCsv = () => {
    const headers = ["Date", "Student", "Username", "Group", "Course", "Status", "Month", "Note"];
    const rows = sorted.map(r => [
      r.sessionDate, r.studentName, r.studentUsername, r.group, r.course,
      STATUS_BY_VALUE[r.status]?.label || r.status, r.month, (r.note || "").replace(/[\r\n,]/g, " "),
    ]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Duplicate detection for create flow (used inside drawer)
  const duplicateWarning = useMemo(() => {
    if (drawerMode !== "create" || !drawerOpen) return null;
    return null;
  }, [drawerMode, drawerOpen]);

  // Charts data
  const chartTrend = useMemo(() => {
    const byDate = new Map();
    flatRecords.forEach(r => {
      const cur = byDate.get(r.sessionDate) || { date: r.sessionDate, present: 0, absent: 0, total: 0 };
      cur.total++;
      if (["attended", "attended_online", "late"].includes(r.status)) cur.present++;
      else if (r.status === "absent") cur.absent++;
      byDate.set(r.sessionDate, cur);
    });
    return Array.from(byDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)
      .map(d => ({
        date: formatDate(d.date).split(",")[1]?.trim() || d.date,
        rate: d.total > 0 ? Math.round((d.present / d.total) * 1000) / 10 : 0,
        present: d.present,
        absent: d.absent,
        total: d.total,
      }));
  }, [flatRecords]);

  const statusPieData = useMemo(() => {
    return STATUS_OPTIONS
      .map(s => ({ name: s.label, value: counts[s.value] || 0, color: s.color }))
      .filter(d => d.value > 0);
  }, [counts]);

  const groupBarData = useMemo(() => {
    const byGroup = new Map();
    flatRecords.forEach(r => {
      const cur = byGroup.get(r.group) || { name: r.group, present: 0, total: 0 };
      cur.total++;
      if (["attended", "attended_online", "late"].includes(r.status)) cur.present++;
      byGroup.set(r.group, cur);
    });
    return Array.from(byGroup.values())
      .map(g => ({ ...g, rate: g.total > 0 ? Math.round((g.present / g.total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10);
  }, [flatRecords]);

  const allFiltered = useMemo(() => sorted, [sorted]);
  const allOnPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(`${r.sessionId}-${r.recordId}`));

  if (loading) {
    return (
      <PageTransition>
        <div className="jf-page">
          <div className="jf-loading">
            <div className="jf-spinner" />
            <span>Loading attendance...</span>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="jf-page">
        {/* TOP BAR */}
        <div className="jf-topbar">
          <div className="jf-topbar-left">
            <div className="jf-brand">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              <span>Attendance</span>
            </div>
            <span className="jf-divider">/</span>
            <span className="jf-crumb">Records</span>
          </div>
          <div className="jf-topbar-center">
            <h1 className="jf-page-title">Attendance Management</h1>
            <span className="jf-page-sub">{flatRecords.length.toLocaleString()} records · {sessions.length} sessions · {overallRate}% rate</span>
          </div>
          <div className="jf-topbar-right">
            <button className="jf-btn jf-btn-ghost jf-btn-sm" onClick={exportCsv} title="Export filtered results to CSV">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
            {(isAdmin || user?.role === "instructor") && (
              <button className="jf-btn jf-btn-primary jf-btn-sm" onClick={openCreate}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Session
              </button>
            )}
          </div>
        </div>

        {/* VIEW TABS */}
        <div className="jf-view-tabs">
          <button
            className={`jf-view-tab ${activeView === "table" ? "active" : ""}`}
            onClick={() => setActiveView("table")}
            style={activeView === "table" ? { background: "#16a34a", color: "#fff" } : {}}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            {flatRecords.length > 0 ? `Records (${flatRecords.length})` : "Records"}
          </button>
          <button
            className={`jf-view-tab jf-view-tab-purple ${activeView === "charts" ? "active" : ""}`}
            onClick={() => setActiveView("charts")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Analytics
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeView === "table" && (
            <motion.div key="table" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {/* TOOLBAR */}
              <div className="jf-toolbar">
                <div className="jf-search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input
                    type="text"
                    placeholder="Search by student, group, course, month..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                  {search && (
                    <button className="jf-search-clear" onClick={() => setSearch("")} aria-label="Clear">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>

                <div className="jf-filter-controls">
                  <select className="jf-filter-select" value={filterGroup} onChange={(e) => { setFilterGroup(e.target.value); setPage(1); }}>
                    <option value="">All Groups</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <select className="jf-filter-select" value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setPage(1); }}>
                    <option value="">All Months</option>
                    {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="jf-chips">
                {[{ id: "all", label: "All", color: "#6b7280" }, ...STATUS_OPTIONS.map(s => ({ id: s.value, label: s.label, color: s.color }))].map((f) => (
                  <button
                    key={f.id}
                    className={`jf-chip ${statusFilter === f.id ? "active" : ""}`}
                    onClick={() => { setStatusFilter(f.id); setPage(1); }}
                    style={statusFilter === f.id ? { borderColor: f.color, color: f.color, background: `${f.color}12` } : {}}
                  >
                    {f.id !== "all" && <span className="jf-chip-dot" style={{ background: f.color }} />}
                    {f.label}
                    <span className="jf-chip-count">{counts[f.id] ?? 0}</span>
                  </button>
                ))}
              </div>

              {/* BULK ACTION BAR */}
              <AnimatePresence>
                {selected.size > 0 && (
                  <motion.div className="jf-bulk-bar" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <span><strong>{selected.size}</strong> selected · {selectedSessionIds.length} unique session(s)</span>
                    <div className="jf-bulk-actions">
                      <button className="jf-btn jf-btn-ghost jf-btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
                      {(isAdmin || user?.role === "instructor") && (
                        <button className="jf-btn jf-btn-danger jf-btn-sm" onClick={() => setPendingBulkDelete(true)}>
                          Delete Sessions
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* TABLE */}
              {sorted.length === 0 ? (
                <div className="jf-empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <h3>{flatRecords.length === 0 ? "No attendance records yet" : "No records match your filters"}</h3>
                  <p>{flatRecords.length === 0 ? "Create your first attendance session to get started." : "Try adjusting the search or filters above."}</p>
                  {flatRecords.length === 0 && (isAdmin || user?.role === "instructor") && (
                    <button className="jf-btn jf-btn-primary" onClick={openCreate}>+ Create First Session</button>
                  )}
                </div>
              ) : (
                <>
                  <div className="jf-table-wrap">
                    <table className="jf-table">
                      <thead>
                        <tr>
                          <th className="jf-th-check">
                            <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} />
                          </th>
                          <th className="jf-th-num">#</th>
                          <th className="jf-th sortable" onClick={() => toggleSort("session_date")}>
                            <span className="jf-th-inner">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                              Date {sortKey === "session_date" && <span className="jf-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>}
                            </span>
                          </th>
                          <th className="jf-th sortable" onClick={() => toggleSort("studentName")}>
                            <span className="jf-th-inner">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                              Student Name {sortKey === "studentName" && <span className="jf-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>}
                            </span>
                          </th>
                          <th className="jf-th sortable" onClick={() => toggleSort("status")}>
                            <span className="jf-th-inner">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 13.41 20.59a2 2 0 0 1-2.82 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                              Status {sortKey === "status" && <span className="jf-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>}
                            </span>
                          </th>
                          <th className="jf-th sortable" onClick={() => toggleSort("group")}>
                            <span className="jf-th-inner">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-4-4h-4"/><circle cx="17" cy="7" r="3"/></svg>
                              Group {sortKey === "group" && <span className="jf-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>}
                            </span>
                          </th>
                          <th className="jf-th">
                            <span className="jf-th-inner">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                              Note
                            </span>
                          </th>
                          <th className="jf-th sortable" onClick={() => toggleSort("month")}>
                            <span className="jf-th-inner">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 13.41 20.59a2 2 0 0 1-2.82 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/></svg>
                              Month {sortKey === "month" && <span className="jf-arrow">{sortDir === "asc" ? "▲" : "▼"}</span>}
                            </span>
                          </th>
                          <th className="jf-th-actions"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row, i) => {
                          const key = `${row.sessionId}-${row.recordId}`;
                          const idx = (safePage - 1) * pageSize + i + 1;
                          const isSel = selected.has(key);
                          const canManage = (isAdmin || user?.role === "instructor");
                          return (
                            <motion.tr
                              key={key}
                              className={isSel ? "selected" : ""}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: Math.min(i * 0.015, 0.25) }}
                            >
                              <td className="jf-td-check">
                                <input type="checkbox" checked={isSel} onChange={() => toggleSelect(key)} />
                              </td>
                              <td className="jf-td-num">{idx}</td>
                              <td>
                                <div className="jf-cell-date">{row.sessionDateDisplay}</div>
                              </td>
                              <td>
                                <div className="jf-cell-student">
                                  <div className="jf-avatar jf-avatar-sm">{(row.studentName?.[0] || "?").toUpperCase()}</div>
                                  <div>
                                    <div className="jf-primary">{row.studentName}</div>
                                    {row.studentUsername && <div className="jf-secondary">@{row.studentUsername}</div>}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <StatusPill
                                  status={row.status}
                                  editable={canManage}
                                  onChange={(s) => handleInlineStatusChange(row, s)}
                                />
                              </td>
                              <td>
                                <div>
                                  <div className="jf-primary">{row.group}</div>
                                  {row.course && row.course !== "General" && <div className="jf-secondary">{row.course}</div>}
                                </div>
                              </td>
                              <td>
                                {row.note ? (
                                  <span className="jf-note-cell" title={row.note}>{row.note}</span>
                                ) : <span className="jf-secondary">—</span>}
                              </td>
                              <td>
                                <MonthPill value={row.month} />
                              </td>
                              <td className="jf-td-actions">
                                {canManage && (
                                  <div className="jf-row-actions">
                                    <button className="jf-icon-btn-sm" title="Edit session" onClick={() => openEdit(row.sessionId)}>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    </button>
                                    <button className="jf-icon-btn-sm jf-icon-btn-danger" title="Delete session" onClick={() => setPendingDelete(row.sessionId)}>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    </button>
                                  </div>
                                )}
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="jf-pagination">
                      <span className="jf-page-info">
                        Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
                      </span>
                      <div className="jf-page-controls">
                        <button className="jf-btn jf-btn-ghost jf-btn-sm" disabled={safePage === 1} onClick={() => setPage(1)}>«</button>
                        <button className="jf-btn jf-btn-ghost jf-btn-sm" disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹ Prev</button>
                        <span className="jf-page-current">{safePage} / {totalPages}</span>
                        <button className="jf-btn jf-btn-ghost jf-btn-sm" disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next ›</button>
                        <button className="jf-btn jf-btn-ghost jf-btn-sm" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>»</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {activeView === "charts" && (
            <motion.div key="charts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="jf-charts">
              {/* Summary strip */}
              <div className="jf-charts-summary">
                <div className="jf-stat">
                  <span className="jf-stat-label">Total Records</span>
                  <span className="jf-stat-value">{flatRecords.length.toLocaleString()}</span>
                </div>
                <div className="jf-stat">
                  <span className="jf-stat-label">Sessions</span>
                  <span className="jf-stat-value">{sessions.length.toLocaleString()}</span>
                </div>
                <div className="jf-stat">
                  <span className="jf-stat-label">Attendance Rate</span>
                  <span className="jf-stat-value" style={{ color: overallRate >= 80 ? "#16a34a" : overallRate >= 60 ? "#f59e0b" : "#ef4444" }}>{overallRate}%</span>
                </div>
                <div className="jf-stat">
                  <span className="jf-stat-label">Active Groups</span>
                  <span className="jf-stat-value">{new Set(flatRecords.map(r => r.group)).size}</span>
                </div>
              </div>

              <div className="jf-card">
                <h3 className="jf-card-title">Attendance Rate Trend (Last 30 sessions)</h3>
                {chartTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartTrend} margin={{ top: 10, right: 15, left: -5, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gJfRate" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                      <Tooltip />
                      <Area type="monotone" dataKey="rate" name="Rate" stroke="#14b8a6" strokeWidth={2.5} fill="url(#gJfRate)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div className="jf-empty-inline">No data yet.</div>}
              </div>

              <div className="jf-charts-grid">
                <div className="jf-card">
                  <h3 className="jf-card-title">Status Distribution</h3>
                  {statusPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={statusPieData} cx="50%" cy="50%" outerRadius={95} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} stroke="#fff" strokeWidth={2}>
                          {statusPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="jf-empty-inline">No data yet.</div>}
                </div>

                <div className="jf-card">
                  <h3 className="jf-card-title">Group Attendance Rate</h3>
                  {groupBarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={Math.max(50 * groupBarData.length + 40, 260)}>
                      <BarChart data={groupBarData} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={110} />
                        <Tooltip />
                        <Bar dataKey="rate" radius={[0, 6, 6, 0]} barSize={22} label={{ position: "right", fill: "#6b7280", fontSize: 11, fontWeight: 700, formatter: (v) => `${v}%` }}>
                          {groupBarData.map((g, i) => (
                            <Cell key={i} fill={g.rate >= 80 ? "#16a34a" : g.rate >= 60 ? "#f59e0b" : "#ef4444"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="jf-empty-inline">No data yet.</div>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* DRAWER */}
        <AnimatePresence>
          {drawerOpen && (
            <SessionDrawer
              open={drawerOpen}
              mode={drawerMode}
              session={editingSession}
              groups={groups}
              groupStudents={groupStudents}
              groupCourses={groupCourses}
              recordDraft={recordDraft}
              autoAbsent={autoAbsent}
              onAutoAbsentChange={setAutoAbsent}
              onClose={() => { setDrawerOpen(false); setEditingSession(null); setRecordDraft({}); }}
              onSubmit={handleSubmit}
              onLoadGroup={loadGroupDetails}
              onSetStudentStatus={setStudentStatus}
              submitting={submitting}
              duplicateWarning={duplicateWarning}
            />
          )}
        </AnimatePresence>

        <ConfirmDialog
          open={pendingDelete !== null}
          title="Delete this attendance session?"
          message="This will permanently remove the session and all its student records. This cannot be undone."
          confirmLabel="Delete Session"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => handleDeleteSession(pendingDelete)}
        />

        <ConfirmDialog
          open={pendingBulkDelete}
          title={`Delete ${selectedSessionIds.length} session(s)?`}
          message="This will permanently remove the selected sessions and all their student records. This cannot be undone."
          confirmLabel={`Delete ${selectedSessionIds.length} Session${selectedSessionIds.length !== 1 ? "s" : ""}`}
          onCancel={() => setPendingBulkDelete(false)}
          onConfirm={handleBulkDelete}
        />
      </div>
    </PageTransition>
  );
}
