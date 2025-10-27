import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/main/HomePage';
import LoginPage from './pages/main/LoginPage';
import DashboardPage from './pages/admin/dashboard/DashboardPage';
import UsersPage from './pages/admin/users/UsersPage';
import ReportDetailPage from './pages/admin/users/ReportDetailPage';
import ProjectsPage from './pages/admin/projects/ProjectsPage';
import ContestsPage from './pages/admin/contests/ContestsPage';
import AIPage from './pages/admin/ai/AIPage';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        
        <Route path="/admin" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
        <Route path="/admin/users/report-detail/:userId" element={<ProtectedRoute><ReportDetailPage /></ProtectedRoute>} />
        <Route path="/admin/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
        <Route path="/admin/contests" element={<ProtectedRoute><ContestsPage /></ProtectedRoute>} />
        <Route path="/admin/ai" element={<ProtectedRoute><AIPage /></ProtectedRoute>} />
      </Routes>
    </div>
  );
}

export default App;
