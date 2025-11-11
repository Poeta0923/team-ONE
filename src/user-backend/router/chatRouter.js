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

// [1] 1대1 채팅방 생성 모듈 호출
const private = require('../lib/chat/private');

// [2] 채팅 전송 모듈 호출
const message = require('../lib/chat/message');

// [3] 채팅 목록 조회 모듈 호출
const list = require ('../lib/chat/list');

// =================================================================
// 3. API Route Endpoints Definition
// =================================================================

// [1] [POST] /api/chat/private 경로 정의
router.post('/private', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`POST /api/chat/private - User: ${req.user ? req.user.userId : 'N/A'}`);

    // private.private 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    private.private(req, res);
})

// [2] [WS] /api/chat/message 경로 정의
router.ws('/message', verifyToken, (ws, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`WS /api/chat/message - User: ${req.user ? req.user.userId : 'N/A'}`);

    // message.message 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    message.message(ws, res);
})

// [3] [GET] /api/chat/list 경로 정의
router.get('/private', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`GET /api/chat/list - User: ${req.user ? req.user.userId : 'N/A'}`);

    // list.list 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    list.list(req, res);
})

// 다른 파일(server.js)에서 사용할 수 있도록 router 객체 내보내기
module.exports = router;