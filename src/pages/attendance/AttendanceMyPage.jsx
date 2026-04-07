import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../../api/axios";
import PageTransition from "../../components/PageTransition";
import "./Attendance.css";

const STATUS_COLORS = {
  attended: "#16a34a",
  absent: "#ef4444",
  attended_online: "#3b82f6",
  late: "#f59e0b",
  excused: "#8b5cf6",
};

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || "#6b7280";
  return (
    <span
      className="attendance-status"
      style={{ color, background: `${color}18`, borderColor: `${color}33` }}
    >
      {String(status || "unknown").replaceAll("_", " ")}
    </span>
  );
}

export default function AttendanceMyPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const loadMyAttendance = async () => {
      setLoading(true);
      try {
        const response = await api.get("/attendance/my/");
        setData(response.data || {});
      } catch {
        toast.error("Failed to load your attendance.");
      } finally {
        setLoading(false);
      }
    };
    loadMyAttendance();
  }, []);

  if (loading) {
    return (
      <PageTransition>
        <div className="attendance-page">
          <div className="attendance-loading">Loading your attendance...</div>
        </div>
      </PageTransition>
    );
  }

  const summary = data?.summary || {};
  const byGroup = data?.by_group || [];
  const recentRecords = data?.recent_records || [];

  return (
    <PageTransition>
      <div className="attendance-page">
        <div className="attendance-header">
          <h1>My Attendance</h1>
          <p>Track your attendance rate, group breakdown, and recent records.</p>
        </div>

        <div className="attendance-stats">
          <div className="card">
            <span>Total records</span>
            <strong>{summary.total_records ?? 0}</strong>
          </div>
          <div className="card">
            <span>Present</span>
            <strong>{summary.present_records ?? 0}</strong>
          </div>
          <div className="card">
            <span>Attendance rate</span>
            <strong>{summary.attendance_percentage ?? 0}%</strong>
          </div>
        </div>

        <div className="card">
          <h3>By group</h3>
          <div className="attendance-table">
            <div className="attendance-table-head">
              <span>Group</span>
              <span>Sessions</span>
              <span>Rate</span>
            </div>
            {byGroup.map((group) => (
              <div className="attendance-table-row" key={group.session__group_id}>
                <span>{group.session__group__name || `Group #${group.session__group_id}`}</span>
                <span>{group.total ?? 0}</span>
                <span>{group.attendance_percentage ?? 0}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Recent records</h3>
          <div className="attendance-table">
            <div className="attendance-table-head">
              <span>Date</span>
              <span>Group</span>
              <span>Status</span>
            </div>
            {recentRecords.map((record, idx) => (
              <div className="attendance-table-row" key={record.session_id || idx}>
                <span>{record.session_date || "--"}</span>
                <span>{record.group || "--"}</span>
                <span><StatusBadge status={record.status} /></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
