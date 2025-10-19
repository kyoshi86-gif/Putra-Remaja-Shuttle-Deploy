import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SuratJalan from './pages/SuratJalan';
import UangMuka from './pages/UangMuka';
import PremiDriver from './pages/PremiDriver';

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/surat-jalan" element={<SuratJalan />} />
        <Route path="/uang-muka" element={<UangMuka />} />
        <Route path="/premi-driver" element={<PremiDriver />} />
      </Routes>
    </BrowserRouter>
  );
}