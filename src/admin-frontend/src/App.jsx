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
import './App.css';

function App() {
  return (
    <div className="App">
      <Routes>
        {/* 메인 페이지 */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        
        {/* 관리자 페이지 */}
        <Route path="/admin" element={<DashboardPage />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/users/report-detail/:userId" element={<ReportDetailPage />} />
        <Route path="/admin/projects" element={<ProjectsPage />} />
        <Route path="/admin/contests" element={<ContestsPage />} />
        <Route path="/admin/ai" element={<AIPage />} />
      </Routes>
    </div>
  );
}

export default App;
