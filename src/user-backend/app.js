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
// Express WebSocket 통합 모듈 로드 및 적용
const expressWs = require('express-ws')(app);

// =================================================================
// 2. Global Middleware Configuration
// =================================================================

// [1] 요청 본문(body) 파싱 설정
// JSON 형식의 요청 본문 파싱 추가 (대부분의 API 요청에서 사용)
app.use(bodyParser.json()); 

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

// 필요한 라우터 파일 및 미들웨어/컨트롤러 로드
const rootRouter = require('./router/rootRouter');
const authRouter = require('./router/authRouter');
const projectRouter = require('./router/projectRouter');
const myPageRouter = require('./router/myPageRouter');
const resumeRouter = require('./router/resumeRouter');
const chatRouter = require('./router/chatRouter');

// [WebSocket 라우팅을 위해 추가]
const verifyToken = require('./lib/util/authMiddleware'); // JWT 인증 미들웨어
const message = require('./lib/chat/message'); // 채팅 전송 모듈

// HTTP 라우터 연결
app.use('/api', rootRouter);
app.use('/api/auth', authRouter);
app.use('/api/project', projectRouter);
app.use('/api/myPage', myPageRouter);
app.use('/api/resume', resumeRouter);
app.use('/api/chat', chatRouter);

// [WS] /api/chat/message 경로 정의 (WebSocket 핸들러)
// express-ws의 제한으로 인해 app.js에서 직접 WebSocket 라우팅을 정의합니다.
app.ws('/api/chat/message', verifyToken, (ws, req)=>{
    // 이 라우트 핸들러는 verifyToken을 성공적으로 통과했을 때만 실행됩니다.
    logger.info(`WS /api/chat/message - User: ${req.user ? req.user.userId : 'N/A'}`);

    // message.message 함수가 실행될 때 req.user 객체가 존재함을 보장합니다.
    message.message(ws, req);
})


// =================================================================
// 4. Server Initialization
// =================================================================

const PORT = process.env.PORT || 60002;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    // Winston logger를 사용하여 서버 시작 정보 기록
    logger.info(`Server is running at http://${HOST}:${PORT}`);
});