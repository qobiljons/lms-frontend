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
  const [firstLessonId, setFirstLessonId] = useState(null);
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
          const lessonsRes = await api.get(`/lessons/?course=${data.id}&page_size=200`);
          const list = Array.isArray(lessonsRes.data?.results) ? lessonsRes.data.results : (Array.isArray(lessonsRes.data) ? lessonsRes.data : []);
          setLessonCount(lessonsRes.data?.count ?? list.length);
          if (list.length) {
            const sorted = [...list].sort((a, b) => {
              const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
              const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
              return aDate - bDate;
            });
            setFirstLessonId(sorted[0].id);
          }
        } catch {
          setLessonCount(0);
        }
      } catch (err) {
        const msg = err?.response?.data?.detail || "Failed to load course.";
        toast.error(msg, { toastId: `course-load-${slug}` });
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
      <div className="cd-page">
        <Link to="/courses" className="cd-back">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          All courses
        </Link>

        <motion.div
          className="cd-hero"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {course.logo && <img src={course.logo} alt="" className="cd-logo" />}
          <h1 className="cd-title">{course.title}</h1>
          {course.description && <p className="cd-description">{course.description}</p>}

          <div className="cd-meta">
            <span className="cd-meta-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              {lessonCount} lesson{lessonCount !== 1 ? "s" : ""}
            </span>
            {!isAdmin && !isInstructor && course.is_purchased && (
              <span className="cd-meta-item cd-meta-owned">✓ Owned</span>
            )}
            {!isAdmin && !isInstructor && !course.is_purchased && isFree && (
              <span className="cd-meta-item cd-meta-free">Free</span>
            )}
            {!isAdmin && !isInstructor && !course.is_purchased && !isFree && (
              <span className="cd-meta-item cd-meta-price">${Number(course.price).toFixed(2)}</span>
            )}
          </div>

          <div className="cd-actions">
            {hasAccess ? (
              <button
                className="cd-btn-primary"
                onClick={() => navigate(firstLessonId ? `/lessons/${firstLessonId}` : `/courses/${slug}/lessons`)}
              >
                {firstLessonId ? "Start Learning →" : "View Lessons →"}
              </button>
            ) : needsPurchase ? (
              <button
                className="cd-btn-primary"
                onClick={handlePurchase}
                disabled={purchasing}
              >
                {purchasing ? "Processing..." : `Buy for $${Number(course.price).toFixed(2)}`}
              </button>
            ) : (
              <button className="cd-btn-primary" disabled>Not Available</button>
            )}
            {(isAdmin || isInstructor) && (
              <button
                className="cd-btn-ghost"
                onClick={() => navigate(`/admin/courses`)}
              >
                Manage
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
}
