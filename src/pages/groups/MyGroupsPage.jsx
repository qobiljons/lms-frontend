import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { getAvatarUrl, avatarErrorHandler } from "../../utils/avatar";
import PageTransition from "../../components/PageTransition";
import "./MyGroups.css";

const roleColors = { student: "#16a34a", instructor: "#f59e0b", admin: "#ef4444" };

export default function MyGroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const { data } = await api.get("/groups/my/");
      setGroups(data);
      if (data.length === 1) setExpandedGroup(data[0].id);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (id) => {
    setExpandedGroup(expandedGroup === id ? null : id);
    setSearchTerm("");
  };

  const filterMembers = (group) => {
    const allMembers = [];
    if (group.instructor_detail) {
      allMembers.push({ ...group.instructor_detail, _role: "instructor" });
    }
    (group.students_detail || []).forEach((s) => {
      allMembers.push({ ...s, _role: "student" });
    });

    if (!searchTerm.trim()) return allMembers;
    const q = searchTerm.toLowerCase();
    return allMembers.filter(
      (m) =>
        m.username?.toLowerCase().includes(q) ||
        m.first_name?.toLowerCase().includes(q) ||
        m.last_name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q)
    );
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="mygroups-page">
          <div className="mygroups-loading">
            <div className="mygroups-spinner" />
            <p>Loading your groups...</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="mygroups-page">
        <motion.div
          className="mygroups-header"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <h1>My Groups</h1>
            <p className="mygroups-subtitle">
              {user?.role === "instructor"
                ? "Groups you are instructing"
                : "Groups you belong to"}
            </p>
          </div>
          <div className="mygroups-count-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-4-4h-4" />
              <circle cx="17" cy="7" r="3" />
            </svg>
            {groups.length} {groups.length === 1 ? "Group" : "Groups"}
          </div>
        </motion.div>

        {groups.length === 0 ? (
          <motion.div
            className="mygroups-empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="mygroups-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-4-4h-4" />
                <circle cx="17" cy="7" r="3" />
              </svg>
            </div>
            <h3>No Groups Yet</h3>
            <p>You haven't been assigned to any groups yet. Contact your administrator for group assignment.</p>
          </motion.div>
        ) : (
          <div className="mygroups-list">
            {groups.map((group, index) => {
              const isExpanded = expandedGroup === group.id;
              const members = filterMembers(group);
              const totalMembers = (group.students_detail?.length || 0) + (group.instructor_detail ? 1 : 0);

              return (
                <motion.div
                  key={group.id}
                  className={`mygroup-card ${isExpanded ? "expanded" : ""}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                >
                  <button
                    className="mygroup-card-header"
                    onClick={() => toggleGroup(group.id)}
                  >
                    <div className="mygroup-info">
                      <div className="mygroup-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-4-4h-4" />
                          <circle cx="17" cy="7" r="3" />
                        </svg>
                      </div>
                      <div>
                        <h3>{group.name}</h3>
                        {group.description && (
                          <p className="mygroup-desc">{group.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="mygroup-meta">
                      <span className="mygroup-member-count">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        {totalMembers}
                      </span>
                      <span className="mygroup-course-count">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                        </svg>
                        {group.courses_detail?.length || 0}
                      </span>
                      <motion.svg
                        className="mygroup-chevron"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </motion.svg>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        className="mygroup-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                      >
                        <div className="mygroup-body-inner">
                          {/* Instructor Section */}
                          {group.instructor_detail && (
                            <div className="mygroup-section">
                              <h4 className="mygroup-section-title">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                </svg>
                                Instructor
                              </h4>
                              <Link
                                to={`/members/${group.instructor_detail.username}`}
                                className="mygroup-member instructor-member"
                              >
                                <div className="member-avatar">
                                  <img
                                    src={getAvatarUrl(group.instructor_detail.profile)}
                                    alt={group.instructor_detail.username}
                                    onError={avatarErrorHandler(group.instructor_detail.profile)}
                                  />
                                </div>
                                <div className="member-info">
                                  <span className="member-name">
                                    {group.instructor_detail.first_name} {group.instructor_detail.last_name}
                                  </span>
                                  <span className="member-email">{group.instructor_detail.email}</span>
                                </div>
                                <span
                                  className="member-role-badge"
                                  style={{
                                    background: `${roleColors.instructor}18`,
                                    color: roleColors.instructor,
                                    border: `1px solid ${roleColors.instructor}33`,
                                  }}
                                >
                                  Instructor
                                </span>
                                <svg className="member-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              </Link>
                            </div>
                          )}

                          {/* Students Section */}
                          <div className="mygroup-section">
                            <div className="mygroup-section-header">
                              <h4 className="mygroup-section-title">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                  <circle cx="9" cy="7" r="4" />
                                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                                Students
                                <span className="section-count">{group.students_detail?.length || 0}</span>
                              </h4>
                              {totalMembers > 4 && (
                                <div className="mygroup-search">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                  </svg>
                                  <input
                                    type="text"
                                    placeholder="Search members..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                  />
                                </div>
                              )}
                            </div>

                            {group.students_detail?.length === 0 ? (
                              <p className="mygroup-no-students">No students in this group yet.</p>
                            ) : (
                              <div className="mygroup-members-list">
                                {members
                                  .filter((m) => m._role === "student")
                                  .map((student) => (
                                    <Link
                                      key={student.id}
                                      to={`/members/${student.username}`}
                                      className="mygroup-member"
                                    >
                                      <div className="member-avatar">
                                        <img
                                          src={getAvatarUrl(student.profile)}
                                          alt={student.username}
                                          onError={avatarErrorHandler(student.profile)}
                                        />
                                      </div>
                                      <div className="member-info">
                                        <span className="member-name">
                                          {student.first_name} {student.last_name}
                                        </span>
                                        <span className="member-email">{student.email}</span>
                                      </div>
                                      {student.username === user?.username && (
                                        <span className="member-you-badge">You</span>
                                      )}
                                      <svg className="member-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="9 18 15 12 9 6" />
                                      </svg>
                                    </Link>
                                  ))}
                                {searchTerm && members.filter((m) => m._role === "student").length === 0 && (
                                  <p className="mygroup-no-results">No members match "{searchTerm}"</p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Courses Section */}
                          {group.courses_detail?.length > 0 && (
                            <div className="mygroup-section">
                              <h4 className="mygroup-section-title">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                                </svg>
                                Courses
                                <span className="section-count">{group.courses_detail.length}</span>
                              </h4>
                              <div className="mygroup-courses-list">
                                {group.courses_detail.map((course) => (
                                  <Link
                                    key={course.id}
                                    to={`/courses/${course.slug}`}
                                    className="mygroup-course"
                                  >
                                    <div className="course-thumb">
                                      {course.thumbnail ? (
                                        <img src={course.thumbnail} alt={course.title} />
                                      ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                                        </svg>
                                      )}
                                    </div>
                                    <div className="course-info">
                                      <span className="course-title">{course.title}</span>
                                      {course.description && (
                                        <span className="course-desc">
                                          {course.description.length > 80
                                            ? course.description.slice(0, 80) + "..."
                                            : course.description}
                                        </span>
                                      )}
                                    </div>
                                    <svg className="member-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
