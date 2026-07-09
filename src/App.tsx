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
import { RequireAuth } from './RequireAuth'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="verification" element={<VerificationPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="interests" element={<InterestsPage />} />
        <Route path="ideas" element={<IdeasPage />} />
      </Route>
    </Routes>
  )
}
