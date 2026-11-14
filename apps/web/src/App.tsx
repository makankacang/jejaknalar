import './shared-ui/styles/design-tokens.css';
import './shared-ui/styles/teacher.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import LandingPage from './pages/LandingPage';
import PublicDemoPage from './pages/PublicDemoPage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import TeacherLoginPage from './pages/TeacherLoginPage';
import TeacherForgotPasswordPage from './pages/TeacherForgotPasswordPage';
import TeacherResetPasswordPage from './pages/TeacherResetPasswordPage';
import TeacherModulesPage from './pages/TeacherModulesPage';
import TeacherModulePreviewPage from './pages/TeacherModulePreviewPage';
import StudentPlaceholderPage from './pages/StudentPlaceholderPage';
import NotFoundPage from './pages/NotFoundPage';
import TeacherModuleUploadPage from './pages/TeacherModuleUploadPage';
import TopNavLayout from './shared-ui/layouts/TopNavLayout';
import { AuthProvider } from './lib/auth/AuthProvider';
import ProtectedRoute from './lib/auth/ProtectedRoute';
import TeacherLearningObjectivesPage from './pages/TeacherLearningObjectivesPage';

// Lazy loaded so the Phaser preview does not enter the initial landing/teacher bundle.
const StudentDemoPage = lazy(() => import('./pages/StudentDemoPage'));

export default function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/demo" element={<PublicDemoPage />} />
          <Route path="/demo/play" element={<Suspense fallback={<p role="status">Memuat demo game...</p>}><StudentDemoPage /></Suspense>} />
          <Route path="/login" element={<TeacherLoginPage />} />
          <Route path="/forgot-password" element={<TeacherForgotPasswordPage />} />
          <Route path="/reset-password" element={<TeacherResetPasswordPage />} />

          {/* Protected teacher routes */}
          <Route
            element={
              <ProtectedRoute>
                <TopNavLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/teacher"
              element={<TeacherDashboardPage />}
            />

            <Route
              path="/teacher/modules"
              element={<TeacherModulesPage />}
            />

            <Route
              path="/teacher/modules/upload"
              element={<TeacherModuleUploadPage />}
            />

            <Route
              path="/teacher/modules/review"
              element={<TeacherLearningObjectivesPage />}
            />

            <Route
              path="/teacher/modules/:moduleId/preview"
              element={<TeacherModulePreviewPage />}
            />
          </Route>

          {/* Student routes */}
          <Route
            path="/student/join"
            element={<StudentPlaceholderPage />}
          />

          {/* Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
