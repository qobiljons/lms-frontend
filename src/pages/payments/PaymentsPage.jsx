import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
import PageTransition from "../../components/PageTransition";
import "./Payments.css";

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

export default function PaymentsPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("courses");
  const [loading, setLoading] = useState(true);

  const [courses, setCourses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [purchasing, setPurchasing] = useState(null);

  const [payments, setPayments] = useState([]);

  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const success = searchParams.get("purchase_success");
    if (success === "true" && sessionId) {
      setShowSuccess(true);
      api.get(`/payments/course-checkout/success/?session_id=${sessionId}`)
        .then(() => {
          toast.success("Course purchased successfully!");
          fetchData();
        })
        .catch(() => {
          toast.error("Could not verify payment. Please refresh.");
        });
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [coursesRes, purchasesRes, paymentsRes] = await Promise.allSettled([
        api.get("/courses/"),
        api.get("/payments/my-purchases/"),
        api.get("/payments/my-payments/"),
      ]);

      if (coursesRes.status === "fulfilled") {
        setCourses(coursesRes.value.data.results || coursesRes.value.data);
      }
      if (purchasesRes.status === "fulfilled") {
        setPurchases(purchasesRes.value.data.results || purchasesRes.value.data);
      }
      if (paymentsRes.status === "fulfilled") {
        setPayments(paymentsRes.value.data.results || paymentsRes.value.data);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const purchasedCourseIds = new Set(purchases.map((p) => p.course));

  const handlePurchase = async (course) => {
    if (course.price == 0) {
      toast.info("This course is free! You can access it directly.");
      return;
    }
    setPurchasing(course.id);
    try {
      const { data } = await api.post("/payments/course-checkout/", { course_id: course.id });
      if (data.demo) {
        toast.success(`Successfully purchased "${course.title}"!`);
        setShowSuccess(true);
        fetchData();
      } else if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.error("Failed to start checkout.");
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to start checkout.";
      toast.error(msg);
    } finally {
      setPurchasing(null);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "--";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  if (loading) {
    return (
      <PageTransition>
        <div className="payments-container">
          <div className="payments-loading">
            <div className="payments-spinner" />
          </div>
        </div>
      </PageTransition>
    );
  }

  const availableCourses = courses.filter((c) => c.price > 0 && !purchasedCourseIds.has(c.id));
  const freeCourses = courses.filter((c) => c.price == 0);

  return (
    <PageTransition>
      <div className="payments-container">
        <div className="payments-header">
          <h1>Payments</h1>
          <p className="payments-subtitle">Purchase courses and view your payment history</p>
        </div>

        {showSuccess && (
          <motion.div
            className="payments-success"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Payment successful! Your course has been unlocked.
          </motion.div>
        )}

        
        <div className="payments-tabs">
          <button className={`payments-tab ${activeTab === "courses" ? "active" : ""}`} onClick={() => setActiveTab("courses")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            Available Courses
            {activeTab === "courses" && <motion.div className="payments-tab-indicator" layoutId="paymentTab" />}
          </button>
          <button className={`payments-tab ${activeTab === "purchased" ? "active" : ""}`} onClick={() => setActiveTab("purchased")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            My Purchases
            {purchases.length > 0 && <span className="payments-tab-count">{purchases.length}</span>}
            {activeTab === "purchased" && <motion.div className="payments-tab-indicator" layoutId="paymentTab" />}
          </button>
          <button className={`payments-tab ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Payment History
            {activeTab === "history" && <motion.div className="payments-tab-indicator" layoutId="paymentTab" />}
          </button>
        </div>

        <AnimatePresence mode="wait">
          
          {activeTab === "courses" && (
            <motion.div key="courses" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
              {availableCourses.length > 0 && (
                <div className="courses-section">
                  <h3 className="section-title">Paid Courses</h3>
                  <div className="courses-grid">
                    {availableCourses.map((course, i) => (
                      <motion.div
                        key={course.id}
                        className="course-pay-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        whileHover={{ y: -4 }}
                      >
                        <div className="course-pay-logo">
                          {course.logo ? (
                            <img src={course.logo} alt={course.title} />
                          ) : (
                            <div className="course-pay-logo-placeholder">
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                            </div>
                          )}
                        </div>
                        <div className="course-pay-info">
                          <h4 className="course-pay-title">{course.title}</h4>
                          <p className="course-pay-desc">
                            {course.description ? (course.description.length > 100 ? course.description.slice(0, 100) + "..." : course.description) : "No description available."}
                          </p>
                        </div>
                        <div className="course-pay-footer">
                          <span className="course-pay-price">{formatCurrency(course.price)}</span>
                          <motion.button
                            className="course-pay-btn"
                            onClick={() => handlePurchase(course)}
                            disabled={purchasing === course.id}
                            whileTap={{ scale: 0.97 }}
                          >
                            {purchasing === course.id ? (
                              <span className="btn-loading-inline">
                                <span className="btn-spinner-small" />
                                Processing...
                              </span>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                                Pay Now
                              </>
                            )}
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {freeCourses.length > 0 && (
                <div className="courses-section" style={{ marginTop: availableCourses.length > 0 ? "2rem" : 0 }}>
                  <h3 className="section-title">Free Courses</h3>
                  <div className="courses-grid">
                    {freeCourses.map((course, i) => (
                      <motion.div
                        key={course.id}
                        className="course-pay-card free"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        whileHover={{ y: -4 }}
                      >
                        <div className="course-pay-logo">
                          {course.logo ? (
                            <img src={course.logo} alt={course.title} />
                          ) : (
                            <div className="course-pay-logo-placeholder free">
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                            </div>
                          )}
                        </div>
                        <div className="course-pay-info">
                          <h4 className="course-pay-title">{course.title}</h4>
                          <p className="course-pay-desc">
                            {course.description ? (course.description.length > 100 ? course.description.slice(0, 100) + "..." : course.description) : "No description available."}
                          </p>
                        </div>
                        <div className="course-pay-footer">
                          <span className="course-pay-price free">Free</span>
                          <span className="course-free-badge">No payment required</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {availableCourses.length === 0 && freeCourses.length === 0 && (
                <div className="payments-empty">
                  <div className="payments-empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                  </div>
                  <p>No courses available at the moment.</p>
                </div>
              )}
            </motion.div>
          )}

          
          {activeTab === "purchased" && (
            <motion.div key="purchased" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
              {purchases.length > 0 ? (
                <div className="purchases-list">
                  {purchases.map((purchase, i) => (
                    <motion.div
                      key={purchase.id}
                      className="purchase-item"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div className="purchase-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      </div>
                      <div className="purchase-info">
                        <span className="purchase-title">{purchase.course_title}</span>
                        <span className="purchase-date">Purchased on {formatDate(purchase.created_at)}</span>
                      </div>
                      <span className="purchase-amount">{formatCurrency(purchase.amount)}</span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="payments-empty">
                  <div className="payments-empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  </div>
                  <p>You haven't purchased any courses yet.</p>
                </div>
              )}
            </motion.div>
          )}

          
          {activeTab === "history" && (
            <motion.div key="history" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
              {payments.length > 0 ? (
                <div className="payments-table-wrap">
                  <table className="payments-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td>{formatDate(p.created_at)}</td>
                          <td>{p.plan_name || "Course Payment"}</td>
                          <td style={{ fontWeight: 600, color: "#16a34a" }}>{formatCurrency(p.amount)}</td>
                          <td><StatusBadge status={p.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="payments-empty">
                  <div className="payments-empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </div>
                  <p>No payment history yet.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
