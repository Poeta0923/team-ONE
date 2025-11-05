// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// .env 파일의 환경 변수를 process.env로 로드
require('dotenv').config();

// Express 프레임워크 로드
const express = require('express');
// HTTP 요청 본문 파싱 미들웨어 로드 (HTML 폼 데이터 처리)
const bodyParser = require('body-parser'); 
// 프로젝트 전역 로거 (Winston) 로드
const logger = require('./lib/util/logger'); 
// Express 애플리케이션 인스턴스 생성
const app = express();

// =================================================================
// 2. Global Middleware Configuration
// =================================================================

// [1] 요청 본문(body) 파싱 설정
// JSON 형식의 요청 본문 파싱 추가 (대부분의 API 요청에서 사용)
app.use(bodyParser.json()); // ⬅️ 이 코드를 추가해야 합니다!

// application/x-www-form-urlencoded 형식의 데이터 파싱 (HTML Form POST 요청)
// extended: false는 Node.js 기본 라이브러리 사용을 의미
app.use(bodyParser.urlencoded({ extended: false }));

// [2] 기타 미들웨어: favicon 처리
// 브라우저의 favicon 요청(GET /favicon.ico)에 대한 404 응답 처리
// 서버 로그에 불필요한 에러/경고가 남는 것을 방지
app.get('/favicon.ico', (req, res) => res.status(404).end());

// =================================================================
// 3. Router & Service Implementation
// =================================================================

const rootRouter = require('./router/rootRouter');
const authRouter = require('./router/authRouter');
const projectRouter = require('./router/projectRouter');
const myPageRouter = require('./router/myPageRouter');
const resumeRouter = require('./router/resumeRouter');

// 라우터 연결
app.use('/api', rootRouter);
app.use('/api/auth', authRouter);
app.use('/api/project', projectRouter);
app.use('/api/myPage', myPageRouter);
app.use('/api/resume', resumeRouter);

// =================================================================
// 4. Server Initialization
// =================================================================

const PORT = process.env.PORT || 60002;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    // Winston logger를 사용하여 서버 시작 정보 기록
    logger.info(`Server is running at http://${HOST}:${PORT}`);
});