// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// HTTP 요청 본문 파싱 미들웨어 로드
const bodyParser = require('body-parser');
// 데이터베이스 연결 모듈 로드 (db.js에서 완성된 연결 객체를 가져옴)
const db = require('../util/db');
// 프로젝트 전역 로거 (Winston) 로드
const logger = require('../util/logger');
// 단방향 해시 알고리즘 로드 (비밀번호 해싱에 사용)
const bycrypt = require('bcrypt');
// jsonwebtoken 라이브러리 로드 (인증 토큰 생성 및 관리에 사용)
const jwt = require('jsonwebtoken');

// 입력 객체 Sanitization 유틸리티 로드 (XSS 방지 및 기본 입력 Sanitization)
const sanitize = require('../util/sanitize'); 

// 환경 변수에서 JWT Secret Key 및 만료 시간 로드
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// =================================================================
// 2. Utility Functions
// =================================================================

/**
 * @description MySQL 쿼리를 Promise 기반으로 감싸 async/await 사용을 가능하게 합니다.
 * @param {string} sql 실행할 SQL 쿼리 문자열
 * @param {Array} values SQL 쿼리에 바인딩할 값들의 배열
 * @returns {Promise<object>} 쿼리 결과를 resolve하는 프로미스
 */
const queryPromise = (sql, values) => {
    return new Promise((resolve, reject) => {
        db.query(sql, values, (error, result) => {
            if (error) {
                return reject(error);
            }
            resolve(result);
        });
    });
};

// =================================================================
// 3. Feature Implement (모듈 내보내기)
// =================================================================

module.exports = {

    /**
     * @description 사용자 회원가입 처리 및 JWT 토큰 발급
     * @param {object} req Express Request 객체
     * @param {object} res Express Response 객체
     */
    signUp: async (req, res) => {
        try {
            // [1] 사용자 입력 추출 및 Sanitization (18개 항목 포함)
            // NOTE: sanitize을 사용하여 모든 문자열 입력에 XSS 방어 적용
            const sanitizedPost = sanitize.sanitizeObject(req.body); 
            
            logger.debug(`[SignUp] 회원가입 시도`);

            // [2] 비밀번호 해싱 (보안 필수)
            // NOTE: 안전성을 위해 솔트 라운드(salt rounds)는 10 사용
            const hashedPassword = await bycrypt.hash(sanitizedPost.password, 10);

            // [3] SQL 쿼리 정의
            // users 테이블 (role, name, birth, phoneNumber, id, password, nickName, job) - 총 8개 필드
            const sql1 = `
                INSERT INTO users (role, name, birth, phoneNumber, id, password, nickName, job) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const userValues = [
                'user', // role 기본값
                sanitizedPost.name, 
                sanitizedPost.birth, 
                sanitizedPost.phoneNumber, 
                sanitizedPost.id, 
                hashedPassword, // ★ 해싱된 비밀번호 사용
                sanitizedPost.nickName, 
                sanitizedPost.job
            ];

            // resumes 테이블 (userId, address, mbti, workStyle, workTime, techStack, interest, gitHub, blog, projectExp, coverLetter) - 총 11개 필드
            const sql3 = `
                INSERT INTO resumes (userId, address, mbti, workStyle, workTime, techStack, interest, gitHub, blog, projectExp, coverLetter) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            // ===================================================
            // [4] DB 트랜잭션 실행 (async/await으로 순차적 처리)
            // ===================================================
            
            // [4-1] 회원 정보 저장 (users 테이블)
            const result1 = await queryPromise(sql1, userValues);
            
            // 방금 삽입된 레코드의 고유 ID (userId) 획득
            const newUserId = result1.insertId;

            // [4-2] 이력서 정보 저장 (resumes 테이블)
            const resumeValues = [
                newUserId, // sql1 쿼리에서 얻은 userId 사용
                sanitizedPost.address, 
                sanitizedPost.mbti, 
                sanitizedPost.workStyle, 
                sanitizedPost.workTime, 
                sanitizedPost.techStack, 
                sanitizedPost.interest, 
                sanitizedPost.gitHub, 
                sanitizedPost.blog, 
                sanitizedPost.projectExp, 
                sanitizedPost.coverLetter
            ];
            
            await queryPromise(sql3, resumeValues);

            // [5] 회원가입 성공 및 JWT 토큰 생성
            logger.info(`[SignUp Success] 사용자 로그인 성공: ${sanitizedPost.id}`);
                            
            // 토큰 payload 정의: 민감하지 않은 사용자 고유 정보 포함
            const tokenPayload = {
                id: sanitizedPost.id,
                // role 등의 권한 정보도 여기에 포함 가능
            };

            // JWT 생성 (Secret Key와 만료 시간 적용)
            const token = jwt.sign(
                tokenPayload, 
                JWT_SECRET, 
                { expiresIn: JWT_EXPIRES_IN }
            );

            // 클라이언트에게 토큰과 함께 성공 응답 전송
            res.status(201).json({
                message: 'SignUp successful',
                token: token,
                expiresIn: JWT_EXPIRES_IN
            });


        } catch (error) {
            // [6] 오류 처리
            // NOTE: DB 오류(중복 ID 등) 및 기타 모든 오류를 여기서 처리
            logger.error(`[SignUp Error] 회원가입 처리 중 오류 발생: ${error.message}`, error);
            
            // 클라이언트에게 오류 메시지 반환
            // (TODO: ID 중복과 같은 특정 오류는 409 Conflict 등으로 분리 처리 필요)
            res.status(500).json({ message: '회원가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
        }
    }
};