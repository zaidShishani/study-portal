import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useMe } from './hooks/useMe'
import CalendarPage from './pages/CalendarPage'
import FlashcardsPage from './pages/FlashcardsPage'
import LeetCodePage from './pages/LeetCodePage'
import NotFoundPage from './pages/NotFoundPage'
import NotesPage from './pages/NotesPage'
import RoadmapsPage from './pages/RoadmapsPage'
import TodayPage from './pages/TodayPage'

export default function App() {
  useMe()
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<TodayPage />} />
        <Route path="flashcards" element={<FlashcardsPage />} />
        <Route path="leetcode" element={<LeetCodePage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="roadmaps" element={<RoadmapsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
