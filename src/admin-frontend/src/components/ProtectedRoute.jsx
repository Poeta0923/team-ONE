import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/api';

/**
 * 인증이 필요한 페이지를 보호하는 컴포넌트
 * 로그인하지 않은 사용자는 로그인 페이지로 리다이렉트
 */
const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) {
    // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    return <Navigate to="/login" replace />;
  }

  // 로그인된 경우 요청한 페이지 표시
  return children;
};

export default ProtectedRoute;

