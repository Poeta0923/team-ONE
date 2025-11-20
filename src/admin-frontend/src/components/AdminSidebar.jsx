import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImage from '../assets/로고.png';
import { adminLogout, clearTokens } from '../utils/api';
import './AdminSidebar.css';

const AdminSidebar = ({ activeMenu, onMenuChange, isOpen, onClose }) => {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleMenuClick = (item) => {
    onMenuChange(item.id);
    navigate(item.path);
    // 모바일에서 메뉴 클릭 시 사이드바 닫기
    if (onClose) {
      onClose();
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    
    try {
      await adminLogout();
      clearTokens();
      navigate('/login');
    } catch (error) {
      clearTokens();
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const menuItems = [
    { id: 'dashboard', label: '대시보드', icon: '📊', path: '/admin' },
    { id: 'users', label: '회원 관리', icon: '👥', path: '/admin/users' },
    { id: 'projects', label: '프로젝트 관리', icon: '📁', path: '/admin/projects' },
    { id: 'contests', label: '공모전 관리', icon: '🏆', path: '/admin/contests' },
    { id: 'ai', label: 'AI 관리', icon: '🤖', path: '/admin/ai' }
  ];

  return (
    <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src={logoImage} alt="Team ONE Logo" className="sidebar-logo-image" />
          <h2>Team ONE</h2>
        </div>
        <p>관리자 패널</p>
        {/* 모바일에서만 보이는 닫기 버튼 */}
        <button className="sidebar-close-btn" onClick={onClose} aria-label="메뉴 닫기">
          ✕
        </button>
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
        <button 
          className="logout-btn" 
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <span className="logout-icon">🚪</span>
          {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
