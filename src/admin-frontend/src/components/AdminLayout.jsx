import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import './AdminLayout.css';

const AdminLayout = ({ children }) => {
  const location = useLocation();
  const [currentMenu, setCurrentMenu] = useState('dashboard');

  // 현재 경로에 따라 activeMenu 설정
  useEffect(() => {
    const path = location.pathname;
    if (path === '/admin' || path === '/admin/') {
      setCurrentMenu('dashboard');
    } else if (path.startsWith('/admin/users')) {
      setCurrentMenu('users');
    } else if (path.startsWith('/admin/projects')) {
      setCurrentMenu('projects');
    } else if (path.startsWith('/admin/contests')) {
      setCurrentMenu('contests');
    } else if (path.startsWith('/admin/ai')) {
      setCurrentMenu('ai');
    } else {
      // 기본값은 대시보드
      setCurrentMenu('dashboard');
    }
  }, [location.pathname]);

  const menuItems = [
    { id: 'dashboard', label: '대시보드' },
    { id: 'users', label: '회원 관리' },
    { id: 'projects', label: '프로젝트 관리' },
    { id: 'contests', label: '공모전 관리' },
    { id: 'ai', label: 'AI 관리' }
  ];

  return (
    <div className="admin-layout">
      {/* 사이드바 */}
      <AdminSidebar 
        activeMenu={currentMenu} 
        onMenuChange={setCurrentMenu} 
      />

      {/* 메인 콘텐츠 */}
      <main className="main-content">
        <header className="content-header">
          <h1>{menuItems.find(item => item.id === currentMenu)?.label}</h1>
          <div className="user-info">
            <span>관리자님, 안녕하세요!</span>
          </div>
        </header>
        
        <div className="content-body">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
