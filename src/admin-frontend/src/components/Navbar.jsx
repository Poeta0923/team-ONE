import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import logoImage from '../assets/로고.png';
import './Navbar.css';

const Navbar = ({ type = 'main' }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  if (type === 'admin') {
    return (
      <header className="navbar admin-navbar">
        <div className="container">
          <div className="logo">
            <Link to="/admin">
              <img src={logoImage} alt="Team ONE Logo" className="logo-image" />
              <h1>Team ONE</h1>
            </Link>
            <span className="admin-badge">관리자</span>
          </div>
          
          <button className="hamburger-menu" onClick={toggleMobileMenu} aria-label="메뉴 열기">
            <span></span>
            <span></span>
            <span></span>
          </button>

          <nav className={`nav ${mobileMenuOpen ? 'mobile-open' : ''}`}>
            <Link to="/" className="nav-link" onClick={closeMobileMenu}>홈으로</Link>
            <Link to="/login" className="nav-link logout-btn" onClick={closeMobileMenu}>로그아웃</Link>
          </nav>
        </div>
        
        {mobileMenuOpen && <div className="nav-overlay" onClick={closeMobileMenu}></div>}
      </header>
    );
  }

  return (
    <header className="navbar main-navbar">
      <div className="container">
        <div className="logo">
          <Link to="/">
            <img src={logoImage} alt="Team ONE Logo" className="logo-image" />
            <h1>Team ONE</h1>
          </Link>
        </div>
        
        <button className="hamburger-menu" onClick={toggleMobileMenu} aria-label="메뉴 열기">
          <span></span>
          <span></span>
          <span></span>
        </button>

        <nav className={`nav ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <a href="#about" className="nav-link" onClick={closeMobileMenu}>서비스 소개</a>
          <a href="#team" className="nav-link" onClick={closeMobileMenu}>팀원 소개</a>
          <Link to="/login" className="nav-link login-btn" onClick={closeMobileMenu}>관리자 로그인</Link>
        </nav>
      </div>
      
      {mobileMenuOpen && <div className="nav-overlay" onClick={closeMobileMenu}></div>}
    </header>
  );
};

export default Navbar;
