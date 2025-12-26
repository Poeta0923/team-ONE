# Team ONE - 관리자 페이지 (Admin Frontend)

> AI 기반 팀 매칭 시스템의 관리자 페이지

## 📋 목차
1. [프로젝트 소개](#프로젝트-소개)
2. [기술 스택](#기술-스택)
3. [프로젝트 구조](#프로젝트-구조)
4. [설치 및 실행](#설치-및-실행)
5. [주요 기능](#주요-기능)
6. [Mock 데이터 사용](#mock-데이터-사용)
7. [배포 가이드](#배포-가이드)

---

## 🎯 프로젝트 소개
Team ONE 관리자 페이지는 AI 기반 팀 매칭 시스템의 전반적인 관리를 담당하는 웹 애플리케이션입니다.
회원 관리, 프로젝트 관리, 공모전 관리, AI 모델 관리 등 시스템 운영에 필요한 모든 기능을 제공합니다.

### 주요 관리 기능
- 👥 **회원 관리**: 전체 회원, 신고 내역, 차단 회원 관리
- 📁 **프로젝트 관리**: 등록된 프로젝트 조회 및 삭제
- 🏆 **공모전 관리**: 공모전 등록, 조회, 삭제
- 🤖 **AI 모델 관리**: AI 모델 정확도 조회 및 파라미터 수정
- 📊 **대시보드**: 시스템 전반의 통계 및 현황 모니터링

---

## 🛠 기술 스택

### 프론트엔드
- **React** 19.1.1 - UI 라이브러리
- **React Router DOM** 7.9.4 - 클라이언트 사이드 라우팅
- **Vite** 7.1.7 - 빌드 도구 및 개발 서버
- **Recharts** 3.4.1 - 데이터 시각화 (차트)

### 스타일링
- **CSS** - 커스텀 스타일링
- **clsx** 2.1.1 - 조건부 클래스 관리

### 개발 도구
- **ESLint** - 코드 품질 관리
- **Vite** - 빠른 개발 환경

---

## 📂 프로젝트 구조
```
admin-frontend/
├── public/                    # 정적 파일
├── src/                       # 소스 코드
│   ├── assets/               # 이미지 등 리소스
│   │   └── 로고.png
│   │
│   ├── components/           # 공통 컴포넌트
│   │   ├── AdminLayout.jsx      # 관리자 레이아웃 (사이드바 포함)
│   │   ├── AdminSidebar.jsx     # 관리자 사이드바 네비게이션
│   │   ├── Navbar.jsx           # 상단 네비게이션 바
│   │   └── ProtectedRoute.jsx   # 인증 보호 라우트
│   │
│   ├── pages/                # 페이지 컴포넌트
│   │   ├── main/            # 메인 페이지
│   │   │   ├── HomePage.jsx       # 랜딩 페이지
│   │   │   └── LoginPage.jsx      # 관리자 로그인
│   │   │
│   │   └── admin/           # 관리자 페이지
│   │       ├── dashboard/        # 대시보드
│   │       │   └── DashboardPage.jsx    # 통계 및 현황
│   │       │
│   │       ├── users/            # 회원 관리
│   │       │   ├── UsersPage.jsx        # 회원 관리 메인 (탭 구조)
│   │       │   ├── AllUsersList.jsx     # 전체 회원 목록
│   │       │   ├── ReportedUsersList.jsx # 신고받은 회원 목록
│   │       │   ├── BlockedUsersList.jsx  # 차단된 회원 목록
│   │       │   ├── ReportDetailPage.jsx  # 신고 상세 페이지
│   │       │   └── Pagination.jsx        # 페이지네이션 컴포넌트
│   │       │
│   │       ├── projects/         # 프로젝트 관리
│   │       │   └── ProjectsPage.jsx     # 프로젝트 목록 및 삭제
│   │       │
│   │       ├── contests/         # 공모전 관리
│   │       │   └── ContestsPage.jsx     # 공모전 등록, 조회, 삭제
│   │       │
│   │       └── ai/              # AI 모델 관리
│   │           ├── AIPage.jsx           # AI 모델 정확도 조회
│   │           └── AIModelEditPage.jsx  # AI 모델 파라미터 수정
│   │
│   ├── utils/                # 유틸리티
│   │   ├── api.js               # API 호출 함수 모음
│   │   └── mockData.js          # Mock 데이터 (테스트용)
│   │
│   ├── App.jsx               # 메인 App 컴포넌트 (라우팅)
│   ├── main.jsx              # 진입점
│   ├── App.css               # 전역 스타일
│   └── index.css             # 기본 스타일
│
├── index.html                # HTML 템플릿
├── vite.config.js           # Vite 설정
├── package.json             # 의존성 관리
└── README.md                # 이 문서
```

---

## 🚀 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm run dev
```

### 3. 프로덕션 빌드
```bash
npm run build
```
빌드된 파일은 `dist/` 디렉토리에 생성됩니다.

### 4. 빌드 미리보기
```bash
npm run preview
```

---

## 🎨 주요 기능

### 1. 로그인 및 인증
- JWT 기반 인증 시스템
- 로그인 상태 유지 (LocalStorage)
- 인증되지 않은 사용자 접근 차단 (ProtectedRoute)

### 2. 대시보드
- 📊 월간/연간 이용자 증감 그래프
- 📈 최근 생성된 프로젝트 목록
- 👥 최근 가입한 회원 목록
- 📉 주요 지표 통계

### 3. 회원 관리
- **전체 회원 탭**: 모든 회원 정보 조회
- **신고받은 회원 탭**: 신고 내역 조회 및 처리
  - 신고 상태 변경 (대기중 ↔ 처리완료)
  - 회원 차단/해제
- **차단된 회원 탭**: 차단된 회원 목록 및 해제
- 페이지네이션 지원

### 4. 프로젝트 관리
- 등록된 프로젝트 전체 조회
- 프로젝트 삭제 기능
- 프로젝트 상태별 필터링

### 5. 공모전 관리
- 공모전 등록 (이름)
- 공모전 목록 조회
- 공모전 삭제

### 6. AI 모델 관리 ⭐
- **모델 정확도 조회**
  - 후보생성 모델 (Embedding): HitRate@K, Recall@K
  - 재정렬 모델 (Ranking): NDCG@4, Precision@4
  - 수락확률 모델 (Acceptor): PR-AUC, F1 Score
- **모델 파라미터 수정**
  - Learning Rate 조정
  - 실시간 반영

---

## 🧪 Mock 데이터 사용
개발 및 테스트 시 백엔드 서버 없이 프론트엔드를 실행할 수 있습니다.

### Mock 모드 활성화
`src/utils/api.js` 파일을 수정:

```javascript
// ⚠️ 배포 환경에서는 반드시 false!!!
export const USE_MOCK_API = true;  // Mock 데이터 사용
```

### Mock 데이터 위치
모든 Mock 데이터는 `src/utils/mockData.js`에 정의되어 있습니다:

```javascript
export const mockData = {
  login: { ... },        // 로그인 응답
  users: { ... },        // 회원 목록
  reports: { ... },      // 신고 내역
  projects: { ... },     // 프로젝트 목록
  contests: { ... },     // 공모전 목록
  dashboard: { ... },    // 대시보드 데이터
  aiModelAccuracy: { ... } // AI 모델 정확도
};
```

### Mock 데이터 커스터마이징
필요에 따라 `mockData.js` 파일을 수정하여 테스트 데이터를 변경할 수 있습니다.

---

## 🚢 배포 가이드
### 체크리스트
#### ✅ Mock 모드 비활성화
#### ✅ API URL 확인
백엔드 서버 주소가 올바른지 확인



