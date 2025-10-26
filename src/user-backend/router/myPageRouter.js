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

// [1] 마이페이지 정보 요청 모듈 호출
const myPage = require('../lib/myPage');

// [2] 프로필 수정 요청 모듈 호출
const editProfile = require('../lib/myPage/editProfile');

// [3] 이력서 수정 요청 모듈 호출
const editResume = require('../lib/myPage/editResume');

// =================================================================
// 3. API Route Endpoints Definition
// =================================================================

// [1] [GET] /api/myPage 경로 정의
router.get('/', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`GET /api/myPage - User: ${req.user ? req.user.userid : 'N/A'}`);

    // myPage.myPage 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    myPage.myPage(req, res);
})

// [2] [PATCH] /api/myPage/profile/edit 경로 정의
router.patch('/profile/edit', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`PATCH /api/myPage/profile/edit - User: ${req.user ? req.user.userId : 'N/A'}`);

    // editProfile.editProfile 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    editProfile.editProfile(req, res);
})

// [3] [PATCH] /api/myPage/resume/edit 경로 정의
router.patch('/resume/edit', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`PATCH /api/myPage/resume/edit - User: ${req.user ? req.user.userId : 'N/A'}`);

    // editResume.editResume 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    editResume.editResume(req, res);
})