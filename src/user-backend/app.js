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

// ✅ app을 먼저 만들고 express-ws에 넘김
const app = express();
const expressWs = require('express-ws')(app);

const { spawn } = require('child_process');
// [새로 추가된 모듈] HTTP 요청을 다른 서버로 전달하는 프록시 미들웨어
const { createProxyMiddleware } = require('http-proxy-middleware');

// 파일 업로드용
const path = require('path');
const fs = require('fs');

// =================================================================
// 1-1. 업로드 디렉토리 자동 생성
// =================================================================

const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    logger.info(`📁 uploads 폴더 자동 생성됨: ${uploadDir}`);
} else {
    logger.info(`📁 uploads 폴더 확인됨: ${uploadDir}`);
}

// Express static으로 외부 접근 가능하도록 처리
app.use('/uploads', express.static(uploadDir));


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

    springProcess = spawn(
        'java',
        ['-jar', SPRING_BOOT_JAR_FILENAME, '--spring.profiles.active=prod'],
        { detached: false }
    );

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

app.use(
    '/admin',
    createProxyMiddleware({
        target: `http://localhost:${SPRING_BOOT_INTERNAL_PORT}`,
        changeOrigin: true,
        onProxyReq: (proxyReq, req, res) => {
            logger.info(`Proxy: ${req.method} ${req.originalUrl} -> ${SPRING_BOOT_INTERNAL_PORT}${req.url}`);
        }
    })
);

// Node API 라우터
app.use('/api', require('./router/rootRouter'));
app.use('/api/auth', require('./router/authRouter'));
app.use('/api/project', require('./router/projectRouter'));
app.use('/api/myPage', require('./router/myPageRouter'));
app.use('/api/resume', require('./router/resumeRouter'));
app.use('/api/chat', require('./router/chatRouter'));
app.use('/api/chatUpload', require('./router/chatUploadRouter')); // ← 파일 업로드 라우터 추가


// =================================================================
// 4-1. WebSocket Routes (verifyToken을 HTTP 미들웨어로 사용)
// =================================================================

const verifyToken = require('./lib/util/authMiddleware');
const message = require('./lib/chat/message');
const invite = require('./lib/chat/invite');
const resume = require('./lib/chat/resume');

// 🎯 WebSocket 경로별로 먼저 verifyToken을 일반 미들웨어로 적용
app.use('/api/chat/message', verifyToken);
app.use('/api/chat/invite', verifyToken);
app.use('/api/chat/resume', verifyToken);

// 그리고 나서 WS 핸들러 등록
app.ws('/api/chat/message', (ws, req) => {
    logger.info(`WS /api/chat/message - User: ${req.user?.userId || 'N/A'}`);
    message.message(ws, req);
});

app.ws('/api/chat/invite', (ws, req) => {
    logger.info(`WS /api/chat/invite - User: ${req.user?.userId || 'N/A'}`);
    invite.invite(ws, req);
});

app.ws('/api/chat/resume', (ws, req) => {
    logger.info(`WS /api/chat/resume - User: ${req.user?.userId || 'N/A'}`);
    resume.resume(ws, req);
});


// =================================================================
// 5. Server Initialization
// =================================================================

const PORT = process.env.PORT || 60002;
const HOST = process.env.HOST || '0.0.0.0';

startSpringBoot();

app.listen(PORT, HOST, () => {
    logger.info(`🚀 Server is running at http://${HOST}:${PORT}`);
    logger.info(`🔧 Spring Boot running on port ${SPRING_BOOT_INTERNAL_PORT}`);
    logger.info(`🔗 Admin API: http://${HOST}:${PORT}/admin/*`);
});


// =================================================================
// 6. Graceful Shutdown
// =================================================================

process.on('SIGTERM', () => {
    logger.warn('SIGTERM received. Shutting down gracefully...');
    if (springProcess) springProcess.kill();
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.warn('SIGINT received. Shutting down gracefully...');
    if (springProcess) springProcess.kill();
    process.exit(0);
});


// =================================================================
// 7. Global Error Handler (HTTP 공통)
// =================================================================

app.use((err, req, res, next) => {
    logger.error(`Global Error: ${err.message}`);

    if (res.headersSent) return next(err);

    res.status(err.status || 500).json({ error: err.message });
});
