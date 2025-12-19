// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// HTTP 요청 본문 파싱 미들웨어 로드 (사용자 입력을 req.body로 가져오기 위함)
const bodyParser = require('body-parser');
// 데이터베이스 연결 모듈 로드 (db.js에서 완성된 연결 객체를 가져옴)
const db = require('../util/db');
// 프로젝트 전역 로거 (Winston) 로드
const logger = require('../util/logger');
// HTML 파싱 & 필터링 라이브러리 로드 (XSS 방지 및 기본 입력 Sanitization)
var sanitizeHtml = require('sanitize-html');
// 단방향 해시 알고리즘 로드 (비밀번호 비교에 사용)
const bycrypt = require('bcrypt');
// jsonwebtoken 라이브러리 로드 (인증 토큰 생성 및 관리에 사용)
const jwt = require('jsonwebtoken');

// 환경 변수에서 JWT Secret Key 및 만료 시간 로드
// NOTE: .env 파일이 server.js에서 먼저 로드되어야 사용 가능
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// =================================================================
// 2. Feature Implement (모듈 내보내기)
// =================================================================

module.exports = {

    /**
     * @description 사용자 로그인 처리 및 JWT 토큰 발급
     * @param {object} req Express Request 객체
     * @param {object} res Express Response 객체
     */
    login: (req, res) => {
        // [1] 사용자 입력 추출 및 Sanitization
        const post = req.body;
        // 사용자 ID와 비밀번호를 HTML 태그 및 위험 문자로부터 정제
        const sntzedId = post.id; 
        const sntzedPassword = post.password;
        
        logger.debug(`[Login] ${post.id} 로그인 시도`);

        // [2] 데이터베이스에서 사용자 정보 조회
        db.query(
            // NOTE: DB에 저장된 암호화된 비밀번호와 고유 식별자를 조회
            `SELECT password, id, userId FROM users WHERE id = ?`,
            [sntzedId],
            (error, result) => {
                if (error) {
                    logger.error(`[DB Error] 로그인 조회 중 데이터베이스 오류 발생: ${error.message}`, error);
                    // 보안을 위해 상세 오류 대신 일반적인 오류 메시지 반환
                    res.status(500).json({ message: 'Internal Server Error' });
                    return;
                }

                // [3] 사용자 존재 여부 확인
                if (result.length === 1) {
                    const user = result[0];
                    const hashedPasswordFromDB = user.password;

                    // [4] 비밀번호 해시 비교 (비동기)
                    bycrypt.compare(sntzedPassword, hashedPasswordFromDB, (err, isMatch) => {
                        if (err) {
                            logger.error(`[Bcrypt Error] 비밀번호 비교 중 오류 발생: ${err.message}`, err);
                            res.status(500).json({ message: 'Internal Server Error' });
                            return;
                        }

                        if(isMatch) {
                            // [5-1] 로그인 성공 및 JWT 토큰 생성
                            logger.info(`[Login Success] 사용자 로그인 성공: ${user.userId}`);
                            
                            // 토큰 payload 정의: 민감하지 않은 사용자 고유 정보 포함
                            const tokenPayload = {
                                userId: user.userId,
                                // role 등의 권한 정보도 여기에 포함 가능
                            };

                            // JWT 생성 (Secret Key와 만료 시간 적용)
                            const token = jwt.sign(
                                tokenPayload, 
                                JWT_SECRET, 
                                { expiresIn: JWT_EXPIRES_IN }
                            );

                            // 클라이언트에게 토큰과 함께 성공 응답 전송
                            res.status(200).json({
                                message: 'Login successful',
                                token: token,
                                expiresIn: JWT_EXPIRES_IN
                            });

                        } else {
                            // [5-2] 비밀번호 불일치
                            logger.debug(`[Login Failed] 비밀번호 불일치. 시도 ID: ${user.userId}`);
                            res.status(401).json({ message: 'Invalid credentials' });
                            return;
                        }
                    });

                } else {
                    // [3-2] 사용자 ID가 DB에 없음
                    logger.debug(`[Login Failed] 해당 ID의 계정 없음. 시도 ID: ${post.id}`);
                    res.status(401).json({ message: 'Invalid credentials' });
                    return;
                }
            }
        )
    }
};