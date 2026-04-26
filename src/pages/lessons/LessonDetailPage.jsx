import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import PageTransition from "../../components/PageTransition";
import "./Lessons.css";

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^&?\/\s]+)/);
  return match?.[1] ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export default function LessonDetailPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lesson, setLesson] = useState(null);
  const [siblings, setSiblings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const run = async () => {
      try {
        const { data: lessonData } = await api.get(`/lessons/${lessonId}/`);
        if (cancelled) return;
        setLesson(lessonData);

        const courseId = lessonData.course;
        if (courseId != null) {
          try {
            const { data: lessonsRes } = await api.get(`/lessons/?course=${courseId}&page_size=200`);
            const list = Array.isArray(lessonsRes?.results) ? lessonsRes.results : (Array.isArray(lessonsRes) ? lessonsRes : []);
            if (!cancelled) {
              const sorted = [...list].sort((a, b) => {
                const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
                const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
                return aDate - bDate;
              });
              setSiblings(sorted);
            }
          } catch {
            if (!cancelled) setSiblings([lessonData]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err?.response?.data?.detail || "Failed to load lesson.";
          toast.error(msg, { toastId: `lesson-load-${lessonId}` });
          navigate(-1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [lessonId, navigate]);

  const { currentIndex, prevLesson, nextLesson } = useMemo(() => {
    const idx = siblings.findIndex((l) => String(l.id) === String(lessonId));
    return {
      currentIndex: idx,
      prevLesson: idx > 0 ? siblings[idx - 1] : null,
      nextLesson: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null,
    };
  }, [siblings, lessonId]);

  if (loading) {
    return (
      <PageTransition>
        <div className="lp-page">
          <div className="lp-loading">
            <div className="lp-spinner" />
            <p>Loading lesson...</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!lesson) return null;

  const embedUrl = getYouTubeEmbedUrl(lesson.youtube_url);
  const courseSlug = lesson.course_slug || lesson.course;
  const courseTitle = lesson.course_title || "Course";

  return (
    <PageTransition>
      <div className="lp-page">
        <header className="lp-topbar">
          <div className="lp-topbar-left">
            <button
              className="lp-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? "Hide lessons" : "Show lessons"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {sidebarOpen ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>}
              </svg>
            </button>
            <Link to="/courses" className="lp-crumb">Courses</Link>
            <span className="lp-crumb-sep">/</span>
            <Link to={`/courses/${courseSlug}`} className="lp-crumb">{courseTitle}</Link>
          </div>
          <div className="lp-topbar-right">
            {currentIndex >= 0 && (
              <span className="lp-progress">
                Lesson {currentIndex + 1} of {siblings.length}
              </span>
            )}
          </div>
        </header>

        <div className="lp-body">
          {sidebarOpen && (
            <aside className="lp-sidebar">
              <div className="lp-sidebar-head">
                <h3 className="lp-sidebar-title">Course Lessons</h3>
                <span className="lp-sidebar-count">{siblings.length}</span>
              </div>
              <div className="lp-lesson-list">
                {siblings.map((l, i) => {
                  const active = String(l.id) === String(lessonId);
                  return (
                    <Link
                      key={l.id}
                      to={`/lessons/${l.id}`}
                      className={`lp-lesson-item ${active ? "active" : ""}`}
                    >
                      <span className="lp-lesson-num">{String(i + 1).padStart(2, "0")}</span>
                      <span className="lp-lesson-title">{l.title}</span>
                      {l.youtube_url && (
                        <svg className="lp-lesson-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      )}
                    </Link>
                  );
                })}
              </div>
            </aside>
          )}

          <main className="lp-main">
            <motion.div
              key={lessonId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              <div className="lp-title-row">
                <h1 className="lp-title">{lesson.title}</h1>
              </div>

              {embedUrl ? (
                <div className="lp-video-wrap">
                  <iframe
                    src={embedUrl}
                    title={lesson.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="lp-no-video">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                  <span>No video for this lesson</span>
                </div>
              )}

              <div className="lp-content-card">
                <h2 className="lp-section-title">About this lesson</h2>
                <div
                  className="lp-content"
                  dangerouslySetInnerHTML={{ __html: lesson.content || "<p>No content available.</p>" }}
                />
              </div>

              <div className="lp-nav">
                <button
                  className="lp-nav-btn"
                  onClick={() => navigate(`/lessons/${prevLesson.id}`)}
                  disabled={!prevLesson}
                  title={prevLesson?.title}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  <span className="lp-nav-text">
                    <span className="lp-nav-label">Previous</span>
                    {prevLesson && <span className="lp-nav-sub">{prevLesson.title}</span>}
                  </span>
                </button>
                <button
                  className="lp-nav-btn lp-nav-next"
                  onClick={() => navigate(`/lessons/${nextLesson.id}`)}
                  disabled={!nextLesson}
                  title={nextLesson?.title}
                >
                  <span className="lp-nav-text">
                    <span className="lp-nav-label">Next</span>
                    {nextLesson && <span className="lp-nav-sub">{nextLesson.title}</span>}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </motion.div>
          </main>
        </div>
      </div>
    </PageTransition>
  );
}
