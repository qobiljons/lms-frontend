import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import PageTransition from "../../components/PageTransition";
import "./Attendance.css";

const STATUS_OPTIONS = [
  { value: "attended", label: "Attended", color: "#16a34a" },
  { value: "absent", label: "Absent", color: "#ef4444" },
  { value: "attended_online", label: "Online", color: "#3b82f6" },
  { value: "late", label: "Late", color: "#f59e0b" },
  { value: "excused", label: "Excused", color: "#8b5cf6" },
];

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

function StatusBadge({ status }) {
  const option = STATUS_OPTIONS.find((item) => item.value === status);
  const color = option?.color || "#6b7280";
  const label = option?.label || String(status || "Unknown");
  return (
    <span
      className="attendance-status"
      style={{ color, background: `${color}18`, borderColor: `${color}33` }}
    >
      {label}
    </span>
  );
}

function SessionSummary({ summary, records }) {
  const fallback = (records || []).reduce((acc, rec) => {
    const key = rec.status || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const source = summary && Object.keys(summary).length ? summary : fallback;
  return (
    <div className="attendance-summary">
      {Object.entries(source).map(([key, count]) => (
        <div key={key} className="attendance-summary-item">
          <StatusBadge status={key} />
          <strong>{count}</strong>
        </div>
      ))}
    </div>
  );
}

export default function AttendanceManagePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("sessions");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [groups, setGroups] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [overview, setOverview] = useState(null);

  const [form, setForm] = useState({
    group: "",
    course: "",
    session_date: new Date().toISOString().slice(0, 10),
    note: "",
  });
  const [groupStudents, setGroupStudents] = useState([]);
  const [groupCourses, setGroupCourses] = useState([]);
  const [recordDraft, setRecordDraft] = useState({});
  const [autoAbsent, setAutoAbsent] = useState(true);

  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingSession, setEditingSession] = useState(null);

  // Filters
  const [filterGroup, setFilterGroup] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const isAdmin = user?.role === "admin";
  const groupsEndpoint = isAdmin ? "/groups/?page_size=1000" : "/groups/my/";

  // Filter sessions based on selected filters
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (filterGroup && String(session.group) !== String(filterGroup)) return false;
      if (filterCourse && String(session.course || "") !== String(filterCourse)) return false;
      if (filterDateFrom && session.session_date < filterDateFrom) return false;
      if (filterDateTo && session.session_date > filterDateTo) return false;
      return true;
    });
  }, [sessions, filterGroup, filterCourse, filterDateFrom, filterDateTo]);

  // Group sessions by date for better organization
  const sessionsByDate = useMemo(() => {
    const grouped = {};
    filteredSessions.forEach((session) => {
      const date = session.session_date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(session);
    });
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredSessions]);

  // Check for duplicate warning
  const duplicateWarning = useMemo(() => {
    if (!form.group || !form.session_date) return null;
    const existing = sessions.find(
      (s) =>
        String(s.group) === String(form.group) &&
        s.session_date === form.session_date &&
        String(s.course || "") === String(form.course || "")
    );
    if (existing) {
      return `A session already exists for this group${form.course ? "/course" : ""} on this date (Session #${existing.id})`;
    }
    const similarSessions = sessions.filter(
      (s) => String(s.group) === String(form.group) && s.session_date === form.session_date
    );
    if (similarSessions.length > 0) {
      const courses = similarSessions.map((s) => s.course_title || "General").join(", ");
      return `Note: ${similarSessions.length} other session(s) exist for this group on this date (${courses})`;
    }
    return null;
  }, [form.group, form.session_date, form.course, sessions]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsRes, sessionsRes, overviewRes] = await Promise.all([
        api.get(groupsEndpoint),
        api.get("/attendance/"),
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedGroup = useMemo(
    () => groups.find((group) => String(group.id) === String(form.group)),
    [groups, form.group]
  );

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
    } catch (err) {
      const errorMsg = getApiErrorMessage(err, "Failed to load group details");
      console.error("Error loading group details:", errorMsg);
      // Fallback to cached data if available
      if (selectedGroup) {
        setGroupStudents(selectedGroup.students_detail || []);
        setGroupCourses(selectedGroup.courses_detail || []);
      } else {
        toast.error(errorMsg);
        setGroupStudents([]);
        setGroupCourses([]);
      }
    }
  }, [selectedGroup?.courses_detail, selectedGroup?.students_detail]);

  useEffect(() => {
    loadGroupDetails(form.group);
  }, [form.group, loadGroupDetails]);

  const setStudentStatus = (studentId, status) => {
    setRecordDraft((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const buildRecordsPayload = (students, draft, shouldAutoAbsent) => {
    return students
      .map((student) => {
        const status = draft[student.id] || (shouldAutoAbsent ? "absent" : "");
        if (!status) return null;
        return { student: student.id, status };
      })
      .filter(Boolean);
  };

  const resetForm = () => {
    setRecordDraft({});
    setForm((prev) => ({ ...prev, course: "", note: "" }));
  };

  const createSession = async (event) => {
    event.preventDefault();
    if (!form.group || !form.session_date) {
      toast.error("Group and date are required.");
      return;
    }
    const records = buildRecordsPayload(groupStudents, recordDraft, autoAbsent);
    if (!records.length) {
      toast.error("Mark at least one student or enable auto-absent.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/attendance/", {
        group: Number(form.group),
        course: form.course ? Number(form.course) : null,
        session_date: form.session_date,
        note: form.note,
        records: records,
        auto_mark_absent: autoAbsent,
      });
      toast.success("Attendance session created.");
      resetForm();
      await loadData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to create attendance session."));
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = async (sessionId) => {
    try {
      const { data } = await api.get(`/attendance/${sessionId}/`);
      const records = data.records || [];
      const mapping = {};
      records.forEach((rec) => {
        const studentId = rec.student?.id || rec.student;
        if (studentId) mapping[studentId] = rec.status;
      });
      setEditingSessionId(sessionId);
      setEditingSession({
        id: sessionId,
        group: data.group?.id || data.group || "",
        course: data.course?.id || data.course || "",
        session_date: data.session_date || "",
        note: data.note || "",
        records,
      });
      setRecordDraft(mapping);
      await loadGroupDetails(data.group?.id || data.group);
    } catch {
      toast.error("Failed to load session details.");
    }
  };

  const saveEdit = async () => {
    if (!editingSession) return;
    const records = buildRecordsPayload(groupStudents, recordDraft, autoAbsent);
    if (!records.length) {
      toast.error("Mark at least one student or enable auto-absent.");
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/attendance/${editingSession.id}/`, {
        group: Number(editingSession.group),
        course: editingSession.course ? Number(editingSession.course) : null,
        session_date: editingSession.session_date,
        note: editingSession.note,
        records: records,
        auto_mark_absent: autoAbsent,
      });
      toast.success("Attendance session updated.");
      setEditingSessionId(null);
      setEditingSession(null);
      setRecordDraft({});
      await loadData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update session."));
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSession = async (sessionId) => {
    if (!window.confirm("Delete this attendance session?")) return;
    try {
      await api.delete(`/attendance/${sessionId}/`);
      toast.success("Attendance session deleted.");
      if (editingSessionId === sessionId) {
        setEditingSessionId(null);
        setEditingSession(null);
      }
      await loadData();
    } catch {
      toast.error("Failed to delete attendance session.");
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="attendance-page">
          <div className="attendance-loading">Loading attendance...</div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="attendance-page">
        <div className="attendance-header">
          <h1>Attendance Management</h1>
          <p>Create, update, and review attendance sessions.</p>
        </div>

        <div className="attendance-tabs">
          <button
            className={`attendance-tab ${activeTab === "sessions" ? "active" : ""}`}
            onClick={() => setActiveTab("sessions")}
          >
            Sessions
          </button>
          <button
            className={`attendance-tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
        </div>

        {activeTab === "sessions" ? (
          <>
            <div className="card attendance-filters">
              <h3>Filter Sessions</h3>
              <div className="attendance-grid">
                <label>
                  Group
                  <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
                    <option value="">All groups</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Course
                  <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)}>
                    <option value="">All courses</option>
                    <option value="">General (No course)</option>
                    {[...new Set(sessions.map((s) => s.course).filter(Boolean))].map((courseId) => {
                      const session = sessions.find((s) => s.course === courseId);
                      return (
                        <option key={courseId} value={courseId}>
                          {session?.course_title || `Course #${courseId}`}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label>
                  From Date
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                  />
                </label>
                <label>
                  To Date
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                  />
                </label>
              </div>
              <div style={{ marginTop: "10px", fontSize: "14px", color: "#6b7280" }}>
                Showing {filteredSessions.length} of {sessions.length} session(s)
              </div>
            </div>

            <motion.form className="attendance-form card" onSubmit={createSession} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h3>Create Session</h3>
              {duplicateWarning && (
                <div
                  className="attendance-warning"
                  style={{
                    padding: "12px",
                    background: duplicateWarning.includes("already exists") ? "#fef2f2" : "#fffbeb",
                    border: `1px solid ${duplicateWarning.includes("already exists") ? "#fecaca" : "#fde68a"}`,
                    borderRadius: "8px",
                    color: duplicateWarning.includes("already exists") ? "#991b1b" : "#92400e",
                    marginBottom: "16px",
                    fontSize: "14px",
                  }}
                >
                  ⚠️ {duplicateWarning}
                </div>
              )}
              <div className="attendance-grid">
                <label>
                  Group
                  <select
                    value={form.group}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, group: e.target.value, course: "" }));
                      setRecordDraft({});
                    }}
                    required
                  >
                    <option value="">Select group</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Course (optional)
                  <select
                    value={form.course}
                    onChange={(e) => setForm((prev) => ({ ...prev, course: e.target.value }))}
                  >
                    <option value="">No course</option>
                    {groupCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    value={form.session_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, session_date: e.target.value }))}
                    required
                  />
                </label>
                <label className="attendance-note">
                  Note
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                    placeholder="Optional note for this session"
                  />
                </label>
              </div>

              <label className="attendance-checkbox">
                <input
                  type="checkbox"
                  checked={autoAbsent}
                  onChange={(e) => setAutoAbsent(e.target.checked)}
                />
                Auto-fill unmarked students as absent
              </label>

              {groupStudents.length > 0 && (
                <div className="attendance-records">
                  <h4>Student statuses</h4>
                  {groupStudents.map((student) => (
                    <div key={student.id} className="attendance-record-row">
                      <span>{student.first_name} {student.last_name}</span>
                      <select
                        value={recordDraft[student.id] || ""}
                        onChange={(e) => setStudentStatus(student.id, e.target.value)}
                      >
                        <option value="">Unmarked</option>
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              <button className="attendance-button" type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Create Attendance Session"}
              </button>
            </motion.form>

            {editingSession && (
              <div className="card attendance-edit">
                <div className="attendance-edit-header">
                  <h3>Edit Session #{editingSession.id}</h3>
                  <button
                    className="attendance-link-button"
                    onClick={() => {
                      setEditingSessionId(null);
                      setEditingSession(null);
                    }}
                  >
                    Close
                  </button>
                </div>
                <div className="attendance-grid">
                  <label>
                    Date
                    <input
                      type="date"
                      value={editingSession.session_date}
                      onChange={(e) => setEditingSession((prev) => ({ ...prev, session_date: e.target.value }))}
                    />
                  </label>
                  <label className="attendance-note">
                    Note
                    <textarea
                      value={editingSession.note}
                      onChange={(e) => setEditingSession((prev) => ({ ...prev, note: e.target.value }))}
                    />
                  </label>
                </div>
                <div className="attendance-records">
                  {groupStudents.map((student) => (
                    <div key={student.id} className="attendance-record-row">
                      <span>{student.first_name} {student.last_name}</span>
                      <select
                        value={recordDraft[student.id] || ""}
                        onChange={(e) => setStudentStatus(student.id, e.target.value)}
                      >
                        <option value="">Unmarked</option>
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <button className="attendance-button" onClick={saveEdit} disabled={submitting}>
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}

            <div className="attendance-session-list">
              {sessionsByDate.length === 0 && (
                <div className="card" style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                  No attendance sessions found. Create one above to get started.
                </div>
              )}
              {sessionsByDate.map(([date, dateSessions]) => (
                <div key={date} className="attendance-date-group">
                  <h3 className="attendance-date-header">
                    {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                    <span style={{ fontSize: "14px", fontWeight: "normal", marginLeft: "12px", color: "#6b7280" }}>
                      {dateSessions.length} session{dateSessions.length !== 1 ? "s" : ""}
                    </span>
                  </h3>
                  {dateSessions.map((session) => (
                    <div className="card attendance-session" key={session.id}>
                      <div className="attendance-session-top">
                        <div>
                          <h4>
                            {session.group_name || session.group?.name || `Group #${session.group}`}
                            {session.course_title && (
                              <span style={{ fontWeight: "normal", color: "#6b7280", fontSize: "14px", marginLeft: "8px" }}>
                                • {session.course_title}
                              </span>
                            )}
                            {!session.course_title && (
                              <span style={{ fontWeight: "normal", color: "#9ca3af", fontSize: "14px", marginLeft: "8px" }}>
                                • General
                              </span>
                            )}
                          </h4>
                          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
                            Session #{session.id}
                            {session.taken_by_name && ` • Taken by ${session.taken_by_name}`}
                          </p>
                        </div>
                        <div className="attendance-session-actions">
                          <button className="attendance-link-button" onClick={() => startEdit(session.id)}>
                            Edit
                          </button>
                          <button className="attendance-link-button danger" onClick={() => deleteSession(session.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                      {session.note && <p className="attendance-note-text">{session.note}</p>}
                      <SessionSummary summary={session.summary?.status_breakdown} records={session.records} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="attendance-overview">
            <div className="attendance-stats">
              <div className="card">
                <span>Total sessions</span>
                <strong>{overview?.total_sessions ?? sessions.length}</strong>
              </div>
              <div className="card">
                <span>Total records</span>
                <strong>{overview?.total_records ?? 0}</strong>
              </div>
              <div className="card">
                <span>Attendance rate</span>
                <strong>{overview?.attendance_percentage ?? 0}%</strong>
              </div>
            </div>

            <div className="card">
              <h3>Status breakdown</h3>
              <SessionSummary summary={overview?.status_breakdown || {}} />
            </div>

            <div className="card">
              <h3>Group stats</h3>
              <div className="attendance-table">
                <div className="attendance-table-head">
                  <span>Group</span>
                  <span>Sessions</span>
                </div>
                {(overview?.groups || []).map((group) => (
                  <div className="attendance-table-row" key={group.group_id}>
                    <span>{group.group__name || `Group #${group.group_id}`}</span>
                    <span>{group.total_sessions ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
