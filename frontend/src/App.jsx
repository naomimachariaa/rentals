import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandlordDashboard from './pages/LandlordDashboard';
import TenantDashboard from './pages/TenantDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/landlord" replace />} />
        <Route path="/landlord" element={<LandlordDashboard />} />
        <Route path="/tenant" element={<TenantDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}