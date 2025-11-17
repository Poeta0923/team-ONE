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

// [새로 추가된 모듈] Node.js에서 외부 프로그램(JAR)을 실행하기 위한 모듈
const { spawn } = require('child_process');
// [새로 추가된 모듈] HTTP 요청을 다른 서버로 전달하는 프록시 미들웨어
const { createProxyMiddleware } = require('http-proxy-middleware');

// =================================================================
// 2. Global Middleware Configuration
// =================================================================

// [1] 요청 본문(body) 파싱 설정
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// [2] 기타 미들웨어: favicon 처리
app.get('/favicon.ico', (req, res) => res.status(404).end());

// =================================================================
// 3. Spring Boot Child Process & Proxy Configuration
// =================================================================

const SPRING_BOOT_INTERNAL_PORT = 10000;
const SPRING_BOOT_JAR_FILENAME = '../admin-backend/team-ONE/build/libs/admin-server-0.0.1-SNAPSHOT.jar';

let springProcess = null;

function startSpringBoot() {
    logger.info(`Starting Spring Boot server (${SPRING_BOOT_JAR_FILENAME}) on internal port ${SPRING_BOOT_INTERNAL_PORT}...`);

    springProcess = spawn('java', ['-jar', SPRING_BOOT_JAR_FILENAME], { detached: false });

    springProcess.stdout.on('data', (data) => {
        logger.debug(`[SB-OUT] ${data.toString().trim()}`);
    });

    springProcess.stderr.on('data', (data) => {
        logger.info(`[SB-ERR] ${data.toString().trim()}`);
    });

    springProcess.on('error', (err) => {
        logger.error(`Failed to start Spring Boot process: ${err.message}`);
    });

    springProcess.on('close', (code) => {
        logger.warn(`Spring Boot process exited with code ${code}`);
    });
}

// =================================================================
// 4. Router & Service Implementation
// =================================================================

// Spring Boot 프록시 (/admin)
app.use(
    '/admin',
    createProxyMiddleware({
        target: `http://localhost:${SPRING_BOOT_INTERNAL_PORT}`,
        changeOrigin: true,
        pathRewrite: { '^/admin': '' },
        onProxyReq: (proxyReq, req, res) => {
            logger.info(`Proxying request: ${req.method} ${req.originalUrl} -> ${SPRING_BOOT_INTERNAL_PORT}${req.url}`);
        }
    })
);

// 기존 Node.js 라우터 연결
app.use('/api', require('./router/rootRouter'));
app.use('/api/auth', require('./router/authRouter'));
app.use('/api/project', require('./router/projectRouter'));
app.use('/api/myPage', require('./router/myPageRouter'));
app.use('/api/resume', require('./router/resumeRouter'));
app.use('/api/chat', require('./router/chatRouter'));

// =================================================================
// 4-1. WebSocket Routes
// =================================================================

const verifyToken = require('./lib/util/authMiddleware');
const message = require('./lib/chat/message');
const invite = require('./lib/chat/invite');

// WebSocket 인증: 해당 경로로 들어오는 요청은 핸드셰이크 단계에서 JWT 검증
app.use('/api/chat/message', verifyToken);
app.ws('/api/chat/message', (ws, req) => {
    logger.info(`WS /api/chat/message - User: ${req.user ? req.user.userId : 'N/A'}`);
    // message.js 내에서 ws.on('message') / ws.on('close') 처리
    message.message(ws, req);
});

app.use('/api/chat/invite', verifyToken);
app.ws('/api/chat/invite', (ws, req) => {
    logger.info(`WS /api/chat/invite - User: ${req.user ? req.user.userId : 'N/A'}`);
    invite.invite(ws, req);
});

// =================================================================
// 5. Server Initialization
// =================================================================

const PORT = process.env.PORT || 60002;
const HOST = process.env.HOST || '0.0.0.0';

startSpringBoot();

app.listen(PORT, HOST, () => {
    logger.info(`Server is running at http://${HOST}:${PORT}`);
    logger.info(`Spring Boot is running internally on port ${SPRING_BOOT_INTERNAL_PORT}`);
    logger.info(`Spring Boot API access path: http://${HOST}:${PORT}/admin/*`);
});

// =================================================================
// 6. Graceful Shutdown
// =================================================================

process.on('SIGTERM', () => {
    logger.warn('SIGTERM received. Shutting down gracefully...');
    if (springProcess) {
        logger.warn('Terminating Spring Boot child process...');
        springProcess.kill();
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.warn('SIGINT received. Shutting down gracefully...');
    if (springProcess) {
        logger.warn('Terminating Spring Boot child process...');
        springProcess.kill();
    }
    process.exit(0);
});

// =================================================================
// 7. Global Error Handler (HTTP 공통)
// =================================================================

app.use((err, req, res, next) => {
    logger.error(`Global Error: ${err.message}`);

    if (res.headersSent) {
        return next(err);
    }

    res.status(err.status || 500).json({ error: err.message });
});
