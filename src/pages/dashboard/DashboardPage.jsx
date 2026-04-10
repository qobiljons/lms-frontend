import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import api from "../../api/axios";
import PageTransition from "../../components/PageTransition";
import "./Dashboard.css";


const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};
const stagger = { animate: { transition: { staggerChildren: 0.08 } } };
const contentVariants = {
  enter: { opacity: 0, y: 12 },
  center: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
};


const COLORS = ["#16a34a", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"];
const STATUS_COLORS = {
  attended: "#16a34a",
  attended_online: "#3b82f6",
  late: "#f59e0b",
  absent: "#ef4444",
  excused: "#8b5cf6",
};
const STATUS_LABELS = {
  attended: "Present",
  attended_online: "Online",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
};


const icons = {
  users: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  course: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>,
  lesson: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  group: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-4-4h-4"/><circle cx="17" cy="7" r="3"/></svg>,
  revenue: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  attendance: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  homework: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  clock: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  star: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  arrow: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>,
  chart: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  grid: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  zap: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  send: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
};


const tabIcons = {
  overview: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  analytics: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  attendance: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  actions: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  submissions: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  homework: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
};


function ChartTooltip({ active, payload, label, prefix = "", suffix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="db-chart-tooltip">
      <span className="tooltip-label">{label}</span>
      {payload.map((p, i) => (
        <div key={i} className="tooltip-row">
          <span className="tooltip-dot" style={{ background: p.color || p.fill }} />
          <span className="tooltip-name">{p.name || p.dataKey}</span>
          <span className="tooltip-val" style={{ color: p.color || p.fill }}>{prefix}{typeof p.value === "number" ? p.value.toLocaleString() : p.value}{suffix}</span>
        </div>
      ))}
    </div>
  );
}


function AttendanceRing({ rate, size = 120, strokeWidth = 10 }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (rate / 100) * circ;
  const color = rate >= 80 ? "#16a34a" : rate >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="ring-container">
      <svg width={size} height={size} className="ring-svg">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-bg)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
        />
      </svg>
      <div className="ring-label">
        <motion.span className="ring-value" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} style={{ color }}>{rate}%</motion.span>
        <span className="ring-sub">attendance</span>
      </div>
    </div>
  );
}


function StatCard({ icon, label, value, color, delay = 0, subtext }) {
  return (
    <motion.div className="db-stat-card" initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay, duration: 0.4 }} whileHover={{ y: -4, boxShadow: `0 8px 30px ${color}18` }}>
      <div className="db-stat-icon" style={{ background: `${color}12`, color }}>{icon}</div>
      <div className="db-stat-body">
        <span className="db-stat-value" style={{ color }}>{typeof value === "number" ? value.toLocaleString() : value}</span>
        <span className="db-stat-label">{label}</span>
        {subtext && <span className="db-stat-sub">{subtext}</span>}
      </div>
    </motion.div>
  );
}


function QuickAction({ to, icon, label, desc, color, delay = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}>
      <Link to={to} className="db-quick-action" style={{ "--qa-color": color }}>
        <div className="qa-icon" style={{ background: `${color}12`, color }}>{icon}</div>
        <div className="qa-text">
          <span className="qa-label">{label}</span>
          <span className="qa-desc">{desc}</span>
        </div>
        <span className="qa-arrow">{icons.arrow}</span>
      </Link>
    </motion.div>
  );
}


