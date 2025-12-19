// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// Express 프레임워크 로드
const express = require('express');
// Express Router 인스턴스 생성
const router = express.Router();
// 프로젝트 전역 로거 로드 (Winston)
const logger = require('../lib/util/logger');
// JWT 인증 미들웨어 로드 (인증 로직을 라우터에 적용하기 위해 필요)
const verifyToken = require('../lib/util/authMiddleware');

// =================================================================
// 2. Library Js Files Routing (외부 모듈/컨트롤러 로드)
// =================================================================

// 홈 화면 호출에 필요한 데이터를 반환하는 모듈 호출
const resume = require('../lib/resume');

// =================================================================
// 3. API Route Endpoints Definition
// =================================================================

// [1] [GET] /api/resume 경로 정의
router.get('/:userId', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`GET /api/resume - User: ${req.user ? req.user.userId : 'N/A'}`);

    // resume.resume 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    resume.resume(req, res);
})

// 다른 파일(server.js)에서 사용할 수 있도록 router 객체 내보내기
module.exports = router;