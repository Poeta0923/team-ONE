// ============================================
// Mock (테스트용)
// ============================================
import { mockData, mockDelay } from './mockData';

// true로 설정하면 실제 API 대신 Mock 데이터를 사용합니다!!!!배포 환경에서는 반드시 false!!!!
export const USE_MOCK_API = true;

// API 기본 설정
const getApiBaseUrl = () => {
  return 'http://ceprj.gachon.ac.kr:60002';
};

export const API_BASE_URL = getApiBaseUrl();

// API 엔드포인트
export const API_ENDPOINTS = {
  ADMIN_LOGIN: `${API_BASE_URL}/admin/login`,
  ADMIN_LOGOUT: `${API_BASE_URL}/admin/logout`,
  
  // 프로젝트 관리
  PROJECTS_LIST: `${API_BASE_URL}/admin/projects`,
  PROJECT_DELETE: (projectId) => `${API_BASE_URL}/admin/projects/${projectId}`,
  
  // 공모전 관리
  CONTESTS_LIST: `${API_BASE_URL}/admin/contests`,
  CONTEST_CREATE: `${API_BASE_URL}/admin/contests`,
  CONTEST_DELETE: (contestId) => `${API_BASE_URL}/admin/contests/${contestId}`,
  
  // 회원 관리
  USERS_ALL: `${API_BASE_URL}/admin/users`,
  REPORTS: `${API_BASE_URL}/admin/reports`,
  USERS_BANNED: `${API_BASE_URL}/admin/banned-users`,
  USER_REPORT_DETAIL: (userId) => `${API_BASE_URL}/admin/users/${userId}/reports`,
  USER_STATUS: (userId) => `${API_BASE_URL}/admin/users/${userId}/status`,
  REPORT_STATUS: (reportId) => `${API_BASE_URL}/admin/reports/${reportId}/status`,
  
  // 대시보드
  DASHBOARD: `${API_BASE_URL}/admin/dashboard`,
  
  // AI 모델 관리
  AI_MODEL_ACCURACY: `${API_BASE_URL}/admin/ai-model`,
  AI_MODEL_PARAMETER_SCORE: `${API_BASE_URL}/admin/ai-model/parameter/score`,
  AI_MODEL_PARAMETER_ACCEPTOR: `${API_BASE_URL}/admin/ai-model/parameter/acceptor`,
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

// ============================================
// API 함수들 (Mock/실제 API 전환 가능)
// ============================================

// 로그인
export const adminLogin = async (id, password) => {
  if (USE_MOCK_API) {
    await mockDelay();
    if (id === 'admin' && password === '1234') {
      return mockData.login;
    } else {
      return {
        contentType: "json",
        resultCode: 401,
        successMessage: "아이디 또는 비밀번호가 일치하지 않습니다.",
        data: null
      };
    }
  }
  
  const response = await fetch(API_ENDPOINTS.ADMIN_LOGIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, password })
  });
  return response.json();
};

// 로그아웃
export const adminLogout = async () => {
  if (USE_MOCK_API) {
    await mockDelay();
    return mockData.logout;
  }
  
  const response = await fetch(API_ENDPOINTS.ADMIN_LOGOUT, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return response.json();
};

// 전체 회원 목록 조회
export const fetchAllUsers = async (page = 1, limit = 10) => {
  if (USE_MOCK_API) {
    await mockDelay();
    return mockData.users;
  }
  
  const response = await fetch(`${API_ENDPOINTS.USERS_ALL}?page=${page}&limit=${limit}`, {
    headers: getAuthHeaders()
  });
  return response.json();
};

// 신고 내역 조회
export const fetchReports = async (page = 1, limit = 10) => {
  if (USE_MOCK_API) {
    await mockDelay();
    return mockData.reports;
  }
  
  const response = await fetch(`${API_ENDPOINTS.REPORTS}?page=${page}&limit=${limit}`, {
    headers: getAuthHeaders()
  });
  return response.json();
};

// 차단된 회원 목록 조회
export const fetchBannedUsers = async (page = 1, limit = 10) => {
  if (USE_MOCK_API) {
    await mockDelay();
    return mockData.bannedUsers;
  }
  
  const response = await fetch(`${API_ENDPOINTS.USERS_BANNED}?page=${page}&limit=${limit}`, {
    headers: getAuthHeaders()
  });
  return response.json();
};

// 회원 신고 상세 조회
export const fetchUserReportDetail = async (userId) => {
  if (USE_MOCK_API) {
    await mockDelay();
    // userId에 해당하는 데이터가 있으면 반환, 없으면 기본 데이터 반환
    const userReport = mockData.reportDetails[userId];
    if (userReport) {
      return userReport;
    }
    // 기본 데이터 (userId가 Mock 데이터에 없는 경우)
    return {
      success: true,
      data: {
        user: {
          id: userId,
          userId: userId,
          username: `user${userId}`,
          name: '사용자',
          nickName: '닉네임',
          email: `user${userId}@example.com`,
          phoneNumber: '010-0000-0000',
          createdAt: '2024-01-01',
          status: 'active'
        },
        reports: [
          {
            id: 1,
            reporterId: 1,
            reporterName: '신고자',
            reason: '기타',
            description: '신고 내용입니다.',
            createdAt: '2024-10-01T10:00:00Z',
            status: 'pending'
          }
        ]
      }
    };
  }
  
  const response = await fetch(API_ENDPOINTS.USER_REPORT_DETAIL(userId), {
    headers: getAuthHeaders()
  });
  return response.json();
};

// 회원 차단 (블랙리스트 등록)
export const banUser = async (userId, reason) => {
  if (USE_MOCK_API) {
    await mockDelay();
    return {
      contentType: "json",
      resultCode: 200,
      successMessage: "계정 상태가 성공적으로 변경되었습니다.",
      data: {
        userId: userId,
        status: "banned",
        updateAt: new Date().toISOString()
      }
    };
  }
  
  const response = await fetch(API_ENDPOINTS.USER_STATUS(userId), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ 
      status: "banned",
      reason: reason 
    })
  });
  return response.json();
};

