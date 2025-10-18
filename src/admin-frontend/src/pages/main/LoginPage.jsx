import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImage from '../../assets/로고.png';
import './LoginPage.css';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // 임시 로그인 로직 (실제 API 연동 전)
    if (formData.username === 'admin' && formData.password === 'admin123') {
      // 로그인 성공 시 관리자 페이지로 이동
      navigate('/admin');
    } else {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">
            <img src={logoImage} alt="Team ONE Logo" className="login-logo-image" />
            <h1>Team ONE</h1>
          </div>
          <h2>관리자 로그인</h2>
          <p>관리자 계정으로 로그인하여 시스템을 관리하세요.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="username">아이디</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="아이디를 입력하세요"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          <button type="submit" className="login-btn">
            로그인
          </button>
        </form>

        <div className="login-footer">
          {/* <p>테스트 계정: admin / admin123</p> */}
          <a href="/" className="back-link">← 홈으로 돌아가기</a>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
