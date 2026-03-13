import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { getAvatarUrl, avatarErrorHandler } from "../../utils/avatar";
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

/* ──────────────────────────────────────────────
   Searchable Multi-Select with chips + filter
   ────────────────────────────────────────────── */
function SearchableMultiSelect({ items, selected, onToggle, labelFn, emptyText, placeholder, avatarFn }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((item) => labelFn(item).toLowerCase().includes(q));
  }, [items, query, labelFn]);

  const selectedItems = useMemo(
    () => items.filter((item) => selected.includes(item.id)),
    [items, selected]
  );

  const handleRemove = (id) => {
    onToggle(id);
  };

  return (
    <div className="sms-wrapper" ref={containerRef}>
      {/* Selected chips */}
      {selectedItems.length > 0 && (
        <div className="sms-chips">
          {selectedItems.map((item) => (
            <motion.span
              key={item.id}
              className="sms-chip"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.15 }}
            >
              {avatarFn && (
                <img
                  className="sms-chip-avatar"
                  src={avatarFn(item)}
                  alt=""
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              )}
              <span className="sms-chip-label">{labelFn(item)}</span>
              <button
                type="button"
                className="sms-chip-remove"
                onClick={() => handleRemove(item.id)}
                aria-label={`Remove ${labelFn(item)}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </motion.span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="sms-search">
        <svg className="sms-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="sms-search-input"
          placeholder={placeholder || "Search..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="sms-search-clear"
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        <span className="sms-count">{selected.length} selected</span>
      </div>

      {/* Options list */}
      <div className="sms-options">
        {filtered.length === 0 ? (
          <span className="sms-empty">
            {query ? `No results for "${query}"` : emptyText}
          </span>
        ) : (
          filtered.map((item) => {
            const isSelected = selected.includes(item.id);
            return (
              <label key={item.id} className={`sms-option ${isSelected ? "sms-option-selected" : ""}`}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(item.id)}
                />
                {avatarFn && (
                  <img
                    className="sms-option-avatar"
                    src={avatarFn(item)}
                    alt=""
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                )}
                <span className="sms-option-label">{labelFn(item)}</span>
                {isSelected && (
                  <svg className="sms-option-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Main Page
   ────────────────────────────────────────────── */
export default function AdminGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [nextPage, setNextPage] = useState(null);
  const [previousPage, setPreviousPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const searchTimer = useRef(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "create" ? "create" : "list";
  const setActiveTab = (tab) => setSearchParams(tab === "create" ? { tab: "create" } : {});

  // Dropdown data
  const [instructors, setInstructors] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [allCourses, setAllCourses] = useState([]);

  // Create form
  const [form, setForm] = useState({ name: "", description: "", instructor: "", students: [], courses: [] });
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", instructor: "", students: [], courses: [] });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch dropdown data on mount
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const [instrRes, studRes, courseRes] = await Promise.all([
          api.get("/auth/users/?role=instructor&page_size=1000"),
          api.get("/auth/users/?role=student&page_size=1000"),
          api.get("/courses/?page_size=1000"),
        ]);
        setInstructors(instrRes.data.results || instrRes.data);
        setAllStudents(studRes.data.results || studRes.data);
        setAllCourses(courseRes.data.results || courseRes.data);
      } catch { /* silent */ }
    };
    fetchDropdowns();
  }, []);

  const fetchGroups = useCallback(
    async (pageNum) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", pageNum);
        params.set("page_size", pageSize);
        if (search) params.set("search", search);
        const { data } = await api.get(`/groups/?${params.toString()}`);
        const list = data.results || data;
        setGroups(list);
        setTotal(data.count || list.length);
        setNextPage(data.next);
        setPreviousPage(data.previous);
        setPage(pageNum);
      } catch {
        toast.error("Failed to load groups.");
      } finally {
        setLoading(false);
      }
    },
    [search, pageSize]
  );

  useEffect(() => { fetchGroups(1); }, [fetchGroups]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setPage(1), 400);
  };

  // Create handlers
  const handleFormChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const toggleFormArray = (field, id) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(id) ? prev[field].filter((x) => x !== id) : [...prev[field], id],
    }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        instructor: form.instructor ? Number(form.instructor) : null,
        students: form.students,
        courses: form.courses,
      };
      await api.post("/groups/", payload);
      toast.success("Group created successfully!");
      setForm({ name: "", description: "", instructor: "", students: [], courses: [] });
      setActiveTab("list");
      fetchGroups(1);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const firstError = Object.values(data).flat()[0];
        toast.error(firstError || "Failed to create group.");
      } else {
        toast.error("Failed to create group.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Edit handlers
  const startEdit = async (group) => {
    try {
      const { data } = await api.get(`/groups/${group.id}/`);
      setEditingId(group.id);
      setEditForm({
        name: data.name,
        description: data.description || "",
        instructor: data.instructor || "",
        students: (data.students || []).map((s) => (typeof s === "object" ? s.id || s : s)),
        courses: (data.courses || []).map((c) => (typeof c === "object" ? c.id || c : c)),
      });
    } catch {
      toast.error("Failed to load group details.");
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: "", description: "", instructor: "", students: [], courses: [] });
  };

  const toggleEditArray = (field, id) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(id) ? prev[field].filter((x) => x !== id) : [...prev[field], id],
    }));
  };

  const handleEditSubmit = async (e, groupId) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: editForm.name,
        description: editForm.description,
        instructor: editForm.instructor ? Number(editForm.instructor) : null,
        students: editForm.students,
        courses: editForm.courses,
      };
      await api.patch(`/groups/${groupId}/`, payload);
      toast.success("Group updated!");
      cancelEdit();
      fetchGroups(page);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const firstError = Object.values(data).flat()[0];
        toast.error(firstError || "Failed to update group.");
      } else {
        toast.error("Failed to update group.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Delete handler
  const handleDelete = async (groupId) => {
    setDeleting(true);
    try {
      await api.delete(`/groups/${groupId}/`);
      toast.success("Group deleted.");
      setConfirmDeleteId(null);
      fetchGroups(page);
    } catch {
      toast.error("Failed to delete group.");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  const totalPages = Math.ceil(total / pageSize);

  // Helper to get avatar URL for a student
  const studentAvatarFn = (s) => getAvatarUrl(s.profile);
  const studentLabelFn = (s) => `${s.first_name} ${s.last_name} (@${s.username})`;
  const courseLabelFn = (c) => c.title;

  const createIcons = {
    group: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    desc: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>,
    instructor: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  };

  return (
    <PageTransition>
      <div className="admin-container">
        <div className="admin-header">
          <div>
            <h1>Group Management</h1>
            <p className="admin-subtitle">{total} group{total !== 1 ? "s" : ""} found</p>
          </div>
        </div>

        <div className="user-tabs">
          <button className={`user-tab ${activeTab === "list" ? "active" : ""}`} onClick={() => setActiveTab("list")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Groups
            {activeTab === "list" && <motion.div className="user-tab-indicator" layoutId="adminGroupTab" />}
          </button>
          <button className={`user-tab ${activeTab === "create" ? "active" : ""}`} onClick={() => setActiveTab("create")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Group
            {activeTab === "create" && <motion.div className="user-tab-indicator" layoutId="adminGroupTab" />}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "list" ? (
            <motion.div key="list" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
              <div className="user-toolbar">
                <div className="toolbar-search">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input type="text" placeholder="Search groups..." value={search} onChange={handleSearchChange} />
                  {search && (
                    <button className="toolbar-search-clear" onClick={() => setSearch("")} title="Clear search">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
                <div className="toolbar-filters">
                  <select className="toolbar-select" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                    <option value={5}>5 / page</option>
                    <option value={10}>10 / page</option>
                    <option value={20}>20 / page</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="admin-loading">
                  <motion.div className="table-skeleton glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {[...Array(4)].map((_, i) => <div className="skeleton-row" key={i} />)}
                  </motion.div>
                </div>
              ) : (
                <>
                  <motion.div className="table-card glass glow-border" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <div className="table-wrapper">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Group</th>
                            <th>Instructor</th>
                            <th>Students</th>
                            <th>Courses</th>
                            <th>Created</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          <AnimatePresence mode="wait">
                            {groups.map((group, i) =>
                              editingId === group.id ? (
                                <motion.tr key={group.id} className="editing-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                  <td colSpan={6}>
                                    <form onSubmit={(e) => handleEditSubmit(e, group.id)} className="inline-edit-form">
                                      <div className="inline-edit-fields">
                                        <div className="input-group" style={{ flex: 1 }}>
                                          <label>Name</label>
                                          <input type="text" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                                        </div>
                                        <div className="input-group" style={{ flex: 1 }}>
                                          <label>Description</label>
                                          <input type="text" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                                        </div>
                                        <div className="input-group" style={{ flex: 0.7 }}>
                                          <label>Instructor</label>
                                          <select value={editForm.instructor} onChange={(e) => setEditForm({ ...editForm, instructor: e.target.value })} style={{ padding: "0.45rem 0.65rem", borderRadius: 8, border: "1px solid rgba(0,0,0,0.12)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "0.82rem" }}>
                                            <option value="">None</option>
                                            {instructors.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name} (@{u.username})</option>)}
                                          </select>
                                        </div>
                                      </div>
                                      <div className="inline-edit-fields" style={{ marginTop: "0.75rem" }}>
                                        <div className="input-group" style={{ flex: 1 }}>
                                          <label>Students</label>
                                          <SearchableMultiSelect
                                            items={allStudents}
                                            selected={editForm.students}
                                            onToggle={(id) => toggleEditArray("students", id)}
                                            labelFn={studentLabelFn}
                                            avatarFn={studentAvatarFn}
                                            emptyText="No students available"
                                            placeholder="Search students by name..."
                                          />
                                        </div>
                                        <div className="input-group" style={{ flex: 1 }}>
                                          <label>Courses</label>
                                          <SearchableMultiSelect
                                            items={allCourses}
                                            selected={editForm.courses}
                                            onToggle={(id) => toggleEditArray("courses", id)}
                                            labelFn={courseLabelFn}
                                            emptyText="No courses available"
                                            placeholder="Search courses by title..."
                                          />
                                        </div>
                                      </div>
                                      <div className="inline-edit-actions">
                                        <motion.button type="submit" className="action-btn-primary" disabled={saving} whileTap={{ scale: 0.95 }}>{saving ? "Saving..." : "Save"}</motion.button>
                                        <motion.button type="button" className="action-btn-outline" onClick={cancelEdit} whileTap={{ scale: 0.95 }}>Cancel</motion.button>
                                      </div>
                                    </form>
                                  </td>
                                </motion.tr>
                              ) : (
                                <motion.tr key={group.id} custom={i} variants={rowVariants} initial="hidden" animate="visible" exit="exit">
                                  <td>
                                    <div className="user-cell">
                                      <div className="table-avatar" style={{ borderRadius: 8, background: "linear-gradient(135deg, #f59e0b, #fbbf24)" }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                      </div>
                                      <div className="user-cell-info">
                                        <span className="user-cell-name">{group.name}</span>
                                        {group.description && <span className="user-cell-username" style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{group.description}</span>}
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ fontSize: "0.85rem" }}>
                                    {group.instructor_name ? (
                                      <span className="role-chip role-instructor">{group.instructor_name}</span>
                                    ) : (
                                      <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>--</span>
                                    )}
                                  </td>
                                  <td><span className="role-chip role-student">{group.student_count} students</span></td>
                                  <td><span className="role-chip role-admin">{group.course_count} courses</span></td>
                                  <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{formatDate(group.created_at)}</td>
                                  <td>
                                    <div className="table-actions">
                                      <motion.button className="action-btn-ghost" onClick={() => startEdit(group)} whileTap={{ scale: 0.95 }} title="Edit">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                      </motion.button>
                                      {confirmDeleteId === group.id ? (
                                        <div className="table-actions" style={{ gap: "0.25rem" }}>
                                          <motion.button className="action-btn-danger" onClick={() => handleDelete(group.id)} disabled={deleting} whileTap={{ scale: 0.95 }}>{deleting ? "..." : "Yes"}</motion.button>
                                          <motion.button className="action-btn-outline" onClick={() => setConfirmDeleteId(null)} whileTap={{ scale: 0.95 }}>No</motion.button>
                                        </div>
                                      ) : (
                                        <motion.button className="action-btn-ghost action-btn-ghost-danger" onClick={() => setConfirmDeleteId(group.id)} whileTap={{ scale: 0.95 }} title="Delete">
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        </motion.button>
                                      )}
                                    </div>
                                  </td>
                                </motion.tr>
                              )
                            )}
                          </AnimatePresence>
                        </tbody>
                      </table>
                    </div>
                  </motion.div>

                  {totalPages > 1 && (
                    <motion.div className="pagination" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                      <div className="pagination-info">Showing {(page - 1) * pageSize + 1}--{Math.min(page * pageSize, total)} of {total}</div>
                      <div className="pagination-controls">
                        <motion.button className="page-btn" disabled={page === 1} onClick={() => fetchGroups(1)} whileTap={{ scale: 0.95 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                        </motion.button>
                        <motion.button className="page-btn" disabled={!previousPage} onClick={() => fetchGroups(page - 1)} whileTap={{ scale: 0.95 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </motion.button>
                        <div className="page-numbers">
                          {generatePageNumbers(page, totalPages).map((p, i) =>
                            p === "..." ? <span className="page-ellipsis" key={`e${i}`}>...</span> : <motion.button key={p} className={`page-num ${p === page ? "active" : ""}`} onClick={() => fetchGroups(p)} whileTap={{ scale: 0.9 }}>{p}</motion.button>
                          )}
                        </div>
                        <motion.button className="page-btn" disabled={!nextPage} onClick={() => fetchGroups(page + 1)} whileTap={{ scale: 0.95 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </motion.button>
                        <motion.button className="page-btn" disabled={page === totalPages} onClick={() => fetchGroups(totalPages)} whileTap={{ scale: 0.95 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div key="create" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="create-user-section">
              <motion.div className="create-form-card glass glow-border" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="create-form-header">
                  <h2>New Group</h2>
                  <p>Create a group to assign an instructor, students, and courses.</p>
                </div>
                <form onSubmit={handleCreateSubmit}>
                  <div className="input-row">
                    <div className="input-group">
                      <label htmlFor="group-name">Group Name</label>
                      <div className="input-wrapper">
                        {createIcons.group}
                        <input id="group-name" name="name" type="text" required placeholder="e.g. Python Batch 2026" value={form.name} onChange={handleFormChange} />
                      </div>
                    </div>
                    <div className="input-group">
                      <label htmlFor="group-instructor">Instructor</label>
                      <div className="input-wrapper">
                        {createIcons.instructor}
                        <select id="group-instructor" name="instructor" value={form.instructor} onChange={handleFormChange}>
                          <option value="">None</option>
                          {instructors.map((u) => (
                            <option key={u.id} value={u.id}>{u.first_name} {u.last_name} (@{u.username})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="input-group">
                    <label htmlFor="group-desc">Description</label>
                    <div className="input-wrapper">
                      {createIcons.desc}
                      <input id="group-desc" name="description" type="text" placeholder="Brief group description" value={form.description} onChange={handleFormChange} />
                    </div>
                  </div>

                  <div className="input-row">
                    <div className="input-group">
                      <label>Students</label>
                      <SearchableMultiSelect
                        items={allStudents}
                        selected={form.students}
                        onToggle={(id) => toggleFormArray("students", id)}
                        labelFn={studentLabelFn}
                        avatarFn={studentAvatarFn}
                        emptyText="No students available"
                        placeholder="Search students by name..."
                      />
                    </div>
                    <div className="input-group">
                      <label>Courses</label>
                      <SearchableMultiSelect
                        items={allCourses}
                        selected={form.courses}
                        onToggle={(id) => toggleFormArray("courses", id)}
                        labelFn={courseLabelFn}
                        emptyText="No courses available"
                        placeholder="Search courses by title..."
                      />
                    </div>
                  </div>

                  <motion.button type="submit" className="btn-submit" disabled={submitting} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                    {submitting ? <span className="btn-loading"><span className="btn-spinner" />Creating...</span> : "Create Group"}
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
