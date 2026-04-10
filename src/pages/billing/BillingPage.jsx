import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
import PageTransition from "../../components/PageTransition";
import "./Billing.css";

function StatusBadge({ status }) {
  const colors = {
    succeeded: { bg: "rgba(22,163,74,0.1)", color: "#16a34a", border: "rgba(22,163,74,0.2)" },
    active: { bg: "rgba(22,163,74,0.1)", color: "#16a34a", border: "rgba(22,163,74,0.2)" },
    pending: { bg: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "rgba(245,158,11,0.2)" },
    failed: { bg: "rgba(239,68,68,0.1)", color: "#ef4444", border: "rgba(239,68,68,0.2)" },
    refunded: { bg: "rgba(139,92,246,0.1)", color: "#8b5cf6", border: "rgba(139,92,246,0.2)" },
    cancelled: { bg: "rgba(107,114,128,0.1)", color: "#6b7280", border: "rgba(107,114,128,0.2)" },
    expired: { bg: "rgba(107,114,128,0.1)", color: "#6b7280", border: "rgba(107,114,128,0.2)" },
    past_due: { bg: "rgba(239,68,68,0.1)", color: "#ef4444", border: "rgba(239,68,68,0.2)" },
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

export default function BillingPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [subscribing, setSubscribing] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const success = searchParams.get("success");
    if (success === "true" && sessionId) {
      setShowSuccess(true);
      api.get(`/payments/checkout/success/?session_id=${sessionId}`)
        .then(() => {
          toast.success("Subscription activated successfully!");
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
      const [subRes, plansRes, paymentsRes] = await Promise.allSettled([
        api.get("/payments/my-subscription/"),
        api.get("/payments/available-plans/"),
        api.get("/payments/my-payments/"),
      ]);

      if (subRes.status === "fulfilled") {
        setSubscription(subRes.value.data);
      }
      if (plansRes.status === "fulfilled") {
        setPlans(plansRes.value.data);
      }
      if (paymentsRes.status === "fulfilled") {
        setPayments(paymentsRes.value.data.results || paymentsRes.value.data);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubscribe = async (planId) => {
    setSubscribing(planId);
    try {
      const { data } = await api.post("/payments/checkout/", { plan_id: planId });
      if (data.demo) {
        toast.success("Subscription activated successfully!");
        setShowSuccess(true);
        setSubscription(data.subscription);
        fetchData();
      } else if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.error("Failed to get checkout URL.");
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to start checkout.";
      toast.error(msg);
    } finally {
      setSubscribing(null);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const durationLabel = (days) => {
    if (days === 30) return "per month";
    if (days === 90) return "per quarter";
    if (days === 180) return "per 6 months";
    if (days === 365) return "per year";
    return `per ${days} days`;
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="billing-container">
          <div className="billing-loading">
            <div className="billing-spinner" />
          </div>
        </div>
      </PageTransition>
    );
  }

  const hasActiveSub = subscription && subscription.status === "active";

  return (
    <PageTransition>
      <div className="billing-container">
        <div className="billing-header">
          <h1>Billing</h1>
          <p className="billing-subtitle">Manage your subscription and view payment history</p>
        </div>

        {showSuccess && (
          <motion.div
            className="billing-success"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Payment successful! Your subscription is now active.
          </motion.div>
        )}

        
        {hasActiveSub && (
          <motion.div
            className="subscription-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="subscription-card-header">
              <h3>Current Subscription</h3>
              <StatusBadge status={subscription.status} />
            </div>
            <div className="subscription-details">
              <div className="sub-detail">
                <span className="sub-detail-label">Plan</span>
                <span className="sub-detail-value">{subscription.plan_detail?.name || "—"}</span>
              </div>
              <div className="sub-detail">
                <span className="sub-detail-label">Price</span>
                <span className="sub-detail-value" style={{ color: "#16a34a" }}>
                  {subscription.plan_detail ? formatCurrency(subscription.plan_detail.price) : "—"}
                </span>
              </div>
              <div className="sub-detail">
                <span className="sub-detail-label">Started</span>
                <span className="sub-detail-value">{formatDate(subscription.current_period_start)}</span>
              </div>
              <div className="sub-detail">
                <span className="sub-detail-label">Renews</span>
                <span className="sub-detail-value">{formatDate(subscription.current_period_end)}</span>
              </div>
            </div>
          </motion.div>
        )}

        
        {!hasActiveSub && plans.length > 0 && (
          <motion.div
            className="plans-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h3>Available Plans</h3>
            <div className="plans-grid">
              {plans.map((plan, i) => (
                <motion.div
                  key={plan.id}
                  className="plan-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -4 }}
                >
                  <div className="plan-card-name">
                    {plan.name}
                    {plan.is_vip && (
                      <span style={{
                        marginLeft: "0.5rem", display: "inline-block",
                        padding: "0.1rem 0.4rem", borderRadius: 6,
                        fontSize: "0.65rem", fontWeight: 700, verticalAlign: "middle",
                        background: "rgba(139,92,246,0.15)", color: "#8b5cf6",
                        border: "1px solid rgba(139,92,246,0.25)",
                      }}>VIP</span>
                    )}
                  </div>
                  <div className="plan-card-desc">{plan.is_vip ? "Access to all courses included" : (plan.description || "Standard subscription plan")}</div>
                  <div className="plan-card-price">{formatCurrency(plan.price)}</div>
                  <div className="plan-card-duration">{durationLabel(plan.duration_days)}</div>
                  <motion.button
                    className="plan-card-btn"
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={subscribing === plan.id}
                    whileTap={{ scale: 0.97 }}
                  >
                    {subscribing === plan.id ? "Redirecting..." : "Subscribe"}
                  </motion.button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {!hasActiveSub && plans.length === 0 && (
          <div className="billing-empty">
            <div className="billing-empty-icon">📋</div>
            <p>No subscription plans are available at the moment.</p>
          </div>
        )}

        
        {payments.length > 0 && (
          <motion.div
            className="payment-history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <h3>Payment History</h3>
            <table className="payment-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.created_at)}</td>
                    <td>{p.plan_name || "—"}</td>
                    <td style={{ fontWeight: 600, color: "#16a34a" }}>{formatCurrency(p.amount)}</td>
                    <td><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
