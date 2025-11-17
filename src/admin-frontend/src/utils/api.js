// ============================================
// MOCK 모드 설정 (테스트용)
// ============================================
// true로 설정하면 실제 API 대신 Mock 데이터를 사용합니다
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
          reportedUserId: 2,
          reportedUserStatus: "banned",
          reason: "프로젝트 잠수 (연락 두절)",
          createdAt: "2025-10-01T10:30:00",
          status: "pending"
        },
        {
          reportId: 2,
          reporterName: "박유저",
          reportedName: "최유저",
          reportedUserId: 4,
          reportedUserStatus: "banned",
          reason: "팀 채팅방에서 지속적인 비매너 행위 및 욕설",
          createdAt: "2025-10-02T11:00:00",
          status: "pending"
        },
        {
          reportId: 3,
          reporterName: "정유저",
          reportedName: "한유저",
          reportedUserId: 6,
          reportedUserStatus: "banned",
          reason: "프로젝트와 관련 없는 홍보성 스팸 링크 게시",
          createdAt: "2025-10-02T15:10:00",
          status: "pending"
        },
        {
          reportId: 4,
          reporterName: "김유저",
          reportedName: "최유저",
          reportedUserId: 4,
          reportedUserStatus: "banned",
          reason: "두 번째 신고: 욕설 및 비방 행위가 개선되지 않음",
          createdAt: "2025-10-03T09:20:00",
          status: "pending"
        },
        {
          reportId: 5,
          reporterName: "송유저",
          reportedName: "김유저",
          reportedUserId: 1,
          reportedUserStatus: "active",
          reason: "프로젝트 참여 없음 (무임승차)",
          createdAt: "2025-09-15T14:00:00",
          status: "pending"
        },
        {
          reportId: 6,
          reporterName: "남유저",
          reportedName: "배유저",
          reportedUserId: 10,
          reportedUserStatus: "active",
          reason: "과제 기한 미준수 및 팀원 비협조",
          createdAt: "2025-09-20T18:00:00",
          status: "pending"
        },
        {
          reportId: 7,
          reporterName: "박유저",
          reportedName: "김유저",
          reportedUserId: 1,
          reportedUserStatus: "active",
          reason: "사전 통보 없이 팀원을 강퇴 처리함",
          createdAt: "2025-10-04T12:45:00",
          status: "pending"
        },
        {
          reportId: 8,
          reporterName: "이유저",
          reportedName: "박유저",
          reportedUserId: 3,
          reportedUserStatus: "active",
          reason: "아이디어 도용 의심 (기획안 무단 사용)",
          createdAt: "2025-10-05T10:00:00",
          status: "pending"
        },
        {
          reportId: 9,
          reporterName: "최유저",
          reportedName: "정유저",
          reportedUserId: 5,
          reportedUserStatus: "active",
          reason: "팀 미팅에 지속적으로 불참 (3회 이상)",
          createdAt: "2025-09-25T17:30:00",
          status: "pending"
        },
        {
          reportId: 10,
          reporterName: "한유저",
          reportedName: "송유저",
          reportedUserId: 7,
          reportedUserStatus: "active",
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
          userId: 2,
          name: "이유저",
          nickName: "유저이",
          status: "banned",
          reason: "프로젝트 잠수 신고 접수",
          updatedAt: "2025-10-03T11:00:00"
        },
        {
          userId: 4,
          name: "최유저",
          nickName: "유저사",
          status: "banned",
          reason: "반복적인 비매너 행위 및 욕설 신고 접수",
          updatedAt: "2025-10-04T10:00:00"
        },
        {
          userId: 6,
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
    contentType: "json",
    resultCode: 200,
    successMessage: "프로젝트 목록 조회 성공",
    data: {
      projects: [
        {
          projectId: 23,
          name: "AI 기반 교내 주차 관리 시스템",
          type: "AI/ML",
          category: "교통/IT",
          statement: "진행중",
          date: "2025-10-01T10:00:00"
        },
        {
          projectId: 24,
          name: "반려동물 산책 및 커뮤니티 앱",
          type: "App",
          category: "라이프스타일",
          statement: "모집중",
          date: "2025-10-02T11:30:00"
        },
        {
          projectId: 25,
          name: "학과 강의실 예약 시스템",
          type: "Web",
          category: "교내/편의",
          statement: "진행중",
          date: "2025-10-03T14:20:00"
        },
        {
          projectId: 26,
          name: "가천대 맛집 추천 및 리뷰 사이트",
          type: "Web",
          category: "라이프스타일",
          statement: "완료",
          date: "2025-09-01T18:00:00"
        },
        {
          projectId: 27,
          name: "전기차 충전소 최적 경로 탐색 알고리즘",
          type: "AI/ML",
          category: "교통/IT",
          statement: "진행중",
          date: "2025-10-05T16:00:00"
        },
        {
          projectId: 28,
          name: "소상공인을 위한 상권 분석 대시보드",
          type: "Data",
          category: "비즈니스",
          statement: "모집중",
          date: "2025-10-10T09:00:00"
        },
        {
          projectId: 29,
          name: "졸업작품: AI 기반 팀 매칭 시스템",
          type: "Web",
          category: "IT/교육",
          statement: "진행중",
          date: "2025-10-11T11:00:00"
        },
        {
          projectId: 30,
          name: "시각 장애인을 위한 스마트 지팡이",
          type: "IoT",
          category: "복지/기술",
          statement: "완료",
          date: "2025-09-15T17:30:00"
        },
        {
          projectId: 31,
          name: "교내 중고거래 마켓 앱 (가천마켓)",
          type: "App",
          category: "교내/편의",
          statement: "모집중",
          date: "2025-10-15T13:00:00"
        },
        {
          projectId: 32,
          name: "학과 공지사항 챗봇 서비스",
          type: "AI/ML",
          category: "교내/편의",
          statement: "진행중",
          date: "2025-10-18T10:00:00"
        }
      ],
      totalPages: 2,
      totalElements: 11
    }
  },

  // 공모전 목록
  contests: {
    contentType: "json",
    resultCode: 200,
    successMessage: "공모전 목록 조회 성공",
    data: {
      contests: [
        {
          contestId: 1,
          name: "2025 AI 기반 스마트시티 공모전"
        },
        {
          contestId: 2,
          name: "2025 대학생 앱 개발 챌린지 (APP-JAM)"
        },
        {
          contestId: 3,
          name: "빅데이터 활용 비즈니스 아이디어 경진대회"
        },
        {
          contestId: 4,
          name: "가천대학교 졸업작품 경진대회"
        }
      ],
      totalPages: 1,
      totalElements: 4
    }
  },

  // 대시보드
  dashboard: {
    contentType: "json",
    resultCode: 200,
    successMessage: "대시보드 조회 성공",
    data: {
      monthlyUserGrowth: [
        { month: 1, totalUserCount: 1, projectParticipantCount: 0 },
        { month: 2, totalUserCount: 2, projectParticipantCount: 0 },
        { month: 3, totalUserCount: 2, projectParticipantCount: 0 },
        { month: 4, totalUserCount: 2, projectParticipantCount: 0 },
        { month: 5, totalUserCount: 6, projectParticipantCount: 0 },
        { month: 6, totalUserCount: 6, projectParticipantCount: 0 },
        { month: 7, totalUserCount: 6, projectParticipantCount: 0 },
        { month: 8, totalUserCount: 6, projectParticipantCount: 0 },
        { month: 9, totalUserCount: 6, projectParticipantCount: 0 },
        { month: 10, totalUserCount: 8, projectParticipantCount: 0 },
        { month: 11, totalUserCount: 9, projectParticipantCount: 1 },
        { month: 12, totalUserCount: 9, projectParticipantCount: 1 }
      ],
      annualUserGrowth: [
        { year: 2025, totalUserCount: 9 },
        { year: 2024, totalUserCount: 2 }
      ],
      recentProjects: [
        { projectId: 32, name: "학과 공지사항 챗봇 서비스", statement: "진행중" },
        { projectId: 29, name: "졸업작품: AI 기반 팀 매칭 시스템", statement: "진행중" },
        { projectId: 33, name: "친환경 캠페인 인증 웹사이트", statement: "완료" }
      ],
      recentUsers: [
        { userId: 11, name: "배유저", date: "2025-11-11T14:00:00" },
        { userId: 12, name: "박유저", date: "2025-10-20T15:00:00" },
        { userId: 10, name: "남유저", date: "2025-10-08T13:00:00" },
        { userId: 9, name: "김유저", date: "2025-05-17T12:00:00" },
        { userId: 8, name: "송유저", date: "2025-05-16T11:00:00" },
        { userId: 7, name: "한유저", date: "2025-05-15T10:00:00" },
        { userId: 6, name: "정유저", date: "2025-05-01T10:00:00" },
        { userId: 3, name: "이유저", date: "2025-02-20T14:00:00" },
        { userId: 2, name: "김유저", date: "2025-01-10T09:30:00" },
        { userId: 5, name: "최유저", date: "2024-04-18T17:00:00" }
      ]
    }
  },

  // AI 모델 정확도
  aiModelAccuracy: {
    contentType: "json",
    resultCode: 200,
    successMessage: "AI 모델 현황 조회 성공",
    data: [
      { 
        modelName: "후보생성 모델", 
        "HitRate@K": {
          "1": 1.0,
          "3": 1.0,
          "5": 1.0,
          "10": 1.0
        },
        "Recall@K": {
          "1": 1.0,
          "3": 1.0,
          "5": 1.0,
          "10": 1.0
        } 
      },
      {
        modelName: "재정렬 모델", 
        "ndcg@4": 0.9902403950467509, 
        "precision@4": 0.75
      },
      { 
        modelName: "수락확률 모델", 
        "pr_auc": 0.9973684210526316,
        "f1": 0.972972972972973 
      }
    ]
  },

  // AI 모델 파라미터 - 재정렬 모델
  aiModelParameterScore: {
    contentType: "json",
    resultCode: 200,
    successMessage: "재정렬 모델 파라미터 조회 성공",
    data: {
      modelName: "재정렬 모델",
      learningRate: 0.001
    }
  },

  // AI 모델 파라미터 - 수락확률 모델
  aiModelParameterAcceptor: {
    contentType: "json",
    resultCode: 200,
    successMessage: "수락확률 모델 파라미터 조회 성공",
    data: {
      modelName: "수락확률 모델",
      learningRate: 0.0001
    }
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
    headers: getAuthHeaders()
  });
  return response.json();
};

// AI 모델 파라미터 조회 - 재정렬 모델
export const fetchAIModelParameterScore = async () => {
  if (USE_MOCK_API) {
    await mockDelay();
    return mockData.aiModelParameterScore;
  }
  
  const response = await fetch(API_ENDPOINTS.AI_MODEL_PARAMETER_SCORE, {
    headers: getAuthHeaders()
  });
  return response.json();
};

// AI 모델 파라미터 조회 - 수락확률 모델
export const fetchAIModelParameterAcceptor = async () => {
  if (USE_MOCK_API) {
    await mockDelay();
    return mockData.aiModelParameterAcceptor;
  }
  
  const response = await fetch(API_ENDPOINTS.AI_MODEL_PARAMETER_ACCEPTOR, {
    headers: getAuthHeaders()
  });
  return response.json();
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
  return response.json();
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
  return response.json();
};
