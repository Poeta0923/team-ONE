const jwt = require('jsonwebtoken');
const logger = require('../util/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

/**
 * @description HTTP 및 WebSocket 겸용 JWT 인증 미들웨어
 */
const verifyToken = (req, res, next) => {
    let token = null;

    // --------------------------------------------------
    // 1. Authorization Header (일반 HTTP 요청)
    // --------------------------------------------------
const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
        logger.debug('[Auth Check] HTTP Header에서 토큰 발견');
    }

    // --------------------------------------------------
    // 2. WebSocket Query (?token=...)
    // --------------------------------------------------
    if (!token && req.query?.token) {
        token = req.query.token;
        logger.debug('[Auth Check] WS Query Parameter에서 토큰 발견');
    }

    // --------------------------------------------------
    // 3. 토큰 없음
    // --------------------------------------------------
    if (!token) {
        logger.debug('[Auth Fail] 토큰 누락');

        const error = new Error('Authorization token required');
        error.status = 401;
        return next(error); // HTTP/WS 핸드셰이크 모두 여기서 종료
    }

    // --------------------------------------------------
    // 4. JWT 검증
    // --------------------------------------------------
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            logger.debug(`[Auth Fail] 토큰 검증 실패: ${err.message}`);

            const error = new Error('Invalid or expired token');
            error.status = 401;
            return next(error);
        }

        // --------------------------------------------------
        // 5. 성공 → req.user 저장
        // --------------------------------------------------
        req.user = decoded;
        logger.debug(`[Auth Success] 사용자 ID: ${req.user.userId}`);

        next();
    });
};

module.exports = verifyToken;
