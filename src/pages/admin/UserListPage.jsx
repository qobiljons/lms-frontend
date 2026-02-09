import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { getAvatarUrl, avatarErrorHandler } from "../../utils/avatar";
import PageTransition from "../../components/PageTransition";
import "./Admin.css";

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

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } },
};

export default function UserListPage() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const navigate = useNavigate();

  const fetchUsers = async (pageNum) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/auth/users/?page=${pageNum}&page_size=8`);
      setUsers(data.results);
      setTotal(data.count);
      setNext(data.next);
      setPrevious(data.previous);
      setPage(pageNum);
    } catch {
      toast.error("Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1);
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    if (!sortKey) return 0;
    let aVal, bVal;
    if (sortKey === "name") {
      aVal = `${a.first_name} ${a.last_name}`.toLowerCase();
      bVal = `${b.first_name} ${b.last_name}`.toLowerCase();
    } else if (sortKey === "email") {
      aVal = a.email.toLowerCase();
      bVal = b.email.toLowerCase();
    } else if (sortKey === "role") {
      aVal = a.role;
      bVal = b.role;
    } else if (sortKey === "status") {
      aVal = a.is_active ? 0 : 1;
      bVal = b.is_active ? 0 : 1;
    } else if (sortKey === "id") {
      aVal = a.id;
      bVal = b.id;
    }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ column }) => (
    <span className={`sort-icon ${sortKey === column ? "sort-active" : ""}`}>
      {sortKey === column && sortDir === "desc" ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>
      )}
    </span>
  );

  const totalPages = Math.ceil(total / 8);

  return (
    <PageTransition>
      <div className="admin-container">
        <div className="admin-header">
          <div>
            <h1>User Management</h1>
            <p className="admin-subtitle">
              {total} user{total !== 1 ? "s" : ""} registered
            </p>
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
        ) : (
          <>
            <motion.div
              className="table-card glass glow-border"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th className="sortable-th" onClick={() => handleSort("name")}>User <SortIcon column="name" /></th>
                      <th className="sortable-th" onClick={() => handleSort("email")}>Email <SortIcon column="email" /></th>
                      <th className="sortable-th" onClick={() => handleSort("role")}>Role <SortIcon column="role" /></th>
                      <th className="sortable-th" onClick={() => handleSort("status")}>Status <SortIcon column="status" /></th>
                      <th className="sortable-th" onClick={() => handleSort("id")}>ID <SortIcon column="id" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence mode="wait">
                      {sortedUsers.map((u, i) => (
                        <motion.tr
                          key={u.id}
                          custom={i}
                          variants={rowVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          onClick={() => navigate(`/admin/users/${u.username}`)}
                          whileHover={{ backgroundColor: "rgba(22, 163, 74, 0.04)" }}
                        >
                          <td>
                            <div className="user-cell">
                              <div className={`table-avatar role-bg-${u.role}`}>
                                <img src={getAvatarUrl(u.profile)} alt={u.username} onError={avatarErrorHandler(u.profile)} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                              </div>
                              <div className="user-cell-info">
                                <span className="user-cell-name">
                                  {u.first_name} {u.last_name}
                                </span>
                                <span className="user-cell-username">
                                  @{u.username}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="email-cell">{u.email}</td>
                          <td>
                            <span className={`role-chip role-${u.role}`}>
                              {u.role}
                            </span>
                          </td>
                          <td>
                            <span className={`status-chip ${u.is_active ? "status-active" : "status-inactive"}`}>
                              {u.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="id-cell">#{u.id}</td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </motion.div>

            <motion.div
              className="pagination"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <motion.button
                className="page-btn"
                disabled={page === 1}
                onClick={() => fetchUsers(1)}
                whileTap={{ scale: 0.95 }}
                title="First page"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
              </motion.button>
              <motion.button
                className="page-btn"
                disabled={!previous}
                onClick={() => fetchUsers(page - 1)}
                whileTap={{ scale: 0.95 }}
                title="Previous page"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </motion.button>
              <div className="page-numbers">
                {generatePageNumbers(page, totalPages).map((p, i) =>
                  p === "..." ? (
                    <span className="page-ellipsis" key={`e${i}`}>…</span>
                  ) : (
                    <motion.button
                      key={p}
                      className={`page-num ${p === page ? "active" : ""}`}
                      onClick={() => fetchUsers(p)}
                      whileTap={{ scale: 0.9 }}
                    >
                      {p}
                    </motion.button>
                  )
                )}
              </div>
              <motion.button
                className="page-btn"
                disabled={!next}
                onClick={() => fetchUsers(page + 1)}
                whileTap={{ scale: 0.95 }}
                title="Next page"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </motion.button>
              <motion.button
                className="page-btn"
                disabled={page === totalPages}
                onClick={() => fetchUsers(totalPages)}
                whileTap={{ scale: 0.95 }}
                title="Last page"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
              </motion.button>
              <div className="page-jump">
                <span>Go to</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  placeholder={page}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = parseInt(e.target.value, 10);
                      if (val >= 1 && val <= totalPages) {
                        fetchUsers(val);
                        e.target.value = "";
                      }
                    }
                  }}
                />
              </div>
            </motion.div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
