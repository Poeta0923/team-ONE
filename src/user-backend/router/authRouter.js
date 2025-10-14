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

// [1] 로그인 로직을 처리하는 컨트롤러 모듈 로드
// (JWT 발급, 로그인 처리 등의 핵심 로직 포함)
const login = require('../lib/auth/login');

// [2] 회원가입 로직을 처리하는 컨트롤러 모듈 로드
// (회원가입, JWT 발급 등의 핵심 로직 포함)
const signUp = require('../lib/auth/signUp');


// =================================================================
// 3. API Route Endpoints Definition
// =================================================================

// [1] [POST] /api/auth/login 경로 정의
// 사용자 로그인 요청을 처리하는 라우트 핸들러
router.post('/login', (req, res)=>{
    // 요청 진입 시 logger.info로 로그 기록 (API 호출 추적)
    logger.info(`POST /api/auth/login`);
    
    // 실제 인증 로직은 'login' 컨트롤러 모듈로 위임
    // (이 함수 내에서 ID/PW 검증 후 JWT 토큰을 생성하여 응답)
    login.login(req, res);
})

// [2] [POST] /api/auth/signUp 경로 정의
// 사용자 회원가입 요청을 처리하는 라우트 핸들러
router.post('/signUp', (req, res)=>{
    // 요청 진입 시 logger.info로 로그 기록 (API 호출 추적)
    logger.info(`POST /api/auth/signUp`);
    
    // 실제 인증 로직은 'signUp' 컨트롤러 모듈로 위임
    // (이 함수 내에서 회원가입 처리 후 JWT 토큰을 생성하여 응답)
    signUp.signUp(req, res);
})

// 다른 파일(server.js)에서 사용할 수 있도록 router 객체 내보내기
module.exports = router;