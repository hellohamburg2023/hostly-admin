import { Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UsersPage from './pages/Users'
import VerificationPage from './pages/Verification'
import EventsPage from './pages/Events'
import ReportsPage from './pages/Reports'
import CategoriesPage from './pages/Categories'
import InterestsPage from './pages/Interests'
import IdeasPage from './pages/Ideas'
import UserDetailPage from './pages/UserDetail'
import EventDetailPage from './pages/EventDetail'
import ReportDetailPage from './pages/ReportDetail'
import SafeWalksPage from './pages/SafeWalks'
import HealthPage from './pages/Health'
import AuditLogsPage from './pages/AuditLogs'
import { RequireAuth } from './RequireAuth'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserDetailPage />} />
        <Route path="verification" element={<VerificationPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/:id" element={<ReportDetailPage />} />
        <Route path="safe-walks" element={<SafeWalksPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="audit" element={<AuditLogsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="interests" element={<InterestsPage />} />
        <Route path="ideas" element={<IdeasPage />} />
      </Route>
    </Routes>
  )
}
