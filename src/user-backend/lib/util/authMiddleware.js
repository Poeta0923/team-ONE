// jsonwebtoken 라이브러리 로드 (토큰 확인에 사용)
const jwt = require('jsonwebtoken');
// 프로젝트 전역 로거 (Winston) 로드
const logger = require('../util/logger'); 

// 환경 변수에서 JWT Secret Key 로드 (로그인 로직에서 사용한 것과 동일해야 함)
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

/**
 * @description HTTP 요청 헤더에서 JWT를 검증하고, 유효한 경우 사용자 정보를 req.user에 저장하는 미들웨어
 * @param {object} req Express Request 객체
 * @param {object} res Express Response 객체
 * @param {function} next 다음 미들웨어 또는 라우트 핸들러 함수
 */
const verifyToken = (req, res, next) => {
    // 1. 요청 헤더에서 'Authorization' 필드 추출
    // 일반적으로 'Bearer <token>' 형식으로 전달됩니다.
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // 토큰이 없거나 형식이 잘못된 경우
        logger.debug('[Auth Fail] 토큰 누락 또는 형식 오류');
        return res.status(401).json({ message: 'Authorization token required' });
    }

    // 2. 'Bearer ' 부분을 제거하고 순수한 토큰 문자열 추출
    const token = authHeader.split(' ')[1];

    // 3. jwt.verify()를 사용하여 토큰 유효성 검사
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            // 토큰이 유효하지 않은 경우 (만료, 변조, 잘못된 Secret Key 등)
            logger.debug(`[Auth Fail] 토큰 검증 실패: ${err.message}`);
            // 403 Forbidden 대신 401 Unauthorized를 사용하여 인증 문제임을 명확히 합니다.
            return res.status(401).json({ message: 'Invalid or expired token' });
        }

        // 4. 토큰이 유효한 경우: 디코딩된 payload를 req 객체에 저장
        // 이 정보는 로그인 시 토큰에 넣었던 { id: user.userId } 정보입니다.
        // 다음 라우트 핸들러에서 req.user.id를 통해 로그인 사용자 정보를 사용할 수 있습니다.
        req.user = decoded; 
        
        logger.debug(`[Auth Success] 토큰 유효함. 사용자 ID: ${req.user.userId}`);
        // 5. 다음 미들웨어 또는 라우트 핸들러로 제어권 넘기기
        next();
    });
};

module.exports = verifyToken;