function ChartCard({ title, children, delay = 0, className = "" }) {
  return (
    <motion.div className={`db-card ${className}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.5 }}>
      <h3 className="db-card-title">{title}</h3>
      {children}
    </motion.div>
  );
}


function StatusChip({ status }) {
  return (
    <span className="status-chip" style={{ color: STATUS_COLORS[status] || "#6b7280", background: `${STATUS_COLORS[status] || "#6b7280"}18` }}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}


function ProgressBar({ label, value, total, color, delay = 0 }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="db-progress-row">
      <div className="db-progress-header">
        <span className="db-progress-label">{label}</span>
        <span className="db-progress-count" style={{ color }}>{value.toLocaleString()}</span>
      </div>
      <div className="db-progress-track">
        <motion.div className="db-progress-fill" style={{ backgroundColor: color }} initial={{ width: 0 }} animate={{ width: `${Math.max(pct, 2)}%` }} transition={{ delay: delay + 0.3, duration: 0.8, ease: "easeOut" }} />
      </div>
      <span className="db-progress-pct">{pct}%</span>
    </div>
  );
}


function EmptyChart({ message }) {
  return (
    <div className="db-empty-state">
      <span className="db-empty-icon">{icons.lesson}</span>
      <p>{message}</p>
    </div>
  );
}


function TabBar({ tabs, activeTab, onTabChange }) {
  return (
    <div className="db-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`db-tab ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.icon}
          {tab.label}
          {activeTab === tab.id && (
            <motion.div
              className="db-tab-indicator"
              layoutId="dbTabIndicator"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}


export default function DashboardPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const textColor = isDark ? "#9ca3af" : "#6b7280";

  const fetchDashboard = () => {
    setLoading(true);
    setError(false);
    api.get("/auth/dashboard/stats/")
      .then(({ data }) => setStats(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDashboard(); }, []);

  const handleExportExcel = () => {
    setExporting(true);
    api.get("/auth/export/excel/", { responseType: "blob" })
      .then(({ data }) => {
        const url = window.URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = "lms_export.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => {})
      .finally(() => setExporting(false));
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <PageTransition>
      <div className="dashboard">
        <motion.div variants={stagger} initial="initial" animate="animate">
          
          <motion.div className="db-welcome" variants={fadeUp}>
            <div className="db-welcome-text">
              <h1>{greeting()}, <span className="db-highlight">{user.first_name || user.username}</span></h1>
              <p className="db-welcome-sub">
                {user.role === "admin" && "Here\u2019s your platform overview"}
                {user.role === "instructor" && "Here\u2019s your teaching overview"}
                {user.role === "student" && "Here\u2019s your learning progress"}
              </p>
            </div>
            <div className="db-welcome-actions">
              <span className={`db-role-badge db-role-${user.role}`}>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
              {user.role === "admin" && (
                <button className="db-export-btn" onClick={handleExportExcel} disabled={exporting}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                  {exporting ? "Exporting..." : "Export Excel"}
                </button>
              )}
            </div>
          </motion.div>

          
          {loading && (
            <div className="db-skeleton-grid">
              {[...Array(4)].map((_, i) => (
                <motion.div className="db-skeleton-card" key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}>
                  <div className="skel-circle" /><div className="skel-lines"><div className="skel-line w60" /><div className="skel-line w40" /></div>
                </motion.div>
              ))}
            </div>
          )}

          
          {error && !loading && (
            <motion.div className="db-error-card" variants={fadeUp}>
              <p>Failed to load dashboard data</p>
              <motion.button className="db-retry-btn" whileTap={{ scale: 0.95 }} onClick={fetchDashboard}>Try Again</motion.button>
            </motion.div>
          )}

          
          {!loading && !error && stats && user.role === "admin" && <AdminDashboard stats={stats} gridColor={gridColor} textColor={textColor} isDark={isDark} />}
          {!loading && !error && stats && user.role === "instructor" && <InstructorDashboard stats={stats} gridColor={gridColor} textColor={textColor} isDark={isDark} />}
          {!loading && !error && stats && user.role === "student" && <StudentDashboard stats={stats} gridColor={gridColor} textColor={textColor} isDark={isDark} />}
        </motion.div>
      </div>
    </PageTransition>
  );
}


const adminTabs = [
  { id: "overview", label: "Overview", icon: tabIcons.overview },
  { id: "analytics", label: "Analytics", icon: tabIcons.analytics },
  { id: "attendance", label: "Attendance", icon: tabIcons.attendance },
  { id: "actions", label: "Quick Actions", icon: tabIcons.actions },
];

function AdminDashboard({ stats, gridColor, textColor, isDark }) {
  const [activeTab, setActiveTab] = useState("overview");
  const charts = stats.charts || {};
  const attDist = (charts.attendance_status_dist || []).map(d => ({
    name: STATUS_LABELS[d.status] || d.status,
    value: d.count,
    color: STATUS_COLORS[d.status] || "#6b7280",
  }));

  return (
    <>
      <TabBar tabs={adminTabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div key="overview" variants={contentVariants} initial="enter" animate="center" exit="exit">
            
            <div className="db-stats-row">
              <StatCard icon={icons.users} label="Total Users" value={stats.users.total} color="#3b82f6" delay={0.1} subtext={`${stats.users.active} active`} />
              <StatCard icon={icons.course} label="Courses" value={stats.courses.total} color="#8b5cf6" delay={0.15} />
              <StatCard icon={icons.lesson} label="Lessons" value={stats.lessons.total} color="#f59e0b" delay={0.2} />
              <StatCard icon={icons.group} label="Groups" value={stats.groups.total} color="#06b6d4" delay={0.25} />
            </div>
            <div className="db-stats-row">
              <StatCard icon={icons.revenue} label="Total Revenue" value={`$${parseFloat(stats.finance?.total_revenue || 0).toLocaleString()}`} color="#16a34a" delay={0.3} subtext={`$${parseFloat(stats.finance?.monthly_revenue || 0).toLocaleString()} this month`} />
              <StatCard icon={icons.homework} label="Homework" value={stats.homework?.total || 0} color="#ec4899" delay={0.35} subtext={`${stats.homework?.pending_grading || 0} pending`} />
              <StatCard icon={icons.attendance} label="Attendance Rate" value={`${stats.attendance?.rate || 0}%`} color="#14b8a6" delay={0.4} subtext={`${stats.attendance?.sessions || 0} sessions`} />
              <StatCard icon={icons.clock} label="Payments" value={stats.finance?.total_payments || 0} color="#f97316" delay={0.45} />
            </div>
            
            <ChartCard title="User Breakdown" delay={0.5}>
              <div className="db-progress-list">
                <ProgressBar label="Students" value={stats.users.students} total={stats.users.total} color="#22c55e" delay={0.1} />
                <ProgressBar label="Instructors" value={stats.users.instructors} total={stats.users.total} color="#f59e0b" delay={0.2} />
                <ProgressBar label="Admins" value={stats.users.admins} total={stats.users.total} color="#ef4444" delay={0.3} />
              </div>
              {stats.users.inactive > 0 && <div className="db-inactive-note">{stats.users.inactive} inactive user{stats.users.inactive !== 1 ? "s" : ""}</div>}
            </ChartCard>
          </motion.div>
        )}

        {activeTab === "analytics" && (
          <motion.div key="analytics" variants={contentVariants} initial="enter" animate="center" exit="exit">
            <div className="db-grid-2">
              <ChartCard title="Revenue Trend" delay={0.1}>
                <div className="db-chart-wrap">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={charts.revenue_trend || []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#16a34a" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip prefix="$" />} />
                      <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2.5} fill="url(#gRevenue)" name="Revenue" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="User Registrations" delay={0.15}>
                <div className="db-chart-wrap">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={charts.user_growth || []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="New Users" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

            <ChartCard title="Course Popularity" delay={0.2}>
              {(charts.course_popularity || []).length > 0 ? (
                <div className="db-chart-wrap">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={charts.course_popularity} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="students" name="Students" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart message="No course data yet" />}
            </ChartCard>
          </motion.div>
        )}

        {activeTab === "attendance" && (
          <motion.div key="attendance" variants={contentVariants} initial="enter" animate="center" exit="exit">
            <div className="db-grid-2">
              <ChartCard title="Attendance by Session" delay={0.1}>
                {(charts.attendance_by_session || []).length > 0 ? (
                  <div className="db-chart-wrap">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={charts.attendance_by_session} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="session" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="present" name="Present" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="absent" name="Absent" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyChart message="No attendance sessions yet" />}
              </ChartCard>

              <ChartCard title="Attendance Distribution" delay={0.15} className="db-card-center">
                {attDist.length > 0 ? (
                  <div className="db-chart-wrap">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={attDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" nameKey="name">
                          {attDist.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyChart message="No attendance data yet" />}
              </ChartCard>
            </div>
          </motion.div>
        )}

        {activeTab === "actions" && (
          <motion.div key="actions" variants={contentVariants} initial="enter" animate="center" exit="exit">
            <div className="db-actions-grid">
              <QuickAction to="/admin/users" icon={icons.users} label="Manage Users" desc="View and edit user accounts" color="#3b82f6" delay={0.1} />
              <QuickAction to="/admin/courses" icon={icons.course} label="Manage Courses" desc="Create and edit courses" color="#8b5cf6" delay={0.15} />
              <QuickAction to="/admin/groups" icon={icons.group} label="Manage Groups" desc="Organize student groups" color="#06b6d4" delay={0.2} />
              <QuickAction to="/admin/finance" icon={icons.revenue} label="Finance" desc="View revenue and payments" color="#16a34a" delay={0.25} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}


const instructorTabs = [
  { id: "overview", label: "Overview", icon: tabIcons.overview },
  { id: "attendance", label: "Attendance", icon: tabIcons.attendance },
  { id: "submissions", label: "Submissions", icon: tabIcons.submissions },
];

function InstructorDashboard({ stats, gridColor, textColor, isDark }) {
  const [activeTab, setActiveTab] = useState("overview");
  const charts = stats.charts || {};
  const attDist = (charts.attendance_status_dist || []).map(d => ({
    name: STATUS_LABELS[d.status] || d.status,
    value: d.count,
    color: STATUS_COLORS[d.status] || "#6b7280",
  }));

  return (
    <>
      <TabBar tabs={instructorTabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div key="overview" variants={contentVariants} initial="enter" animate="center" exit="exit">
            <div className="db-stats-row">
              <StatCard icon={icons.group} label="My Groups" value={stats.groups?.total || 0} color="#3b82f6" delay={0.1} subtext={`${stats.groups?.total_students || 0} students`} />
              <StatCard icon={icons.course} label="Courses" value={stats.courses?.total || 0} color="#8b5cf6" delay={0.15} />
              <StatCard icon={icons.lesson} label="Lessons" value={stats.lessons?.total || 0} color="#f59e0b" delay={0.2} />
              <StatCard icon={icons.homework} label="Homework" value={stats.homework?.total || 0} color="#ec4899" delay={0.25} />
            </div>

            <div className="db-grid-2">
              <ChartCard title="Homework Overview" delay={0.3}>
                <div className="db-hw-grid">
                  <div className="db-hw-stat"><span className="db-hw-val" style={{ color: "#f59e0b" }}>{stats.homework?.pending_grading || 0}</span><span className="db-hw-lbl">Pending Review</span></div>
                  <div className="db-hw-stat"><span className="db-hw-val" style={{ color: "#16a34a" }}>{stats.homework?.graded || 0}</span><span className="db-hw-lbl">Graded</span></div>
                  <div className="db-hw-stat"><span className="db-hw-val" style={{ color: "#3b82f6" }}>{stats.homework?.submissions || 0}</span><span className="db-hw-lbl">Submissions</span></div>
                  <div className="db-hw-stat"><span className="db-hw-val" style={{ color: "#8b5cf6" }}>{stats.homework?.total || 0}</span><span className="db-hw-lbl">Assignments</span></div>
                </div>
              </ChartCard>

              <ChartCard title="Attendance Rate" delay={0.35} className="db-card-center">
                <AttendanceRing rate={stats.attendance?.rate || 0} />
                <div className="db-ring-stats">
                  <div className="db-ring-stat"><span className="db-ring-stat-val">{stats.attendance?.sessions || 0}</span><span className="db-ring-stat-lbl">Sessions</span></div>
                  <div className="db-ring-stat"><span className="db-ring-stat-val">{stats.attendance?.records || 0}</span><span className="db-ring-stat-lbl">Records</span></div>
                </div>
              </ChartCard>
            </div>
          </motion.div>
        )}

        {activeTab === "attendance" && (
          <motion.div key="attendance" variants={contentVariants} initial="enter" animate="center" exit="exit">
            <div className="db-grid-2">
              <ChartCard title="Attendance by Session" delay={0.1}>
                {(charts.attendance_by_session || []).length > 0 ? (
                  <div className="db-chart-wrap">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={charts.attendance_by_session} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="session" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="present" name="Present" stackId="a" fill="#16a34a" />
                        <Bar dataKey="absent" name="Absent" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyChart message="No attendance sessions yet" />}
              </ChartCard>

              <ChartCard title="Attendance Distribution" delay={0.15} className="db-card-center">
                {attDist.length > 0 ? (
                  <div className="db-chart-wrap">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={attDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                          {attDist.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyChart message="No attendance data yet" />}
              </ChartCard>
            </div>
          </motion.div>
        )}

        {activeTab === "submissions" && (
          <motion.div key="submissions" variants={contentVariants} initial="enter" animate="center" exit="exit">
            <div className="db-grid-2">
              <ChartCard title="Submission Trend" delay={0.1}>
                <div className="db-chart-wrap">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={charts.submission_trend || []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gSubs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ec4899" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="count" name="Submissions" stroke="#ec4899" strokeWidth={2.5} fill="url(#gSubs)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Group Sizes" delay={0.15}>
                {(charts.group_sizes || []).length > 0 ? (
                  <div className="db-chart-wrap">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={charts.group_sizes} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} width={100} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="students" name="Students" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyChart message="No groups yet" />}
              </ChartCard>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}


const studentTabs = [
  { id: "overview", label: "Overview", icon: tabIcons.overview },
  { id: "attendance", label: "Attendance", icon: tabIcons.attendance },
  { id: "homework", label: "Homework", icon: tabIcons.homework },
];

function StudentDashboard({ stats, gridColor, textColor, isDark }) {
  const [activeTab, setActiveTab] = useState("overview");
  const charts = stats.charts || {};
  const attDist = (charts.attendance_status_dist || []).map(d => ({
    name: STATUS_LABELS[d.status] || d.status,
    value: d.count,
    color: STATUS_COLORS[d.status] || "#6b7280",
  }));

  return (
    <>
      <TabBar tabs={studentTabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div key="overview" variants={contentVariants} initial="enter" animate="center" exit="exit">
            <div className="db-stats-row">
              <StatCard icon={icons.course} label="Enrolled Courses" value={stats.courses?.enrolled || 0} color="#8b5cf6" delay={0.1} />
              <StatCard icon={icons.group} label="My Groups" value={stats.groups?.total || 0} color="#3b82f6" delay={0.15} />
              <StatCard icon={icons.homework} label="Homework Done" value={(stats.homework?.submitted || 0) + (stats.homework?.graded || 0)} color="#16a34a" delay={0.2} subtext={`${stats.homework?.draft || 0} drafts`} />
              <StatCard icon={icons.star} label="Avg Score" value={stats.homework?.average_score ? `${Math.round(stats.homework.average_score)}pts` : "N/A"} color="#f59e0b" delay={0.25} />
            </div>

            <div className="db-grid-2">
              <ChartCard title="My Attendance Rate" delay={0.3} className="db-card-center">
                <AttendanceRing rate={stats.attendance?.rate || 0} />
                <div className="db-ring-stats">
                  <div className="db-ring-stat"><span className="db-ring-stat-val">{stats.attendance?.present || 0}</span><span className="db-ring-stat-lbl">Present</span></div>
                  <div className="db-ring-stat"><span className="db-ring-stat-val">{stats.attendance?.total || 0}</span><span className="db-ring-stat-lbl">Total</span></div>
                </div>
              </ChartCard>

              <ChartCard title="Homework Progress" delay={0.35}>
                <div className="db-hw-grid">
                  <div className="db-hw-stat"><span className="db-hw-val" style={{ color: "#16a34a" }}>{stats.homework?.graded || 0}</span><span className="db-hw-lbl">Graded</span></div>
                  <div className="db-hw-stat"><span className="db-hw-val" style={{ color: "#3b82f6" }}>{stats.homework?.submitted || 0}</span><span className="db-hw-lbl">Submitted</span></div>
                  <div className="db-hw-stat"><span className="db-hw-val" style={{ color: "#f59e0b" }}>{stats.homework?.draft || 0}</span><span className="db-hw-lbl">Drafts</span></div>
                  <div className="db-hw-stat"><span className="db-hw-val" style={{ color: "#8b5cf6" }}>{stats.homework?.total || 0}</span><span className="db-hw-lbl">Total</span></div>
                </div>
              </ChartCard>
            </div>
          </motion.div>
        )}

        {activeTab === "attendance" && (
          <motion.div key="attendance" variants={contentVariants} initial="enter" animate="center" exit="exit">
            <div className="db-grid-2">
              <ChartCard title="Attendance Breakdown" delay={0.1} className="db-card-center">
                {attDist.length > 0 ? (
                  <div className="db-chart-wrap">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={attDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                          {attDist.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyChart message="No attendance records yet" />}
              </ChartCard>

              <ChartCard title="Attendance Timeline" delay={0.15}>
                {(charts.attendance_timeline || []).length > 0 ? (
                  <div className="db-chart-wrap">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={charts.attendance_timeline} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} domain={[0, 1]} ticks={[0, 1]} tickFormatter={v => v === 1 ? "Present" : "Absent"} />
                        <Tooltip content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="db-chart-tooltip">
                              <span className="tooltip-label">{label}</span>
                              <div className="tooltip-row">
                                <span className="tooltip-dot" style={{ background: d.status ? "#16a34a" : "#ef4444" }} />
                                <span className="tooltip-val" style={{ color: d.status ? "#16a34a" : "#ef4444" }}>{d.label}</span>
                              </div>
                            </div>
                          );
                        }} />
                        <Bar dataKey="status" name="Status" radius={[4, 4, 0, 0]} barSize={24}>
                          {(charts.attendance_timeline || []).map((d, i) => (
                            <Cell key={i} fill={d.status === 1 ? "#16a34a" : "#ef4444"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyChart message="No attendance history yet" />}
              </ChartCard>
            </div>

            
            {stats.recent_attendance?.length > 0 && (
              <ChartCard title="Recent Attendance" delay={0.2}>
                <div className="db-activity-list">
                  {stats.recent_attendance.map((r, i) => (
                    <motion.div className="db-activity-item" key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.06 }}>
                      <div className="db-activity-left">
                        <span className="db-activity-title">{r.group}</span>
                        <span className="db-activity-meta">{r.course} &middot; {r.date}</span>
                      </div>
                      <StatusChip status={r.status} />
                    </motion.div>
                  ))}
                </div>
              </ChartCard>
            )}
          </motion.div>
        )}

        {activeTab === "homework" && (
          <motion.div key="homework" variants={contentVariants} initial="enter" animate="center" exit="exit">
            <ChartCard title="Score Trend" delay={0.1}>
              {(charts.score_trend || []).length > 0 ? (
                <div className="db-chart-wrap">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={charts.score_trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: textColor }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip suffix="pts" />} />
                      <Line type="monotone" dataKey="score" name="Score" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: "#f59e0b", r: 4 }} activeDot={{ r: 6, fill: "#f59e0b" }} />
                      <Line type="monotone" dataKey="total" name="Max" stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart message="No graded homework yet" />}
            </ChartCard>

            <ChartCard title="Submission Summary" delay={0.15}>
              <div className="db-hw-grid db-hw-grid-3">
                <div className="db-hw-stat"><span className="db-hw-val" style={{ color: "#16a34a" }}>{stats.homework?.graded || 0}</span><span className="db-hw-lbl">Graded</span></div>
                <div className="db-hw-stat"><span className="db-hw-val" style={{ color: "#3b82f6" }}>{stats.homework?.submitted || 0}</span><span className="db-hw-lbl">Submitted</span></div>
                <div className="db-hw-stat"><span className="db-hw-val" style={{ color: "#f59e0b" }}>{stats.homework?.draft || 0}</span><span className="db-hw-lbl">Drafts</span></div>
              </div>
            </ChartCard>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
