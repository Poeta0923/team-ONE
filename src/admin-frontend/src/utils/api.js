// ============================================
// MOCK 모드 설정 (테스트용)
// ============================================
// true로 설정하면 실제 API 대신 Mock 데이터를 사용합니다
export const USE_MOCK_API = true; // <- 여기를 false로 바꾸면 실제 API 사용

// API 기본 설정
// 환경별 자동 전환
const getApiBaseUrl = () => {
  // 개발 환경 (npm run dev)
  if (import.meta.env.DEV) {
    return 'http://ceprj.gachon.ac.kr:60002';
  }
  
  // 프로덕션 환경 (npm run build)
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
  
  // 회원 관리
  USERS_ALL: `${API_BASE_URL}/admin/users`,
  REPORTS: `${API_BASE_URL}/admin/reports`,
  USERS_BANNED: `${API_BASE_URL}/admin/banned-users`,
  USER_REPORT_DETAIL: (userId) => `${API_BASE_URL}/admin/users/${userId}/reports`,
  USER_REPORT_STATUS: (reportId) => `${API_BASE_URL}/admin/reports/${reportId}/status`,
  USER_BAN: (userId) => `${API_BASE_URL}/admin/users/${userId}/ban`,
  USER_UNBAN: (userId) => `${API_BASE_URL}/admin/users/${userId}/unban`,
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
// MOCK 데이터 (테스트용)
// ============================================
const mockData = {
  // 로그인 응답
  login: {
    contentType: "json",
    resultCode: 200,
    successMessage: "로그인 성공",
    data: {
      accessToken: "mock_access_token_12345",
      refreshToken: "mock_refresh_token_67890"
    }
  },

  // 로그아웃 응답
  logout: {
    contentType: "json",
    resultCode: 200,
    successMessage: "로그아웃 성공",
    data: null
  },

  // 전체 회원 목록
  users: {
    contentType: "json",
    resultCode: 200,
    successMessage: "회원 목록 조회 성공",
    data: {
      users: [
        {
          name: "김유저",
          nickName: "유저일",
          techStack: "Java, Spring Boot",
          phoneNumber: "010-1111-0001",
          birth: "1995-03-15",
          address: "서울특별시 강남구"
        },
        {
          name: "이유저",
          nickName: "유저이",
          techStack: "React, TypeScript",
          phoneNumber: "010-1111-0002",
          birth: "1998-11-02",
          address: "경기도 성남시"
        },
        {
          name: "박유저",
          nickName: "유저삼",
          techStack: "Python, TensorFlow",
          phoneNumber: "010-1111-0003",
          birth: "1997-07-21",
          address: "부산광역시 해운대구"
        },
        {
          name: "최유저",
          nickName: "유저사",
          techStack: "Figma, Adobe XD",
          phoneNumber: "010-1111-0004",
          birth: "1993-01-30",
          address: "인천광역시 연수구"
        },
        {
          name: "정유저",
          nickName: "유저오",
          techStack: "HTML/CSS, JS",
          phoneNumber: "010-1111-0005",
          birth: "2002-05-05",
          address: "대전광역시 유성구"
        },
        {
          name: "한유저",
          nickName: "유저육",
          techStack: "React Native, Firebase",
          phoneNumber: "010-1111-0006",
          birth: "1999-02-10",
          address: "서울특별시 마포구"
        },
        {
          name: "송유저",
          nickName: "유저칠",
          techStack: "Vue.js, Nuxt.js",
          phoneNumber: "010-1111-0007",
          birth: "1994-04-23",
          address: "경기도 수원시"
        },
        {
          name: "김유저",
          nickName: "유저팔",
          techStack: "Python, Django",
          phoneNumber: "010-1111-0008",
          birth: "1990-04-24",
          address: "서울특별시 용산구"
        },
        {
          name: "남유저",
          nickName: "유저구",
          techStack: "Swift, SwiftUI",
          phoneNumber: "010-1111-0009",
          birth: "1994-02-22",
          address: "부산광역시 수영구"
        },
        {
          name: "배유저",
          nickName: "유저십",
          techStack: "Java, Kotlin, Spring",
          phoneNumber: "010-1111-0010",
          birth: "1994-10-10",
          address: "광주광역시 동구"
        }
      ],
      totalPages: 2,
      totalElements: 11
    }
  },

  // 신고 내역 목록
  reports: {
    contentType: "json",
    resultCode: 200,
    successMessage: "신고 내역 조회 성공",
    data: {
      reports: [
        {
          reportId: 1,
          reporterName: "김유저",
          reportedName: "이유저",
          reason: "프로젝트 잠수 (연락 두절)",
          createdAt: "2025-10-01T10:30:00",
          status: "pending"
        },
        {
          reportId: 2,
          reporterName: "박유저",
          reportedName: "최유저",
          reason: "팀 채팅방에서 지속적인 비매너 행위 및 욕설",
          createdAt: "2025-10-02T11:00:00",
          status: "pending"
        },
        {
          reportId: 3,
          reporterName: "정유저",
          reportedName: "한유저",
          reason: "프로젝트와 관련 없는 홍보성 스팸 링크 게시",
          createdAt: "2025-10-02T15:10:00",
          status: "pending"
        },
        {
          reportId: 4,
          reporterName: "김유저",
          reportedName: "최유저",
          reason: "두 번째 신고: 욕설 및 비방 행위가 개선되지 않음",
          createdAt: "2025-10-03T09:20:00",
          status: "pending"
        },
        {
          reportId: 5,
          reporterName: "송유저",
          reportedName: "김유저",
          reason: "프로젝트 참여 없음 (무임승차)",
          createdAt: "2025-09-15T14:00:00",
          status: "pending"
        },
        {
          reportId: 6,
          reporterName: "남유저",
          reportedName: "배유저",
          reason: "과제 기한 미준수 및 팀원 비협조",
          createdAt: "2025-09-20T18:00:00",
          status: "pending"
        },
        {
          reportId: 7,
          reporterName: "박유저",
          reportedName: "김유저",
          reason: "사전 통보 없이 팀원을 강퇴 처리함",
          createdAt: "2025-10-04T12:45:00",
          status: "pending"
        },
        {
          reportId: 8,
          reporterName: "이유저",
          reportedName: "박유저",
          reason: "아이디어 도용 의심 (기획안 무단 사용)",
          createdAt: "2025-10-05T10:00:00",
          status: "pending"
        },
        {
          reportId: 9,
          reporterName: "최유저",
          reportedName: "정유저",
          reason: "팀 미팅에 지속적으로 불참 (3회 이상)",
          createdAt: "2025-09-25T17:30:00",
          status: "pending"
        },
        {
          reportId: 10,
          reporterName: "한유저",
          reportedName: "송유저",
          reason: "프로젝트 잠수",
          createdAt: "2025-10-06T08:00:00",
          status: "pending"
        }
      ],
      totalPages: 2,
      totalElements: 12
    }
  },

  // 차단된 회원 목록
  bannedUsers: {
    contentType: "json",
    resultCode: 200,
    successMessage: "차단된 회원 목록 조회 성공",
    data: {
      users: [
        {
          name: "이유저",
          nickName: "유저이",
          status: "banned",
          reason: "프로젝트 잠수 신고 접수",
          updatedAt: "2025-10-03T11:00:00"
        },
        {
          name: "최유저",
          nickName: "유저사",
          status: "banned",
          reason: "반복적인 비매너 행위 및 욕설 신고 접수",
          updatedAt: "2025-10-04T10:00:00"
        },
        {
          name: "한유저",
          nickName: "유저육",
          status: "banned",
          reason: "홍보성 스팸 링크 게시로 인한 영구 차단",
          updatedAt: "2025-10-03T16:00:00"
        }
      ],
      totalPages: 1,
      totalElements: 3
    }
  },

  // 신고 상세 정보 (userId별로 다른 데이터)
  reportDetails: {
    // userId: 2 (이영희)
    '2': {
      success: true,
      data: {
        user: {
          id: 2,
          userId: 2,
          username: 'user2',
          name: '이영희',
          nickName: '디자이너',
          email: 'user2@example.com',
          phoneNumber: '010-2345-6789',
          createdAt: '2024-02-20',
          status: 'active'
        },
        reports: [
          {
            id: 101,
            reporterId: 15,
            reporterName: '김철수',
            reason: '시간 약속을 안 지킴',
            description: '프로젝트 미팅 시간에 30분 이상 지각하고 사전 연락도 없었습니다. 이런 일이 3번째입니다.',
            createdAt: '2024-10-20T14:30:00Z',
            status: 'pending'
          },
          {
            id: 102,
            reporterId: 18,
            reporterName: '박지훈',
            reason: '업무 태만',
            description: '맡은 디자인 작업을 마감일까지 완료하지 않았고, 진행 상황에 대한 공유도 없었습니다.',
            createdAt: '2024-10-18T09:15:00Z',
            status: 'pending'
          }
        ]
      }
    },
    // userId: 3 (박민수)
    '3': {
      success: true,
      data: {
        user: {
          id: 3,
          userId: 3,
          username: 'user3',
          name: '박민수',
          nickName: '백엔드마스터',
          email: 'user3@example.com',
          phoneNumber: '010-3456-7890',
          createdAt: '2024-03-10',
          status: 'active'
        },
        reports: [
          {
            id: 103,
            reporterId: 12,
            reporterName: '최수진',
            reason: '의사소통 불량',
            description: '메시지를 보내도 답장이 없고, 미팅에서도 의견을 전혀 말하지 않습니다.',
            createdAt: '2024-10-15T16:20:00Z',
            status: 'pending'
          }
        ]
      }
    },
    // userId: 5 (최동욱)
    '5': {
      success: true,
      data: {
        user: {
          id: 5,
          userId: 5,
          username: 'user5',
          name: '최동욱',
          nickName: '풀스택개발자',
          email: 'user5@example.com',
          phoneNumber: '010-5678-9012',
          createdAt: '2024-05-12',
          status: 'active'
        },
        reports: [
          {
            id: 104,
            reporterId: 8,
            reporterName: '김민지',
            reason: '부적절한 언어 사용',
            description: '프로젝트 채팅방에서 팀원들에게 반말과 욕설을 사용했습니다.',
            createdAt: '2024-10-25T11:45:00Z',
            status: 'pending'
          },
          {
            id: 105,
            reporterId: 14,
            reporterName: '이수현',
            reason: '프로젝트 무단 이탈',
            description: '프로젝트 진행 중 갑자기 연락이 두절되었고, 맡은 작업을 완료하지 않았습니다.',
            createdAt: '2024-10-22T08:30:00Z',
            status: 'resolved'
          },
          {
            id: 106,
            reporterId: 19,
            reporterName: '정우성',
            reason: '팀원 비방',
            description: '다른 팀원의 실력을 공개적으로 비하하고 모욕적인 발언을 했습니다.',
            createdAt: '2024-10-20T13:15:00Z',
            status: 'pending'
          },
          {
            id: 107,
            reporterId: 22,
            reporterName: '홍길동',
            reason: '코드 무단 사용',
            description: '다른 팀원의 코드를 허락 없이 복사해서 자신의 작업물로 제출했습니다.',
            createdAt: '2024-10-18T15:50:00Z',
            status: 'pending'
          },
          {
            id: 108,
            reporterId: 25,
            reporterName: '강혜진',
            reason: '회의 방해',
            description: '온라인 회의 중 지속적으로 주제와 관련 없는 이야기를 하며 회의 진행을 방해했습니다.',
            createdAt: '2024-10-16T10:20:00Z',
            status: 'resolved'
          }
        ]
      }
    },
    // userId: 10 (차단된 사용자 - 강태양)
    '10': {
      success: true,
      data: {
        user: {
          id: 10,
          userId: 10,
          username: 'blockedUser1',
          name: '강태양',
          nickName: '스팸왕',
          email: 'blocked1@example.com',
          phoneNumber: '010-9999-1111',
          createdAt: '2024-01-05',
          status: 'banned'
        },
        reports: [
          {
            id: 201,
            reporterId: 30,
            reporterName: '윤서연',
            reason: '스팸 메시지 발송',
            description: '같은 내용의 홍보 메시지를 여러 사용자에게 반복적으로 전송했습니다.',
            createdAt: '2024-08-28T14:20:00Z',
            status: 'resolved'
          },
          {
            id: 202,
            reporterId: 31,
            reporterName: '박준영',
            reason: '부적절한 콘텐츠 게시',
            description: '프로필과 프로젝트 소개에 광고성 콘텐츠를 게시했습니다.',
            createdAt: '2024-08-30T09:30:00Z',
            status: 'resolved'
          },
          {
            id: 203,
            reporterId: 33,
            reporterName: '이지은',
            reason: '사기 행위',
            description: '가짜 프로젝트를 올려서 사람들을 모집한 후 금전을 요구했습니다.',
            createdAt: '2024-08-31T16:45:00Z',
            status: 'resolved'
          }
        ]
      }
    },
    // userId: 11 (차단된 사용자 - 윤하늘)
    '11': {
      success: true,
      data: {
        user: {
          id: 11,
          userId: 11,
          username: 'blockedUser2',
          name: '윤하늘',
          nickName: '트롤러',
          email: 'blocked2@example.com',
          phoneNumber: '010-8888-2222',
          createdAt: '2024-02-15',
          status: 'banned'
        },
        reports: [
          {
            id: 204,
            reporterId: 35,
            reporterName: '송지훈',
            reason: '팀원 괴롭힘',
            description: '특정 팀원을 지속적으로 비난하고 프로젝트에서 배제시키려 했습니다.',
            createdAt: '2024-09-10T11:20:00Z',
            status: 'resolved'
          },
          {
            id: 205,
            reporterId: 37,
            reporterName: '김나영',
            reason: '악의적인 평가',
            description: '프로젝트가 끝난 후 팀원들에게 일방적으로 낮은 평가를 주고 악의적인 리뷰를 남겼습니다.',
            createdAt: '2024-09-12T14:50:00Z',
            status: 'resolved'
          }
        ]
      }
    }
  },

  // 프로젝트 목록
  projects: {
    success: true,
    data: [
      { 
        projectId: 1, 
        name: '웹 포트폴리오 사이트', 
        type: '웹개발', 
        category: 'IT', 
        statement: '진행중', 
        date: '2024-09-30T14:00:00Z' 
      },
      { 
        projectId: 2, 
        name: '모바일 앱 개발', 
        type: '앱개발', 
        category: 'IT', 
        statement: '완료', 
        date: '2024-09-29T10:20:00Z' 
      },
      { 
        projectId: 3, 
        name: 'AI 챗봇 서비스', 
        type: '웹개발', 
        category: 'IT', 
        statement: '진행중', 
        date: '2024-09-28T15:30:00Z' 
      },
      { 
        projectId: 4, 
        name: '이커머스 플랫폼', 
        type: '웹개발', 
        category: '비즈니스', 
        statement: '진행중', 
        date: '2024-09-27T11:00:00Z' 
      },
    ],
    total: 4
  }
};

// Mock API 응답 딜레이 (실제 API처럼 느끼게 하기 위해)
const mockDelay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

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

// 회원 차단
export const banUser = async (userId, reason) => {
  if (USE_MOCK_API) {
    await mockDelay();
    return { success: true, message: '사용자가 차단되었습니다.' };
  }
  
  const response = await fetch(API_ENDPOINTS.USER_BAN(userId), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason })
  });
  return response.json();
};

// 회원 차단 해제
export const unbanUser = async (userId) => {
  if (USE_MOCK_API) {
    await mockDelay();
    return { success: true, message: '사용자 차단이 해제되었습니다.' };
  }
  
  const response = await fetch(API_ENDPOINTS.USER_UNBAN(userId), {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return response.json();
};

// 신고 처리 상태 변경
export const updateReportStatus = async (reportId, status) => {
  if (USE_MOCK_API) {
    await mockDelay();
    return { success: true, message: '신고 상태가 업데이트되었습니다.' };
  }
  
  const response = await fetch(API_ENDPOINTS.USER_REPORT_STATUS(reportId), {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status })
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
    return { success: true, message: '프로젝트가 삭제되었습니다.' };
  }
  
  const response = await fetch(API_ENDPOINTS.PROJECT_DELETE(projectId), {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return response.json();
};
