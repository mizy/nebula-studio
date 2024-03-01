import { Routes, Route, Navigate } from 'react-router-dom';
import PageLayout from '@/components/PageLayout';
import Welcome from '@/pages/Welcome';
import Console from '@/pages/Console';
import Login from '@/pages/Login';
import GraphType from '@/pages/GraphType';
import Importer from '@/pages/Importer';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<PageLayout />}>
        <Route path="welcome" element={<Welcome />} />
        <Route path="console" element={<Console />} />
        <Route path="graphType" element={<GraphType />} />
        <Route path="importer" element={<Importer />} />
        <Route path="*" element={<Navigate replace to="console" />} />
      </Route>
    </Routes>
  );
}
