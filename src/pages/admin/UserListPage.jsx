import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
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

export default function UserListPage() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUsers = async (pageNum) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/auth/users/?page=${pageNum}`);
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

  const totalPages = Math.ceil(total / 20);

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
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence mode="wait">
                      {users.map((u, i) => (
                        <motion.tr
                          key={u.id}
                          custom={i}
                          variants={rowVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          onClick={() => navigate(`/admin/users/${u.id}`)}
                          whileHover={{ backgroundColor: "rgba(22, 163, 74, 0.04)" }}
                        >
                          <td>
                            <div className="user-cell">
                              <div className={`table-avatar role-bg-${u.role}`}>
                                {(u.first_name?.[0] || u.username[0]).toUpperCase()}
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
                disabled={!previous}
                onClick={() => fetchUsers(page - 1)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Previous
              </motion.button>
              <div className="page-info">
                <span className="page-current">{page}</span>
                <span className="page-sep">/</span>
                <span className="page-total">{totalPages}</span>
              </div>
              <motion.button
                disabled={!next}
                onClick={() => fetchUsers(page + 1)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Next
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </motion.button>
            </motion.div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
