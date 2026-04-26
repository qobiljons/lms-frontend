import { useEffect, useState, useCallback, useRef } from "react";
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

function StatusBadge({ status }) {
  const colors = {
    succeeded: { bg: "rgba(22,163,74,0.1)", color: "#16a34a", border: "rgba(22,163,74,0.2)" },
    active: { bg: "rgba(22,163,74,0.1)", color: "#16a34a", border: "rgba(22,163,74,0.2)" },
    pending: { bg: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "rgba(245,158,11,0.2)" },
    failed: { bg: "rgba(239,68,68,0.1)", color: "#ef4444", border: "rgba(239,68,68,0.2)" },
    refunded: { bg: "rgba(139,92,246,0.1)", color: "#8b5cf6", border: "rgba(139,92,246,0.2)" },
  };
  const c = colors[status] || colors.pending;
  return (
    <span style={{
      display: "inline-block", padding: "0.2rem 0.55rem", borderRadius: 6,
      fontSize: "0.75rem", fontWeight: 600, background: c.bg, color: c.color,
      border: `1px solid ${c.border}`, textTransform: "capitalize",
    }}>
      {status?.replace("_", " ")}
    </span>
  );
}

export default function AdminFinancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "purchases";
  const setActiveTab = (tab) => setSearchParams(tab === "purchases" ? {} : { tab });

  const [stats, setStats] = useState(null);

  const [purchases, setPurchases] = useState([]);
  const [cpPage, setCpPage] = useState(1);
  const [cpTotal, setCpTotal] = useState(0);
  const [cpNext, setCpNext] = useState(null);
  const [cpPrev, setCpPrev] = useState(null);
  const [cpLoading, setCpLoading] = useState(true);
  const [cpPageSize] = useState(10);
  const [cpSearch, setCpSearch] = useState("");
  const cpSearchTimer = useRef(null);

  const [transactions, setTransactions] = useState([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [txNext, setTxNext] = useState(null);
  const [txPrev, setTxPrev] = useState(null);
  const [txLoading, setTxLoading] = useState(true);
  const [txPageSize] = useState(10);
  const [txSearch, setTxSearch] = useState("");
  const txSearchTimer = useRef(null);

  useEffect(() => {
    api.get("/payments/stats/")
      .then(({ data }) => setStats(data))
      .catch(() => {});
  }, []);

  const fetchPurchases = useCallback(async (pageNum) => {
    setCpLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", pageNum);
      params.set("page_size", cpPageSize);
      if (cpSearch) params.set("search", cpSearch);
      const { data } = await api.get(`/payments/course-purchases/?${params.toString()}`);
      setPurchases(data.results || data);
      setCpTotal(data.count || 0);
      setCpNext(data.next);
      setCpPrev(data.previous);
      setCpPage(pageNum);
    } catch {
      toast.error("Failed to load purchases.");
    } finally {
      setCpLoading(false);
    }
  }, [cpSearch, cpPageSize]);

  useEffect(() => {
    if (activeTab === "purchases") fetchPurchases(1);
  }, [activeTab, fetchPurchases]);

  const handleCpSearch = (e) => {
    const val = e.target.value;
    setCpSearch(val);
    clearTimeout(cpSearchTimer.current);
    cpSearchTimer.current = setTimeout(() => setCpPage(1), 400);
  };

  const fetchTransactions = useCallback(async (pageNum) => {
    setTxLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", pageNum);
      params.set("page_size", txPageSize);
      if (txSearch) params.set("search", txSearch);
      const { data } = await api.get(`/payments/transactions/?${params.toString()}`);
      setTransactions(data.results || data);
      setTxTotal(data.count || 0);
      setTxNext(data.next);
      setTxPrev(data.previous);
      setTxPage(pageNum);
    } catch {
      toast.error("Failed to load transactions.");
    } finally {
      setTxLoading(false);
    }
  }, [txSearch, txPageSize]);

  useEffect(() => {
    if (activeTab === "transactions") fetchTransactions(1);
  }, [activeTab, fetchTransactions]);

  const handleTxSearch = (e) => {
    const val = e.target.value;
    setTxSearch(val);
    clearTimeout(txSearchTimer.current);
    txSearchTimer.current = setTimeout(() => setTxPage(1), 400);
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const cpTotalPages = Math.ceil(cpTotal / cpPageSize);
  const txTotalPages = Math.ceil(txTotal / txPageSize);

  return (
    <PageTransition>
      <div className="admin-container">
        <div className="admin-header">
          <div>
            <h1>Finance</h1>
            <p className="admin-subtitle">Track course payments and revenue</p>
          </div>
        </div>

        {stats && (
          <motion.div
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {[
              { label: "Total Revenue", value: formatCurrency(stats.total_revenue), icon: "💰", color: "#16a34a", bg: "rgba(22,163,74,0.08)" },
              { label: "This Month", value: formatCurrency(stats.monthly_revenue), icon: "📈", color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
              { label: "Course Purchases", value: stats.total_course_purchases || 0, icon: "📚", color: "#ec4899", bg: "rgba(236,72,153,0.08)" },
              { label: "Payments Made", value: stats.total_payments || 0, icon: "🧾", color: "#8b5cf6", bg: "rgba(139,92,246,0.08)" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                className="admin-stat"
                whileHover={{ y: -4, boxShadow: `0 8px 24px ${s.color}20` }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 + i * 0.06, type: "spring", stiffness: 300, damping: 25 }}
                style={{ borderTop: `3px solid ${s.color}` }}
              >
                <div className="admin-stat-icon" style={{ background: s.bg }}>
                  <span>{s.icon}</span>
                </div>
                <div className="admin-stat-info">
                  <span className="admin-stat-value" style={{ color: s.color }}>
                    {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
                  </span>
                  <span className="admin-stat-label">{s.label}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        <div className="user-tabs">
          <button className={`user-tab ${activeTab === "purchases" ? "active" : ""}`} onClick={() => setActiveTab("purchases")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            Course Purchases
            {activeTab === "purchases" && <motion.div className="user-tab-indicator" layoutId="financeTab" />}
          </button>
          <button className={`user-tab ${activeTab === "transactions" ? "active" : ""}`} onClick={() => setActiveTab("transactions")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            All Transactions
            {activeTab === "transactions" && <motion.div className="user-tab-indicator" layoutId="financeTab" />}
          </button>
        </div>

        <AnimatePresence mode="wait">

          {activeTab === "purchases" && (
            <motion.div key="purchases" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
              <div className="user-toolbar">
                <div className="toolbar-search">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input type="text" placeholder="Search by student name or course..." value={cpSearch} onChange={handleCpSearch} />
                  {cpSearch && (
                    <button className="toolbar-search-clear" onClick={() => setCpSearch("")} title="Clear">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
              </div>

              {cpLoading ? (
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
                            <th>Date</th>
                            <th>Student</th>
                            <th>Course</th>
                            <th>Amount Paid</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <AnimatePresence mode="wait">
                            {purchases.length === 0 ? (
                              <tr>
                                <td colSpan={5} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
                                  No course purchases yet.
                                </td>
                              </tr>
                            ) : purchases.map((cp, i) => (
                              <motion.tr key={cp.id} custom={i} variants={rowVariants} initial="hidden" animate="visible" exit="exit">
                                <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{formatDate(cp.created_at)}</td>
                                <td>
                                  <div className="user-cell">
                                    <img
                                      className="table-avatar"
                                      src={getAvatarUrl(cp.user_detail)}
                                      alt=""
                                      onError={avatarErrorHandler}
                                    />
                                    <div className="user-cell-info">
                                      <span className="user-cell-name">
                                        {cp.user_detail?.first_name} {cp.user_detail?.last_name}
                                      </span>
                                      <span className="user-cell-username">@{cp.user_detail?.username}</span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 500, fontSize: "0.88rem" }}>{cp.course_title}</div>
                                </td>
                                <td style={{ fontSize: "0.9rem", fontWeight: 700, color: "#16a34a" }}>
                                  {formatCurrency(cp.amount)}
                                </td>
                                <td><StatusBadge status={cp.payment_status || "succeeded"} /></td>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        </tbody>
                      </table>
                    </div>
                  </motion.div>

                  {cpTotalPages > 1 && (
                    <motion.div className="pagination" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                      <div className="pagination-info">
                        Showing {(cpPage - 1) * cpPageSize + 1}–{Math.min(cpPage * cpPageSize, cpTotal)} of {cpTotal}
                      </div>
                      <div className="pagination-controls">
                        <motion.button className="page-btn" disabled={cpPage === 1} onClick={() => fetchPurchases(1)} whileTap={{ scale: 0.95 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                        </motion.button>
                        <motion.button className="page-btn" disabled={!cpPrev} onClick={() => fetchPurchases(cpPage - 1)} whileTap={{ scale: 0.95 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </motion.button>
                        <div className="page-numbers">
                          {generatePageNumbers(cpPage, cpTotalPages).map((p, i) =>
                            p === "..." ? <span className="page-ellipsis" key={`e${i}`}>...</span>
                              : <motion.button key={p} className={`page-num ${p === cpPage ? "active" : ""}`} onClick={() => fetchPurchases(p)} whileTap={{ scale: 0.9 }}>{p}</motion.button>
                          )}
                        </div>
                        <motion.button className="page-btn" disabled={!cpNext} onClick={() => fetchPurchases(cpPage + 1)} whileTap={{ scale: 0.95 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </motion.button>
                        <motion.button className="page-btn" disabled={cpPage === cpTotalPages} onClick={() => fetchPurchases(cpTotalPages)} whileTap={{ scale: 0.95 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {activeTab === "transactions" && (
            <motion.div key="transactions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
              <div className="user-toolbar">
                <div className="toolbar-search">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input type="text" placeholder="Search by student name or email..." value={txSearch} onChange={handleTxSearch} />
                  {txSearch && (
                    <button className="toolbar-search-clear" onClick={() => setTxSearch("")} title="Clear">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
              </div>

              {txLoading ? (
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
                            <th>Date</th>
                            <th>Student</th>
                            <th>Amount</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <AnimatePresence mode="wait">
                            {transactions.length === 0 ? (
                              <tr>
                                <td colSpan={4} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🧾</div>
                                  No transactions yet.
                                </td>
                              </tr>
                            ) : transactions.map((tx, i) => (
                              <motion.tr key={tx.id} custom={i} variants={rowVariants} initial="hidden" animate="visible" exit="exit">
                                <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{formatDate(tx.created_at)}</td>
                                <td>
                                  <div className="user-cell">
                                    <img
                                      className="table-avatar"
                                      src={getAvatarUrl(tx.user_detail)}
                                      alt=""
                                      onError={avatarErrorHandler}
                                    />
                                    <div className="user-cell-info">
                                      <span className="user-cell-name">{tx.user_detail?.first_name} {tx.user_detail?.last_name}</span>
                                      <span className="user-cell-username">@{tx.user_detail?.username}</span>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ fontSize: "0.9rem", fontWeight: 700, color: "#16a34a" }}>{formatCurrency(tx.amount)}</td>
                                <td><StatusBadge status={tx.status} /></td>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        </tbody>
                      </table>
                    </div>
                  </motion.div>

                  {txTotalPages > 1 && (
                    <motion.div className="pagination" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                      <div className="pagination-info">
                        Showing {(txPage - 1) * txPageSize + 1}–{Math.min(txPage * txPageSize, txTotal)} of {txTotal}
                      </div>
                      <div className="pagination-controls">
                        <motion.button className="page-btn" disabled={txPage === 1} onClick={() => fetchTransactions(1)} whileTap={{ scale: 0.95 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                        </motion.button>
                        <motion.button className="page-btn" disabled={!txPrev} onClick={() => fetchTransactions(txPage - 1)} whileTap={{ scale: 0.95 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </motion.button>
                        <div className="page-numbers">
                          {generatePageNumbers(txPage, txTotalPages).map((p, i) =>
                            p === "..." ? <span className="page-ellipsis" key={`e${i}`}>...</span>
                              : <motion.button key={p} className={`page-num ${p === txPage ? "active" : ""}`} onClick={() => fetchTransactions(p)} whileTap={{ scale: 0.9 }}>{p}</motion.button>
                          )}
                        </div>
                        <motion.button className="page-btn" disabled={!txNext} onClick={() => fetchTransactions(txPage + 1)} whileTap={{ scale: 0.95 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </motion.button>
                        <motion.button className="page-btn" disabled={txPage === txTotalPages} onClick={() => fetchTransactions(txTotalPages)} whileTap={{ scale: 0.95 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
