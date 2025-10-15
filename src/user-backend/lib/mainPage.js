// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// HTTP 요청 본문 파싱 미들웨어 로드 (사용자 입력을 req.body로 가져오기 위함)
const bodyParser = require('body-parser');
// 데이터베이스 연결 모듈 로드 (db.js에서 완성된 연결 객체를 가져옴)
const db = require('../util/db');
// 프로젝트 전역 로거 (Winston) 로드
const logger = require('../util/logger');
// jsonwebtoken 라이브러리 로드 (인증 토큰 생성 및 관리에 사용)
const jwt = require('jsonwebtoken');

// =================================================================
// 1. Feature Implement (모듈 내보내기)
// =================================================================

module.exports = {
    
}