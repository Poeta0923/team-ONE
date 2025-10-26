// API 기본 설정
// 환경별 자동 전환
const getApiBaseUrl = () => {
  // 개발 환경 (npm run dev)
  if (import.meta.env.DEV) {
    return 'http://localhost:60002/app';
  }
  
  // 프로덕션 환경 (npm run build)
  return 'http://your-school-server.com:port/app';
};

export const API_BASE_URL = getApiBaseUrl();

// API 엔드포인트
export const API_ENDPOINTS = {
  ADMIN_LOGIN: `${API_BASE_URL}/admin/login`,
  
  // 프로젝트 관리
  PROJECTS_LIST: `${API_BASE_URL}/admin/projects`,
  PROJECT_DELETE: (projectId) => `${API_BASE_URL}/admin/projects/${projectId}`,
  
  // 회원 관리
  USERS_ALL: `${API_BASE_URL}/admin/users`,
  USERS_REPORTED: `${API_BASE_URL}/admin/reports`,
  USERS_BLOCKED: `${API_BASE_URL}/admin/blocked-users`,
  USER_REPORT_DETAIL: (userId) => `${API_BASE_URL}/admin/users/${userId}/reports`,
  USER_REPORT_STATUS: (reportId) => `${API_BASE_URL}/admin/reports/${reportId}/status`,
  USER_BAN: (userId) => `${API_BASE_URL}/admin/users/${userId}/ban`,
  USER_UNBAN: (userId) => `${API_BASE_URL}/admin/users/${userId}/unban`,
  
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

