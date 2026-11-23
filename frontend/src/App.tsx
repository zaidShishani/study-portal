import { Navigate, Route, Routes, useParams, type Params } from 'react-router-dom'
import Layout from './components/Layout'
import { focusUrl } from './hooks/useFocus'
import { useMe } from './hooks/useMe'
import CalendarPage from './pages/CalendarPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import NotesPage from './pages/NotesPage'
import SettingsPage from './pages/SettingsPage'

/** Old section URLs → the home focus view. Ids are validated by useFocus on arrival. */
function Redirect({ to }: { to: (p: Params) => Record<string, string> }) {
  return <Navigate replace to={focusUrl(to(useParams()))} />
}

export default function App() {
  useMe()
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="flashcards" element={<Redirect to={() => ({ focus: 'flashcards' })} />} />
        <Route path="flashcards/review" element={<Redirect to={() => ({ focus: 'flashcards', review: 'all' })} />} />
        <Route path="flashcards/:deckId" element={<Redirect to={(p) => ({ focus: 'flashcards', deck: p.deckId! })} />} />
        <Route
          path="flashcards/:deckId/review"
          element={<Redirect to={(p) => ({ focus: 'flashcards', review: p.deckId! })} />}
        />
        <Route path="leetcode" element={<Redirect to={() => ({ focus: 'leetcode' })} />} />
        <Route path="leetcode/:id" element={<Redirect to={(p) => ({ focus: 'leetcode', problem: p.id! })} />} />
        <Route path="roadmaps" element={<Redirect to={() => ({ focus: 'roadmaps' })} />} />
        <Route path="roadmaps/:id" element={<Redirect to={(p) => ({ focus: 'roadmaps', roadmap: p.id! })} />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
