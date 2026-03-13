import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { getAvatarUrl, avatarErrorHandler } from "../../utils/avatar";
import PageTransition from "../../components/PageTransition";
import "./MemberProfile.css";

const roleColors = { student: "#16a34a", instructor: "#f59e0b", admin: "#ef4444" };

export default function MemberProfilePage() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMember();
  }, [username]);

  const loadMember = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/groups/members/${username}/`);
      setMember(data);
    } catch (err) {
      if (err.response?.status === 403) {
        setError("You can only view profiles of members in your groups.");
      } else if (err.response?.status === 404) {
        setError("User not found.");
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="member-profile-page">
          <div className="member-profile-loading">
            <div className="member-profile-spinner" />
            <p>Loading profile...</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (error) {
    return (
      <PageTransition>
        <div className="member-profile-page">
          <motion.div
            className="member-profile-error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="member-profile-error-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3>Access Denied</h3>
            <p>{error}</p>
            <button className="member-profile-back-btn" onClick={() => navigate("/my-groups")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back to My Groups
            </button>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  const fullName = `${member.first_name || ""} ${member.last_name || ""}`.trim() || member.username;
  const isOwnProfile = currentUser?.username === member.username;
  const roleColor = roleColors[member.role] || "#16a34a";

  return (
    <PageTransition>
      <div className="member-profile-page">
        <motion.div
          className="member-profile-nav"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link to="/my-groups" className="member-profile-back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            My Groups
          </Link>
        </motion.div>

        <motion.div
          className="member-profile-hero"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <div className="member-profile-hero-avatar">
            <img
              src={getAvatarUrl(member.profile)}
              alt={member.username}
              onError={avatarErrorHandler(member.profile)}
            />
          </div>
          <div className="member-profile-hero-info">
            <h1>
              {fullName}
              {isOwnProfile && <span className="own-profile-tag">You</span>}
            </h1>
            <p className="member-profile-username">@{member.username}</p>
            <span
              className="member-profile-role"
              style={{
                background: `${roleColor}18`,
                color: roleColor,
                border: `1px solid ${roleColor}33`,
              }}
            >
              {member.role}
            </span>
          </div>
        </motion.div>

        <div className="member-profile-details">
          <motion.div
            className="member-profile-card"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="member-profile-card-header">
              <h3>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Contact Information
              </h3>
            </div>
            <div className="member-profile-fields">
              <div className="member-profile-field">
                <span className="field-label">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  Email
                </span>
                <span className="field-value">{member.email || "—"}</span>
              </div>
              {member.profile?.phone && (
                <div className="member-profile-field">
                  <span className="field-label">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    Phone
                  </span>
                  <span className="field-value">{member.profile.phone}</span>
                </div>
              )}
              <div className="member-profile-field">
                <span className="field-label">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Username
                </span>
                <span className="field-value">@{member.username}</span>
              </div>
            </div>
          </motion.div>

          {member.profile?.bio && (
            <motion.div
              className="member-profile-card"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <div className="member-profile-card-header">
                <h3>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  Bio
                </h3>
              </div>
              <p className="member-profile-bio">{member.profile.bio}</p>
            </motion.div>
          )}

          {member.groups && member.groups.length > 0 && (
            <motion.div
              className="member-profile-card"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <div className="member-profile-card-header">
                <h3>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-4-4h-4" />
                    <circle cx="17" cy="7" r="3" />
                  </svg>
                  Groups
                </h3>
              </div>
              <div className="member-profile-groups">
                {member.groups.map((g) => (
                  <span key={g.id} className="member-profile-group-chip">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-4-4h-4" />
                      <circle cx="17" cy="7" r="3" />
                    </svg>
                    {g.name}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
