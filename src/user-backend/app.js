// =================================================================
// 1. Core Modules & Configuration
// =================================================================

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
// logger는 프로젝트 구조에 따라 가정합니다.
const logger = require('./lib/util/logger'); 
const app = express();
const expressWs = require('express-ws')(app);

const { spawn } = require('child_process');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const fs = require('fs');

// =================================================================
// 1-1. Upload Directory
// =================================================================

const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    logger.info(`📁 uploads 폴더 자동 생성됨: ${uploadDir}`);
} else {
    logger.info(`📁 uploads 폴더 확인됨: ${uploadDir}`);
}

app.use('/uploads', express.static(uploadDir));

// =================================================================
// 2. Middleware
// =================================================================

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/favicon.ico', (req, res) => res.status(404).end());

// =================================================================
// 3. Spring Boot Child Process
// =================================================================

const SPRING_BOOT_INTERNAL_PORT = 10000;
const SPRING_BOOT_JAR_FILENAME =
    '../admin-backend/team-ONE/build/libs/admin-server-0.0.1-SNAPSHOT.jar';

let springProcess = null;

function startSpringBoot() {
    logger.info(`Starting Spring Boot server (${SPRING_BOOT_JAR_FILENAME}) on port ${SPRING_BOOT_INTERNAL_PORT}`);

    springProcess = spawn(
        'java',
        ['-jar', SPRING_BOOT_JAR_FILENAME, '--spring.profiles.active=prod'],
        { detached: false }
    );

    springProcess.stdout.on('data', data => logger.debug(`[SB-OUT] ${data.toString().trim()}`));
    springProcess.stderr.on('data', data => logger.info(`[SB-ERR] ${data.toString().trim()}`));

    springProcess.on('error', err => logger.error(`Failed to start Spring Boot process: ${err.message}`));
    springProcess.on('close', code => logger.warn(`Spring Boot stopped with code ${code}`));
}

// =================================================================
// 4. Frontend (React Admin) 정적 파일 서빙
// =================================================================

const adminDistPath = path.join(__dirname, '../admin-frontend/');
const absolutePath = path.resolve(adminDistPath);

logger.info(`📦 React 빌드 폴더 상대경로: ${adminDistPath}`);
logger.info(`📦 React 빌드 폴더 절대경로: ${absolutePath}`);

// 폴더 존재 확인 로직 (디버깅용)
if (!fs.existsSync(adminDistPath)) {
    logger.error(`❌ React 빌드 폴더가 존재하지 않음: ${absolutePath}`);
} else {
    logger.info(`✅ React 빌드 폴더 확인됨: ${absolutePath}`);
    
    const indexPath = path.join(adminDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        logger.info(`✅ index.html 발견: ${indexPath}`);
    } else {
        logger.error(`❌ index.html 없음: ${indexPath}`);
    }
    
    const assetsPath = path.join(adminDistPath, 'assets');
    if (fs.existsSync(assetsPath)) {
        const files = fs.readdirSync(assetsPath);
        logger.info(`✅ assets 폴더 발견 (파일 ${files.length}개)`);
        logger.debug(`📁 assets 파일 목록: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
    } else {
        logger.error(`❌ assets 폴더 없음: ${assetsPath}`);
    }
}

// 정적 파일 서빙 (프록시보다 먼저 실행되어야 페이지 로드 시 정적 파일이 정상적으로 서빙됨)
app.use(express.static(adminDistPath));

// =================================================================
// 5. Spring Boot API Proxy (스마트 감지 및 응답 로깅)
// =================================================================

app.use(
    '/admin',
    (req, res, next) => {
        // GET 요청만 페이지/API 구분 필요
        if (req.method === 'GET') {
            const acceptHeader = req.headers.accept || '';
            
            // 브라우저가 HTML을 원하면 → React 페이지 (프록시 건너뜀)
            if (acceptHeader.includes('text/html')) {
                logger.info(`📄 페이지 요청: ${req.originalUrl} → React SPA (Skipping Proxy)`);
                return next('route'); 
            }
            
            // JSON이나 기타 → Spring Boot API
            logger.info(`📡 GET API 요청: ${req.originalUrl} → Spring Boot (Proxying)`);
            return next(); 
        }
        
        // POST, PUT, DELETE, PATCH 등 → 무조건 API
        logger.info(`🔧 ${req.method} API 요청: ${req.originalUrl} → Spring Boot (Proxying)`);
        next(); 
    },
    createProxyMiddleware({
        target: `http://localhost:${SPRING_BOOT_INTERNAL_PORT}`,
        changeOrigin: true,
        pathRewrite: { '^/admin': '/admin' },
        onProxyReq: (proxyReq, req, res) => {
            logger.info(`→ Proxying Request to Spring Boot: ${req.method} ${req.originalUrl}`);
        },
        // 🔥 응답 감지 로직 추가 (응답 상태 코드 로깅)
        onProxyRes: (proxyRes, req, res) => {
            logger.info(`⬅️ Response Status from Spring Boot: ${proxyRes.statusCode} for ${req.originalUrl}`);
        },
        onError: (err, req, res) => {
            logger.error(`❌ Proxy Error for ${req.originalUrl}: ${err.code || err.message}`);
            res.status(503).json({
                error: 'Backend Service Unavailable',
                message: `Spring Boot 서버 접속 실패: ${err.code || err.message}`
            });
        }
    })
);

