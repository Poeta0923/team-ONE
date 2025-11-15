// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// Express 프레임워크 로드
const express = require('express');
// Express Router 인스턴스 생성
// **주의: 표준 Express Router는 .ws() 메서드를 지원하지 않으므로, 
// WebSocket 라우트는 app.js에서 직접 처리합니다.**
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

// [2] 채팅 목록 조회 모듈 호출
const list = require ('../lib/chat/list');

// [3] 채팅 화면 반환 모듈 호출
const room = require('../lib/chat/room');

// [4] 메뉴 필요 정보 반환 모듈 호출
const menu = require('../lib/chat/menu');

// [5] 프로젝트 초대 수락 모듈 호출
const accept = require('../lib/chat/accept');

// =================================================================
// 3. API Route Endpoints Definition
// =================================================================

// [1] [POST] /api/chat/private 경로 정의 (1대1 채팅방 생성)
router.post('/private', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`POST /api/chat/private - User: ${req.user ? req.user.userId : 'N/A'}`);

    // private.private 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    private.private(req, res);
})

// [2] [GET] /api/chat/list 경로 정의 (채팅 목록 조회)
router.get('/list', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`GET /api/chat/list - User: ${req.user ? req.user.userId : 'N/A'}`);

    // list.list 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    list.list(req, res);
})

// [3] [GET] /api/chat/room/:roomId 경로 정의
router.get('/room/:roomId', verifyToken, (req, res) => {
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`GET /api/chat/room/${req.params.roomId} - User: ${req.user ? req.user.userId : 'N/A'}`);

    room.getMessages(req, res);
});

// [4] [GET] /api/chat/menu/:roomId 경로 정의
router.get('/menu/:roomId', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`GET /api/chat/menu/${req.params.roomId} - User: ${req.user ? req.user.userId : 'N/A'}`);

    menu.menu(req, res);
})

// [5] [POST] /api/chat/accept 경로 정의
router.post('/accept', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`GET /api/chat/accept - User: ${req.user ? req.user.userId : 'N/A'}`);

    accept.accept(req, res);
})

// 다른 파일(server.js)에서 사용할 수 있도록 router 객체 내보내기
module.exports = router;