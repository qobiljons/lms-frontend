import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import PageTransition from "../../components/PageTransition";
import "./Lessons.css";

export default function LessonDetailPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [homework, setHomework] = useState([]);
  const [loadingHomework, setLoadingHomework] = useState(false);

  useEffect(() => {
    const fetchLesson = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/lessons/${lessonId}/`);
        setLesson(data);
        
        if (user?.role === "student" || user?.role === "instructor" || user?.role === "admin") {
          fetchHomework();
        }
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Failed to load lesson.");
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };

    const fetchHomework = async () => {
      setLoadingHomework(true);
      try {
        const { data } = await api.get(`/homework/?lesson=${lessonId}`);
        setHomework(Array.isArray(data) ? data : data.results || []);
      } catch {
      } finally {
        setLoadingHomework(false);
      }
    };

    fetchLesson();
  }, [lessonId, navigate, user?.role]);

  if (loading) {
    return (
      <PageTransition>
        <div className="lesson-detail-page">
          <div className="lesson-loading">
            <div className="spinner"></div>
            <p>Loading lesson...</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!lesson) {
    return null;
  }

  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    const videoId = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^&?\/\s]+)/)?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  const embedUrl = getYouTubeEmbedUrl(lesson.youtube_url);

  return (
    <PageTransition>
      <div className="lesson-detail-page">
        
        <nav className="breadcrumb">
          <Link to="/courses" className="breadcrumb-link">Courses</Link>
          <span className="breadcrumb-separator">/</span>
          <Link to={`/courses/${lesson.course_slug || lesson.course}`} className="breadcrumb-link">
            {lesson.course_title || "Course"}
          </Link>
          <span className="breadcrumb-separator">/</span>
          <Link to={`/courses/${lesson.course_slug || lesson.course}/lessons`} className="breadcrumb-link">
            Lessons
          </Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{lesson.title}</span>
        </nav>

        
        <motion.div
          className="lesson-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="lesson-header-content">
            <h1>{lesson.title}</h1>
            <div className="lesson-meta">
              <span className="lesson-meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                </svg>
                {lesson.course_title}
              </span>
              {lesson.created_at && (
                <span className="lesson-meta-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {new Date(lesson.created_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        
        {embedUrl && (
          <motion.div
            className="lesson-video-section card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="video-container">
              <iframe
                src={embedUrl}
                title={lesson.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </motion.div>
        )}

        
        <motion.div
          className="lesson-content-section card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <h2>Lesson Content</h2>
          <div className="lesson-content" dangerouslySetInnerHTML={{ __html: lesson.content || "<p>No content available.</p>" }} />
        </motion.div>

        
        {homework.length > 0 && (
          <motion.div
            className="lesson-homework-section card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <h2>Homework</h2>
            <div className="homework-list">
              {homework.map((hw) => (
                <div key={hw.id} className="homework-item">
                  <div className="homework-item-header">
                    <h3>{hw.title}</h3>
                    <span className="homework-points">{hw.total_points} points</span>
                  </div>
                  <p className="homework-description">{hw.description}</p>
                  {hw.due_date && (
                    <p className="homework-due">
                      Due: {new Date(hw.due_date).toLocaleString()}
                    </p>
                  )}
                  {hw.submission_status && (
                    <div className="homework-status">
                      Status: <span className={`status-badge status-${hw.submission_status.status}`}>
                        {hw.submission_status.status}
                      </span>
                      {hw.submission_status.score && (
                        <span className="homework-score">
                          Score: {hw.submission_status.score}/{hw.total_points}
                        </span>
                      )}
                    </div>
                  )}
                  <button
                    className="btn-primary"
                    onClick={() => navigate(`/homework/${hw.id}`)}
                  >
                    {hw.submission_status ? "View Submission" : "Start Homework"}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        
        <motion.div
          className="lesson-navigation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <button
            className="btn-secondary"
            onClick={() => navigate(`/courses/${lesson.course_slug || lesson.course}/lessons`)}
          >
            ← Back to Lessons
          </button>
        </motion.div>
      </div>
    </PageTransition>
  );
}
