import React from "react"
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { useAuth, type UserRole } from "../context/AuthContext"

// Layouts
import { AuthLayout } from "../layouts/AuthLayout"
import { AdminLayout } from "../layouts/AdminLayout"
import { StaffLayout } from "../layouts/StaffLayout"
import { StudentLayout } from "../layouts/StudentLayout"
import { SuperAdminRoute } from "./RoleRoute"

// Feature Components (Lazy Loaded for Performance & Bundle Chunk Splitting)
const Login = React.lazy(() => import("../features/auth/components/Login").then(module => ({ default: module.Login })))
const ForgotPassword = React.lazy(() => import("../features/auth/components/ForgotPassword").then(module => ({ default: module.ForgotPassword })))
const ResetPassword = React.lazy(() => import("../features/auth/components/ResetPassword").then(module => ({ default: module.ResetPassword })))
const ChangePassword = React.lazy(() => import("../features/auth/components/ChangePassword").then(module => ({ default: module.ChangePassword })))
const SessionManagement = React.lazy(() => import("../features/auth/components/SessionManagement").then(module => ({ default: module.SessionManagement })))
const StudentDashboard = React.lazy(() => import("../features/dashboard/components/StudentDashboard").then(module => ({ default: module.StudentDashboard })))
const StudentAttendance = React.lazy(() => import("../features/student/components/StudentAttendance").then(module => ({ default: module.StudentAttendance })))
const StudentTimetable = React.lazy(() => import("../features/student/components/StudentTimetable").then(module => ({ default: module.StudentTimetable })))
const StudentMaterials = React.lazy(() => import("../features/student/components/StudentMaterials").then(module => ({ default: module.StudentMaterials })))
const StudentExams = React.lazy(() => import("../features/student/components/StudentExams").then(module => ({ default: module.StudentExams })))
const StudentNotifications = React.lazy(() => import("../features/student/components/StudentNotifications").then(module => ({ default: module.StudentNotifications })))
const StudentProfile = React.lazy(() => import("../features/student/components/StudentProfile").then(module => ({ default: module.StudentProfile })))
const StudentList = React.lazy(() => import("../features/students/components/StudentList").then(module => ({ default: module.StudentList })))
const StaffList = React.lazy(() => import("../features/staff/components/StaffList").then(module => ({ default: module.StaffList })))
const SubjectList = React.lazy(() => import("../features/subjects/components/SubjectList").then(module => ({ default: module.SubjectList })))
const Timetable = React.lazy(() => import("../features/timetable/components/Timetable").then(module => ({ default: module.Timetable })))
const CaptureAttendance = React.lazy(() => import("../features/attendance/components/CaptureAttendance").then(module => ({ default: module.CaptureAttendance })))
const FaceRecognition = React.lazy(() => import("../features/attendance/components/FaceRecognition").then(module => ({ default: module.FaceRecognition })))
const AttendanceEngine = React.lazy(() => import("../features/attendance/components/AttendanceEngine").then(module => ({ default: module.AttendanceEngine })))
const ReportsView = React.lazy(() => import("../features/reports/components/ReportsView").then(module => ({ default: module.ReportsView })))
const DesignSystem = React.lazy(() => import("../features/dashboard/components/DesignSystem").then(module => ({ default: module.DesignSystem })))
const AnalyticsDashboard = React.lazy(() => import("../features/analytics/components/AnalyticsDashboard").then(module => ({ default: module.AnalyticsDashboard })))
const NotificationManager = React.lazy(() => import("../features/notifications/components/NotificationManager").then(module => ({ default: module.NotificationManager })))
const AdminDashboardEntry = React.lazy(() => import("../features/dashboard/components/AdminDashboardEntry").then(module => ({ default: module.AdminDashboardEntry })))
const FacultyDashboard = React.lazy(() => import("../features/dashboard/components/FacultyDashboard").then(module => ({ default: module.FacultyDashboard })))
const HodManagement = React.lazy(() => import("../features/admin/components/HodManagement").then(module => ({ default: module.HodManagement })))
const AuditLogsView = React.lazy(() => import("../features/admin/components/AuditLogsView").then(module => ({ default: module.AuditLogsView })))
const OrganizationsManagement = React.lazy(() => import("../features/admin/components/OrganizationsManagement").then(module => ({ default: module.OrganizationsManagement })))
const BranchesManagement = React.lazy(() => import("../features/admin/components/BranchesManagement").then(module => ({ default: module.BranchesManagement })))
const SemestersManagement = React.lazy(() => import("../features/admin/components/SemestersManagement").then(module => ({ default: module.SemestersManagement })))
const DepartmentsManagement = React.lazy(() => import("../features/admin/components/DepartmentsManagement").then(module => ({ default: module.DepartmentsManagement })))
const CourseManagement = React.lazy(() => import("../features/lms/components/CourseManagement").then(module => ({ default: module.CourseManagement })))
const StudyMaterialsManagement = React.lazy(() => import("../features/lms/components/StudyMaterialsManagement").then(module => ({ default: module.StudyMaterialsManagement })))
const ExamTimetableManagement = React.lazy(() => import("../features/lms/components/ExamTimetableManagement").then(module => ({ default: module.ExamTimetableManagement })))
const StudentLearningHub = React.lazy(() => import("../features/lms/components/StudentLearningHub").then(module => ({ default: module.StudentLearningHub })))
const ProtectedRoute: React.FC<{ 
  children: React.ReactNode; 
  allowedRoles?: UserRole[] 
}> = ({ 
  children, 
  allowedRoles 
}) => {
  const { user, isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LazyLoadingFallback />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.mustChangePassword && !location.pathname.startsWith("/account/change-password")) {
    return <Navigate to="/account/change-password" replace />
  }

  if (user?.role === "STUDENT" && user?.enrollmentOverdue && !location.pathname.startsWith("/student/profile")) {
    return <Navigate to="/student/profile" replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect users to their appropriate dashboards
    if (["SUPER_ADMIN", "HOD", "PLATFORM_SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"].includes(user.role)) {
      return <Navigate to="/admin/dashboard" replace />
    } else if (user.role === "FACULTY") {
      return <Navigate to="/faculty/dashboard" replace />
    } else {
      return <Navigate to="/student/dashboard" replace />
    }
  }

  return <>{children}</>
}

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) {
    return <LazyLoadingFallback />
  }

  if (isAuthenticated && user) {
    if (["SUPER_ADMIN", "HOD", "PLATFORM_SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"].includes(user.role)) {
      return <Navigate to="/admin/dashboard" replace />
    } else if (user.role === "FACULTY") {
      return <Navigate to="/faculty/dashboard" replace />
    } else {
      return <Navigate to="/student/dashboard" replace />
    }
  }

  return <>{children}</>
}

const LazyLoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] w-full p-8 space-y-4">
    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    <p className="text-gray-400 font-medium text-sm animate-pulse">Loading view components...</p>
  </div>
)

export const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth()
  
  if (loading) {
    return <LazyLoadingFallback />
  }
  
  return (
    <React.Suspense fallback={<LazyLoadingFallback />}>
      <Routes>
        {/* Public Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
          <Route path="/account/change-password" element={<ProtectedRoute><ChangePassword forced /></ProtectedRoute>} />
          <Route path="/account/sessions" element={<ProtectedRoute><SessionManagement /></ProtectedRoute>} />
        </Route>

        {/* Super Admin & HOD Admin Protected Routes */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN", "HOD", "PLATFORM_SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardEntry />} />
          <Route path="hod-management" element={<SuperAdminRoute><HodManagement /></SuperAdminRoute>} />
          <Route path="faculty" element={<StaffList />} />
          <Route path="audit-logs" element={<SuperAdminRoute><AuditLogsView /></SuperAdminRoute>} />
          <Route path="settings" element={<SuperAdminRoute><DesignSystem /></SuperAdminRoute>} />
          <Route path="students" element={<StudentList />} />
          <Route path="departments" element={<SuperAdminRoute><DepartmentsManagement /></SuperAdminRoute>} />
          <Route path="organizations" element={<SuperAdminRoute><OrganizationsManagement /></SuperAdminRoute>} />
          <Route path="branches" element={<SuperAdminRoute><BranchesManagement /></SuperAdminRoute>} />
          <Route path="semesters" element={<SuperAdminRoute><SemestersManagement /></SuperAdminRoute>} />
          <Route path="courses" element={<CourseManagement />} />
          <Route path="materials" element={<StudyMaterialsManagement />} />
          <Route path="exams" element={<ExamTimetableManagement />} />
          <Route path="subjects" element={<SubjectList />} />
          <Route path="timetable" element={<Timetable />} />
          <Route path="attendance" element={<AttendanceEngine />} />
          <Route path="attendance-capture" element={<CaptureAttendance />} />
          <Route path="face-recognition" element={<SuperAdminRoute><FaceRecognition /></SuperAdminRoute>} />
          <Route path="reports" element={<ReportsView />} />
          <Route path="analytics" element={<AnalyticsDashboard />} />
          <Route path="notifications" element={<NotificationManager />} />
        </Route>

        {/* Faculty Protected Routes */}
        <Route 
          path="/faculty" 
          element={
            <ProtectedRoute allowedRoles={["FACULTY"]}>
              <StaffLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/faculty/dashboard" replace />} />
          <Route path="dashboard" element={<FacultyDashboard />} />
          <Route path="students" element={<StudentList />} />
          <Route path="manual" element={<Navigate to="/faculty/students" replace />} />
          <Route path="attendance" element={<AttendanceEngine />} />
          <Route path="manual-attendance" element={<AttendanceEngine />} />
          <Route path="capture" element={<CaptureAttendance />} />
          <Route path="face-recognition" element={<FaceRecognition />} />
          <Route path="materials" element={<StudyMaterialsManagement />} />
          <Route path="exams" element={<ExamTimetableManagement />} />
          <Route path="reports" element={<ReportsView />} />
          <Route path="analytics" element={<AnalyticsDashboard />} />
        </Route>

        {/* Student Protected Routes */}
        <Route 
          path="/student" 
          element={
            <ProtectedRoute allowedRoles={["STUDENT"]}>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/student/dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="attendance" element={<StudentAttendance />} />
          <Route path="timetable" element={<StudentTimetable />} />
          <Route path="materials" element={<StudentMaterials />} />
          <Route path="exams" element={<StudentExams />} />
          <Route path="notifications" element={<StudentNotifications />} />
          <Route path="profile" element={<StudentProfile />} />
          <Route path="learning" element={<StudentLearningHub />} />
        </Route>

        {/* Catch-all redirect */}
        <Route 
          path="*" 
          element={
            <Navigate 
              to={
                user 
                  ? (["SUPER_ADMIN", "HOD", "PLATFORM_SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"].includes(user.role)
                      ? "/admin/dashboard" 
                      : (user.role === "FACULTY" ? "/faculty/dashboard" : "/student/dashboard"))
                  : "/login"
              } 
              replace 
            />
          }
        />
      </Routes>
    </React.Suspense>
  )
}
