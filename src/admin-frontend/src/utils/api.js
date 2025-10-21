// API 기본 설정
// 개발 환경: http://localhost:60002/app
// 프로덕션 환경: 배포 시 실제 서버 URL로 
export const API_BASE_URL = 'http://localhost:60002/app';

// API 엔드포인트
export const API_ENDPOINTS = {
  ADMIN_LOGIN: `${API_BASE_URL}/admin/login`,
  // 추후 다른 API 엔드포인트 추가
};

// 로컬 스토리지에서 토큰 가져오기
export const getAccessToken = () => {
  return localStorage.getItem('accessToken');
};

export const getRefreshToken = () => {
  return localStorage.getItem('refreshToken');
};

// 로컬 스토리지에 토큰 저장하기
export const setTokens = (accessToken, refreshToken) => {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
};

// 로컬 스토리지에서 토큰 제거하기 (로그아웃)
export const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

// 인증이 필요한 API 요청을 위한 헤더 생성
export const getAuthHeaders = () => {
  const token = getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// 로그인 여부 확인
export const isAuthenticated = () => {
  return !!getAccessToken();
};

