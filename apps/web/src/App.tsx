import { BrowserRouter, Route, Routes } from 'react-router'
import PageEditor from './PageEditor'
import FileList from './pages/FileList'
import PagesToSign from './pages/PagesToSign'
import SignPageView from './pages/SignPageView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FileList />} />
        <Route path="/pages/new" element={<PageEditor />} />
        <Route path="/pages/:pageId" element={<PageEditor />} />
        <Route path="/pages-to-sign" element={<PagesToSign />} />
        <Route path="/pages-to-sign/:pageId" element={<SignPageView />} />
      </Routes>
    </BrowserRouter>
  )
}
