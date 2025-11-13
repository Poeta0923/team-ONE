import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImage from '../../assets/로고.png';
import { adminLogin, setTokens } from '../../utils/api';
import './LoginPage.css';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    id: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data = await adminLogin(formData.id, formData.password);

      if (data.resultCode === 200) {
        if (data.data && data.data.accessToken && data.data.refreshToken) {
          setTokens(data.data.accessToken, data.data.refreshToken);
          console.log(data.successMessage);
          navigate('/admin');
        } else {
          setError('토큰 정보가 올바르지 않습니다.');
        }
      } else {
        setError(data.successMessage || '로그인에 실패했습니다.');
      }
    } catch (err) {
      console.error('로그인 에러:', err);
      setError(err.message || '로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
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
            <label htmlFor="id">아이디</label>
            <input
              type="text"
              id="id"
              name="id"
              value={formData.id}
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

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="login-footer">
          <a href="/" className="back-link">← 홈으로 돌아가기</a>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
