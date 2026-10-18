import { BrowserRouter, Route, Routes } from 'react-router'
import PageEditor from './PageEditor'
import FileList from './pages/FileList'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FileList />} />
        <Route path="/pages/new" element={<PageEditor />} />
        <Route path="/pages/:pageId" element={<PageEditor />} />
      </Routes>
    </BrowserRouter>
  )
}