// 회원 차단 해제 (블랙리스트 해제)
export const unbanUser = async (userId) => {
  if (USE_MOCK_API) {
    await mockDelay();
    return {
      contentType: "json",
      resultCode: 200,
      successMessage: "계정 상태가 성공적으로 변경되었습니다.",
      data: {
        userId: userId,
        status: "active",
        updateAt: new Date().toISOString()
      }
    };
  }
  
  const response = await fetch(API_ENDPOINTS.USER_STATUS(userId), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status: "active" })
  });
  return response.json();
};

// 신고 처리 상태 변경
export const updateReportStatus = async (reportId, status) => {
  if (USE_MOCK_API) {
    await mockDelay();
    return {
      contentType: "json",
      resultCode: 200,
      successMessage: "신고 상태가 성공적으로 변경됐습니다.",
      data: {
        reportId: reportId,
        status: status
      }
    };
  }
  
  const response = await fetch(API_ENDPOINTS.REPORT_STATUS(reportId), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status: status })
  });
  return response.json();
};

// 프로젝트 목록 조회
export const fetchProjects = async (page = 1, limit = 10) => {
  if (USE_MOCK_API) {
    await mockDelay();
    return mockData.projects;
  }
  
  const response = await fetch(`${API_ENDPOINTS.PROJECTS_LIST}?page=${page}&limit=${limit}`, {
    headers: getAuthHeaders()
  });
  return response.json();
};

// 프로젝트 삭제
export const deleteProject = async (projectId) => {
  if (USE_MOCK_API) {
    await mockDelay();
    return { 
      contentType: "json",
      resultCode: 200,
      successMessage: '해당 프로젝트가 성공적으로 삭제되었습니다.',
      data: null
    };
  }
  
  const response = await fetch(API_ENDPOINTS.PROJECT_DELETE(projectId), {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return response.json();
};

// 공모전 목록 조회
export const fetchContests = async (page = 1, limit = 10) => {
  if (USE_MOCK_API) {
    await mockDelay();
    return mockData.contests;
  }
  
  const response = await fetch(`${API_ENDPOINTS.CONTESTS_LIST}?page=${page}&limit=${limit}`, {
    headers: getAuthHeaders()
  });
  return response.json();
};

// 공모전 등록
export const createContest = async (name) => {
  if (USE_MOCK_API) {
    await mockDelay();
    return {
      contentType: "json",
      resultCode: 200,
      successMessage: "공모전이 성공적으로 등록되었습니다.",
      data: {
        contestId: Math.floor(Math.random() * 1000) + 100,
        name: name
      }
    };
  }
  
  const response = await fetch(API_ENDPOINTS.CONTEST_CREATE, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name })
  });
  return response.json();
};

// 공모전 삭제
export const deleteContest = async (contestId) => {
  if (USE_MOCK_API) {
    await mockDelay();
    return { 
      contentType: "json",
      resultCode: 200,
      successMessage: '해당 공모전이 성공적으로 삭제되었습니다.',
      data: null
    };
  }
  
  const response = await fetch(API_ENDPOINTS.CONTEST_DELETE(contestId), {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return response.json();
};

// 대시보드 조회
export const fetchDashboard = async () => {
  if (USE_MOCK_API) {
    await mockDelay();
    return mockData.dashboard;
  }
  
  const response = await fetch(API_ENDPOINTS.DASHBOARD, {
    headers: getAuthHeaders()
  });
  return response.json();
};

// AI 모델 정확도 조회
export const fetchAIModelAccuracy = async () => {
  if (USE_MOCK_API) {
    await mockDelay();
    return mockData.aiModelAccuracy;
  }
  
  const response = await fetch(API_ENDPOINTS.AI_MODEL_ACCURACY, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
};

// AI 모델 파라미터 수정 - 재정렬 모델
export const updateAIModelParameterScore = async (learningRate) => {
  if (USE_MOCK_API) {
    await mockDelay();
    return {
      contentType: "json",
      resultCode: 200,
      successMessage: "재정렬 모델 파라미터가 성공적으로 수정되었습니다.",
      data: {
        modelName: "재정렬 모델",
        learningRate: learningRate
      }
    };
  }
  
  const response = await fetch(API_ENDPOINTS.AI_MODEL_PARAMETER_SCORE, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ learningRate })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
};

// AI 모델 파라미터 수정 - 수락확률 모델
export const updateAIModelParameterAcceptor = async (learningRate) => {
  if (USE_MOCK_API) {
    await mockDelay();
    return {
      contentType: "json",
      resultCode: 200,
      successMessage: "수락확률 모델 파라미터가 성공적으로 수정되었습니다.",
      data: {
        modelName: "수락확률 모델",
        learningRate: learningRate
      }
    };
  }
  
  const response = await fetch(API_ENDPOINTS.AI_MODEL_PARAMETER_ACCEPTOR, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ learningRate })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
};
