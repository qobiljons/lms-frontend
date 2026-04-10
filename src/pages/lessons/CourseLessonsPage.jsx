import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import PageTransition from "../../components/PageTransition";
import "./Lessons.css";

const lessonCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

export default function CourseLessonsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lessonsLoading, setLessonsLoading] = useState(false);

  const isInstructor = user?.role === "instructor" || user?.role === "admin";

  useEffect(() => {
    const fetchCourse = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/courses/${slug}/`);
        setCourse(data);
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Failed to load course.");
        navigate("/courses");
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [slug, navigate]);

  useEffect(() => {
    if (!course) return;

    const fetchLessons = async () => {
      setLessonsLoading(true);
      try {
        const { data } = await api.get(`/lessons/?course=${course.id}&page_size=100`);
        const lessonsList = Array.isArray(data) ? data : data.results || [];
        setLessons(lessonsList);
      } catch {
        toast.error("Failed to load lessons.");
      } finally {
        setLessonsLoading(false);
      }
    };

    fetchLessons();
  }, [course]);

  if (loading) {
    return (
      <PageTransition>
        <div className="course-lessons-page">
          <div className="lessons-loading">
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

  return (
    <PageTransition>
      <div className="course-lessons-page">
        
        <nav className="breadcrumb">
          <Link to="/courses" className="breadcrumb-link">Courses</Link>
          <span className="breadcrumb-separator">/</span>
          <Link to={`/courses/${course.slug || course.id}`} className="breadcrumb-link">
            {course.title}
          </Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Lessons</span>
        </nav>

        
        <motion.div
          className="course-lessons-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="course-header-content">
            <div className="course-header-left">
              {course.logo && (
                <img src={course.logo} alt={course.title} className="course-header-logo" />
              )}
              <div>
                <h1>{course.title}</h1>
                {course.description && <p className="course-description">{course.description}</p>}
              </div>
            </div>
            <div className="course-header-actions">
              <button
                className="btn-secondary"
                onClick={() => navigate(`/courses/${course.slug || course.id}`)}
              >
                Course Details
              </button>
              {isInstructor && (
                <button
                  className="btn-primary"
                  onClick={() => navigate(`/admin/lessons?course=${course.id}`)}
                >
                  Manage Lessons
                </button>
              )}
            </div>
          </div>
        </motion.div>

        
        <div className="lessons-container">
          <div className="lessons-header">
            <h2>Course Lessons</h2>
            <span className="lessons-count">
              {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
            </span>
          </div>

          {lessonsLoading ? (
            <div className="lessons-loading">
              <div className="spinner"></div>
              <p>Loading lessons...</p>
            </div>
          ) : lessons.length === 0 ? (
            <motion.div
              className="lessons-empty card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <h3>No Lessons Yet</h3>
              <p>
                {isInstructor 
                  ? "Get started by creating your first lesson." 
                  : "Lessons will appear here once they're added to this course."}
              </p>
              {isInstructor && (
                <button
                  className="btn-primary"
                  onClick={() => navigate(`/admin/lessons?course=${course.id}`)}
                  style={{ marginTop: "1rem" }}
                >
                  Create First Lesson
                </button>
              )}
            </motion.div>
          ) : (
            <div className="lessons-grid">
              {lessons.map((lesson, index) => (
                <motion.div
                  key={lesson.id}
                  className="lesson-card card"
                  custom={index}
                  variants={lessonCardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  onClick={() => navigate(`/lessons/${lesson.id}`)}
                >
                  <div className="lesson-card-header">
                    <div className="lesson-number">Lesson {index + 1}</div>
                    {lesson.video_provider === "youtube" && lesson.youtube_url && (
                      <div className="lesson-video-badge">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        Video
                      </div>
                    )}
                  </div>
                  
                  <h3 className="lesson-title">{lesson.title}</h3>
                  
                  {lesson.content && (
                    <p className="lesson-preview">
                      {lesson.content.replace(/<[^>]*>/g, '').substring(0, 120)}...
                    </p>
                  )}

                  <div className="lesson-card-footer">
                    <span className="lesson-date">
                      {new Date(lesson.created_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </span>
                    <span className="lesson-cta">
                      View Lesson
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
