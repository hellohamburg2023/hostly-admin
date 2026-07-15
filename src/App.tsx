import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import { RequireAuth } from './RequireAuth'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const UsersPage = lazy(() => import('./pages/Users'))
const VerificationPage = lazy(() => import('./pages/Verification'))
const EventsPage = lazy(() => import('./pages/Events'))
const ReportsPage = lazy(() => import('./pages/Reports'))
const CategoriesPage = lazy(() => import('./pages/Categories'))
const InterestsPage = lazy(() => import('./pages/Interests'))
const IdeasPage = lazy(() => import('./pages/Ideas'))
const UserDetailPage = lazy(() => import('./pages/UserDetail'))
const EventDetailPage = lazy(() => import('./pages/EventDetail'))
const ReportDetailPage = lazy(() => import('./pages/ReportDetail'))
const SafeWalksPage = lazy(() => import('./pages/SafeWalks'))
const SafeWalkDetailPage = lazy(() => import('./pages/SafeWalkDetail'))
const ProductAnalyticsPage = lazy(() => import('./pages/ProductAnalytics'))
const HealthPage = lazy(() => import('./pages/Health'))
const AuditLogsPage = lazy(() => import('./pages/AuditLogs'))
const PushNotificationsPage = lazy(() => import('./pages/PushNotifications'))

export default function App() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Ansicht wird geladen...</div>}>
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
          <Route path="safe-walks/:id" element={<SafeWalkDetailPage />} />
          <Route path="product-analytics" element={<ProductAnalyticsPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="audit" element={<AuditLogsPage />} />
          <Route path="push-notifications" element={<PushNotificationsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="interests" element={<InterestsPage />} />
          <Route path="ideas" element={<IdeasPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
