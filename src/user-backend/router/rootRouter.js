// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// Express 프레임워크 로드
const express = require('express');
// Express Router 인스턴스 생성
const router = express.Router();
// 프로젝트 전역 로거 로드 (Winston)
const logger = require('../lib/logger');

// =================================================================
// 2. Library Js Files Routing (외부 모듈/컨트롤러 로드)
// =================================================================

// 홈 화면 호출에 필요한 데이터를 반환하는 모듈 호출
const mainPage = require('../lib/mainPage');


// =================================================================
// 3. API Route Endpoints Definition
// =================================================================

// [1] [GET] /api/homePage 경로 정의
// 홈 페이지 정보 요청을 처리하는 라우트 핸들러
router.get('/homePage', (req, res)=>{
    // 요청 진입 시 logger.info로 로그 기록 (API 호출 추적)
    logger.info(`GET /api/mainPage`);
    
    // 실제 인증 로직은 'mainPage' 컨트롤러 모듈로 위임
    // (이 함수 내에서 JWT 토큰 payload를 확인 후 정보를 조회하여 응답)
    login.login(req, res);
})

// 다른 파일(server.js)에서 사용할 수 있도록 router 객체 내보내기
module.exports = router;