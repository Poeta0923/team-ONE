import React from 'react';
import { useNavigate } from 'react-router-dom';
import logoImage from '../assets/로고.png';
import { clearTokens } from '../utils/api';
import './AdminSidebar.css';

const AdminSidebar = ({ activeMenu, onMenuChange }) => {
  const navigate = useNavigate();

  const handleMenuClick = (item) => {
    onMenuChange(item.id);
    navigate(item.path);
  };

  const handleLogout = () => {
    // 토큰 제거
    clearTokens();
    // 로그인 페이지로 이동
    navigate('/login');
  };

  const menuItems = [
    { id: 'dashboard', label: '대시보드', icon: '📊', path: '/admin' },
    { id: 'users', label: '회원 관리', icon: '👥', path: '/admin/users' },
    { id: 'projects', label: '프로젝트 관리', icon: '📁', path: '/admin/projects' },
    { id: 'contests', label: '공모전 관리', icon: '🏆', path: '/admin/contests' },
    { id: 'ai', label: 'AI 관리', icon: '🤖', path: '/admin/ai' }
  ];

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src={logoImage} alt="Team ONE Logo" className="sidebar-logo-image" />
          <h2>Team ONE</h2>
        </div>
        <p>관리자 패널</p>
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeMenu === item.id ? 'active' : ''}`}
            onClick={() => handleMenuClick(item)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={handleLogout}>
          <span className="logout-icon">🚪</span>
          로그아웃
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
