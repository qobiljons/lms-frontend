import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTheme } from "./context/ThemeContext";

import Navbar from "./components/Navbar";
import AppLayout from "./components/AppLayout";
import { ProtectedRoute, RoleRoute, GuestRoute } from "./components/ProtectedRoute";

import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import UserListPage from "./pages/admin/UserListPage";
import CreateUserPage from "./pages/admin/CreateUserPage";
import UserDetailPage from "./pages/admin/UserDetailPage";
import AdminCoursesPage from "./pages/admin/AdminCoursesPage";
import AdminLessonsPage from "./pages/admin/AdminLessonsPage";
import AdminGroupsPage from "./pages/admin/AdminGroupsPage";
import ProfilePage from "./pages/profile/ProfilePage";
import CourseListPage from "./pages/courses/CourseListPage";
import CourseDetailPage from "./pages/courses/CourseDetailPage";
import CourseLessonsPage from "./pages/lessons/CourseLessonsPage";
import LessonDetailPage from "./pages/lessons/LessonDetailPage";
import MyGroupsPage from "./pages/groups/MyGroupsPage";
import MemberProfilePage from "./pages/groups/MemberProfilePage";
import AdminFinancePage from "./pages/admin/AdminFinancePage";
import BillingPage from "./pages/billing/BillingPage";
import PaymentsPage from "./pages/payments/PaymentsPage";
import AttendanceManagePage from "./pages/attendance/AttendanceManagePage";
import AttendanceMyPage from "./pages/attendance/AttendanceMyPage";
import MessagingPage from "./pages/messaging/MessagingPage";
import TutorPage from "./pages/tutor/TutorPage";

function App() {
  const location = useLocation();
  const { theme } = useTheme();

  return (
    <>
      <Navbar />
      <AppLayout>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/login"
              element={
                <GuestRoute>
                  <LoginPage />
                </GuestRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <GuestRoute>
                  <SignupPage />
                </GuestRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/courses"
              element={
                <ProtectedRoute>
                  <CourseListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/courses/:slug"
              element={
                <ProtectedRoute>
                  <CourseDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/courses/:slug/lessons"
              element={
                <ProtectedRoute>
                  <CourseLessonsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lessons/:lessonId"
              element={
                <ProtectedRoute>
                  <LessonDetailPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/my-groups"
              element={
                <ProtectedRoute>
                  <MyGroupsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/members/:username"
              element={
                <ProtectedRoute>
                  <MemberProfilePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/payments"
              element={
                <ProtectedRoute>
                  <PaymentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <ProtectedRoute>
                  <BillingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance/my"
              element={
                <RoleRoute roles={["student"]}>
                  <AttendanceMyPage />
                </RoleRoute>
              }
            />
            <Route
              path="/tutor"
              element={
                <RoleRoute roles={["student"]}>
                  <TutorPage />
                </RoleRoute>
              }
            />
            <Route
              path="/attendance"
              element={
                <RoleRoute roles={["admin", "instructor", "teacher"]}>
                  <AttendanceManagePage />
                </RoleRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <MessagingPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/finance"
              element={
                <RoleRoute roles={["admin"]}>
                  <AdminFinancePage />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/groups"
              element={
                <RoleRoute roles={["admin"]}>
                  <AdminGroupsPage />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/courses"
              element={
                <RoleRoute roles={["admin", "instructor", "teacher"]}>
                  <AdminCoursesPage />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/lessons"
              element={
                <RoleRoute roles={["admin", "instructor", "teacher"]}>
                  <AdminLessonsPage />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RoleRoute roles={["admin"]}>
                  <UserListPage />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/users/create"
              element={
                <RoleRoute roles={["admin"]}>
                  <CreateUserPage />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/users/:username"
              element={
                <RoleRoute roles={["admin"]}>
                  <UserDetailPage />
                </RoleRoute>
              }
            />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AnimatePresence>
      </AppLayout>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme={theme}
        hideProgressBar={false}
        toastStyle={{
          background: theme === "dark" ? "rgba(30, 30, 30, 0.95)" : "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          border: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
          borderRadius: "12px",
          color: theme === "dark" ? "#f3f4f6" : "#111827",
          boxShadow: theme === "dark" ? "0 4px 24px rgba(0, 0, 0, 0.4)" : "0 4px 24px rgba(0, 0, 0, 0.08)",
        }}
      />
    </>
  );
}

export default App;
