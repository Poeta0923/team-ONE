import React from 'react';
import { Link } from 'react-router-dom';
import logoImage from '../assets/로고.png';
import './Navbar.css';

const Navbar = ({ type = 'main' }) => {
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
          <nav className="nav">
            <Link to="/" className="nav-link">홈으로</Link>
            <Link to="/login" className="nav-link logout-btn">로그아웃</Link>
          </nav>
        </div>
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
        <nav className="nav">
          <a href="#about" className="nav-link">서비스 소개</a>
          <a href="#team" className="nav-link">팀원 소개</a>
          <Link to="/login" className="nav-link login-btn">관리자 로그인</Link>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
