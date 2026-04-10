import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import PageTransition from "../../components/PageTransition";
import "./Courses.css";

export default function CourseDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lessonCount, setLessonCount] = useState(0);
  const [purchasing, setPurchasing] = useState(false);

  const isAdmin = user?.role === "admin";
  const isInstructor = user?.role === "instructor" || user?.role === "teacher";
  const isStudent = user?.role === "student";

  useEffect(() => {
    const fetchCourse = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/courses/${slug}/`);
        setCourse(data);
        
        try {
          const lessonsRes = await api.get(`/lessons/?course=${data.id}&page_size=1`);
          setLessonCount(lessonsRes.data.count || 0);
        } catch {
          setLessonCount(0);
        }
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Failed to load course.");
        navigate("/courses");
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [slug, navigate]);

  const handlePurchase = async () => {
    if (!course) return;
    
    setPurchasing(true);
    try {
      const { data } = await api.post("/payments/create-checkout/", {
        course_id: course.id,
      });
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to initiate purchase.");
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="course-detail-page">
          <div className="course-loading">
            <div className="spinner"></div>
            <p>Loading course...</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!course) {
    return null;
  }

  const needsPurchase = isStudent && !course.is_accessible && course.price > 0;
  const isFree = course.price === 0;
  const hasAccess = course.is_accessible || isAdmin || isInstructor;

  return (
    <PageTransition>
      <div className="course-detail-page">
        
        <nav className="breadcrumb">
          <Link to="/courses" className="breadcrumb-link">Courses</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{course.title}</span>
        </nav>

        
        <motion.div
          className="course-hero"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="course-hero-content">
            <div className="course-hero-left">
              {course.logo && (
                <img src={course.logo} alt={course.title} className="course-hero-logo" />
              )}
              <div>
                <h1>{course.title}</h1>
                {course.description && (
                  <p className="course-hero-description">{course.description}</p>
                )}
                
                <div className="course-meta">
                  <span className="course-meta-item">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    {lessonCount} Lesson{lessonCount !== 1 ? "s" : ""}
                  </span>
                  
                  <span className="course-meta-item">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    {new Date(course.created_at).toLocaleDateString()}
                  </span>

                  <span className={`course-price-badge ${isFree ? 'free' : 'paid'}`}>
                    {isFree ? 'Free' : `$${Number(course.price).toFixed(2)}`}
                  </span>

                  {!isFree && course.is_purchased && (
                    <span className="course-status-badge purchased">
                      ✓ Owned
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="course-hero-actions">
              {hasAccess ? (
                <button
                  className="btn-primary btn-lg"
                  onClick={() => navigate(`/courses/${slug}/lessons`)}
                >
                  View Lessons →
                </button>
              ) : needsPurchase ? (
                <button
                  className="btn-primary btn-lg"
                  onClick={handlePurchase}
                  disabled={purchasing}
                >
                  {purchasing ? "Processing..." : `Purchase for $${Number(course.price).toFixed(2)}`}
                </button>
              ) : (
                <button className="btn-secondary btn-lg" disabled>
                  Not Available
                </button>
              )}

              {(isAdmin || isInstructor) && (
                <button
                  className="btn-secondary"
                  onClick={() => navigate(`/admin/courses`)}
                >
                  Manage Course
                </button>
              )}
            </div>
          </div>
        </motion.div>

        
        <motion.div
          className="course-stats-grid"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              </svg>
            </div>
            <div>
              <div className="stat-value">{lessonCount}</div>
              <div className="stat-label">Total Lessons</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
            <div>
              <div className="stat-value">{isFree ? 'Free' : 'Premium'}</div>
              <div className="stat-label">Course Type</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <div className="stat-value">{hasAccess ? 'Enrolled' : 'Available'}</div>
              <div className="stat-label">Status</div>
            </div>
          </div>
        </motion.div>

        
        <motion.div
          className="course-about card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <h2>About This Course</h2>
          <p>
            {course.description || "This course provides comprehensive learning materials to help you master the subject."}
          </p>
          
          {lessonCount > 0 && (
            <div className="course-cta">
              <p>Ready to start learning?</p>
              {hasAccess ? (
                <button
                  className="btn-primary"
                  onClick={() => navigate(`/courses/${slug}/lessons`)}
                >
                  Start Learning
                </button>
              ) : needsPurchase ? (
                <button
                  className="btn-primary"
                  onClick={handlePurchase}
                  disabled={purchasing}
                >
                  {purchasing ? "Processing..." : "Enroll Now"}
                </button>
              ) : null}
            </div>
          )}
        </motion.div>

        
        <motion.div
          className="course-navigation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <button className="btn-secondary" onClick={() => navigate("/courses")}>
            ← Back to Courses
          </button>
        </motion.div>
      </div>
    </PageTransition>
  );
}
