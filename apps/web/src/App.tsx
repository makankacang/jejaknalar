import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import PublicDemoPage from './pages/PublicDemoPage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import TeacherLoginPage from './pages/TeacherLoginPage';
import TeacherModulesPage from './pages/TeacherModulesPage';
import TeacherModulePreviewPage from './pages/TeacherModulePreviewPage';
import StudentPlaceholderPage from './pages/StudentPlaceholderPage';
import NotFoundPage from './pages/NotFoundPage';
import TeacherModuleUploadPage from './pages/TeacherModuleUploadPage';
import TopNavLayout from './shared-ui/layouts/TopNavLayout';
import { AuthProvider } from './lib/auth/AuthProvider';
import ProtectedRoute from './lib/auth/ProtectedRoute';
import TeacherLearningObjectivesPage from './pages/TeacherLearningObjectivesPage';

export default function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/demo" element={<PublicDemoPage />} />
          <Route path="/login" element={<TeacherLoginPage />} />

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