// =================================================================
// 6. Node.js API Routes (로컬 API)
// =================================================================
// 경로가 /api로 시작하는 요청은 Node.js에서 처리됩니다.

app.use('/api', require('./router/rootRouter'));
app.use('/api/auth', require('./router/authRouter'));
app.use('/api/project', require('./router/projectRouter'));
app.use('/api/myPage', require('./router/myPageRouter'));
app.use('/api/resume', require('./router/resumeRouter'));
app.use('/api/chat', require('./router/chatRouter'));
app.use('/api/chatUpload', require('./router/chatUploadRouter'));

// =================================================================
// 7. WebSocket Routes
// =================================================================
// WebSocket 연결 처리

const verifyToken = require('./lib/util/authMiddleware');
const message = require('./lib/chat/message');
const invite = require('./lib/chat/invite');
const resumeChat = require('./lib/chat/resume');

app.use('/api/chat/message', verifyToken);
app.use('/api/chat/invite', verifyToken);
app.use('/api/chat/resume', verifyToken);

app.ws('/api/chat/message', (ws, req) => {
    logger.info(`WS /api/chat/message`);
    message.message(ws, req);
});

app.ws('/api/chat/invite', (ws, req) => {
    logger.info(`WS /api/chat/invite`);
    invite.invite(ws, req);
});

app.ws('/api/chat/resume', (ws, req) => {
    logger.info(`WS /api/chat/resume`);
    resumeChat.resume(ws, req);
});

// =================================================================
// 8. React SPA Fallback (화면 라우팅 Catch-all)
// =================================================================
// 🔥 정규식 사용: 모든 처리되지 않은 GET 요청을 index.html로 보냄 (라우팅 오류 해결)

app.get(/.*/, (req, res) => { 
    // 브라우저가 HTML 요청을 했고, 이전에 처리된 API나 정적 파일이 아니라면 SPA 진입점으로 보냄
    logger.info(`🏠 SPA Fallback: ${req.originalUrl} → index.html`);
    res.sendFile(path.join(adminDistPath, 'index.html'));
});

// =================================================================
// 9. Server Init
// =================================================================

const PORT = process.env.PORT || 60002;
const HOST = process.env.HOST || '0.0.0.0';

startSpringBoot();

app.listen(PORT, HOST, () => {
    logger.info(`🚀 Node.js Server running at http://${HOST}:${PORT}`);
    logger.info(`🔧 Spring Boot running on port ${SPRING_BOOT_INTERNAL_PORT}`);
});

// =================================================================
// 10. Graceful Shutdown
// =================================================================

process.on('SIGTERM', () => {
    logger.warn('SIGTERM received. Shutting down...');
    if (springProcess) springProcess.kill();
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.warn('SIGINT received. Shutting down...');
    if (springProcess) springProcess.kill();
    process.exit(0);
});

// =================================================================
// 11. Global Error Handler
// =================================================================

app.use((err, req, res, next) => {
    logger.error(`Global Error: ${err.message}`);

    if (res.headersSent) return next(err);

    res.status(err.status || 500).json({ error: err.message });
});
