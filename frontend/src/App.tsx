import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useMe } from './hooks/useMe'
import CalendarPage from './pages/CalendarPage'
import DeckPage from './pages/DeckPage'
import FlashcardsPage from './pages/FlashcardsPage'
import LeetCodePage from './pages/LeetCodePage'
import NotFoundPage from './pages/NotFoundPage'
import NotesPage from './pages/NotesPage'
import ProblemPage from './pages/ProblemPage'
import ReviewPage from './pages/ReviewPage'
import RoadmapPage from './pages/RoadmapPage'
import RoadmapsPage from './pages/RoadmapsPage'
import SettingsPage from './pages/SettingsPage'
import TodayPage from './pages/TodayPage'

export default function App() {
  useMe()
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<TodayPage />} />
        <Route path="flashcards" element={<FlashcardsPage />} />
        <Route path="flashcards/review" element={<ReviewPage />} />
        <Route path="flashcards/:deckId" element={<DeckPage />} />
        <Route path="flashcards/:deckId/review" element={<ReviewPage />} />
        <Route path="leetcode" element={<LeetCodePage />} />
        <Route path="leetcode/:problemId" element={<ProblemPage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="roadmaps" element={<RoadmapsPage />} />
        <Route path="roadmaps/:roadmapId" element={<RoadmapPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
