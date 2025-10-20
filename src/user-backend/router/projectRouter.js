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

// [1] 공모전 정보 요청 모듈 호출
const contest = require('../lib/project/contest');

// [2] 프로젝트 생성 모듈 호출
const create = require('../lib/project/create');

// [3] 프로젝트 상세 정보 조회 모듈 호출
const detail = require('../lib/project/detail');

// [4] 프로젝트 삭제 모듈 호출
const deleteProject = require('../lib/project/delete');

// [5] 프로젝트 완료 처리 모듈 호출
const complete = require('../lib/project/complete');

// =================================================================
// 3. API Route Endpoints Definition
// =================================================================

// [1] [GET] /api/project/contest 경로 정의
router.get('/contest', (req, res)=>{
    logger.info(`GET /api/project/contest`);
    contest.contest(req, res);
})

// [2] [POST] /api/project/create 경로 정의
router.post('/create', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`POST /api/project/create - User: ${req.user ? req.user.id : 'N/A'}`);

    // create.create 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    create.create(req, res);
})

// [3] [GET] api/project/detail/:projectId 경로 정의
router.get('detail/:projectId', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`GET /api/project/detail/:projectId - User: ${req/user ? req.user.id : N/A}`);

    // detail.detail 함수가 실행될 때 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    detail.detail(req, res);
})

// [4] [DELETE] api/project/delete/:projectId 경로 정의
router.delete('delete/:projectId', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`DELETE /api/project/delete/:projectId - User: ${req.user ? req.user.id : 'N/A'}`);

    // delete.delete 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    deleteProject.delete(req, res);
})

// [5] [PATCH] api/project/complete/:projectId 경로 정의
router.patch('/patch/:projectId', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`PATCH /api/project/complete/:projectId - User: ${req.user ? req.user.id : 'N/A'}`);

    // complete.complete 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    complete.complete(req, res);
})