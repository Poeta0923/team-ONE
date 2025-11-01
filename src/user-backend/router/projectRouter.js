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

// [3] 프로젝트 수정 모듈 호출
const edit = require('../lib/project/edit');

// [4] 프로젝트 상세 정보 조회 모듈 호출
const detail = require('../lib/project/detail');

// [5] 프로젝트 삭제 모듈 호출
const deleteProject = require('../lib/project/delete');

// [6] 프로젝트 완료 처리 모듈 호출
const complete = require('../lib/project/complete');

// [7] 프로젝트 검색 모듈 호출
const search = require('../lib/project/search');

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
    logger.info(`POST /api/project/create - User: ${req.user ? req.user.userId : 'N/A'}`);

    // create.create 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    create.create(req, res);
})

// [3] [PATCH] api/project/edit/:projectId 경로 정의
router.patch('/edit/:projectId', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`GET /api/project/edit/:projectId - User: ${req.user ? req.user.userId : 'N/A'}`);

    // edit.edit 함수가 실행될 때 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    edit.edit(req, res);
})

// [4] [GET] api/project/detail/:projectId 경로 정의
router.get('/detail/:projectId', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`GET /api/project/detail/:projectId - User: ${req.user ? req.user.userId : 'N/A'}`);

    // detail.detail 함수가 실행될 때 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    detail.detail(req, res);
})

// [5] [DELETE] api/project/delete/:projectId 경로 정의
router.delete('/delete/:projectId', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`DELETE /api/project/delete/:projectId - User: ${req.user ? req.user.userId : 'N/A'}`);

    // delete.delete 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    deleteProject.delete(req, res);
})

// [6] [PATCH] api/project/complete/:projectId 경로 정의
router.patch('/complete/:projectId', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`PATCH /api/project/complete/:projectId - User: ${req.user ? req.user.userId : 'N/A'}`);

    // complete.complete 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    complete.complete(req, res);
})

// [7] [POST] api/project/search 경로 정의
router.post('/search', verifyToken, (req, res)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`GET /api/project/search - User: ${req.user ? req.user.userId : 'N/A'}`);

    // complete.complete 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    search.search(req, res);
})

// 다른 파일(server.js)에서 사용할 수 있도록 router 객체 내보내기
module.exports = router;