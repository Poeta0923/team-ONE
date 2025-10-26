// =================================================================
// 1. Core Modules & Configuration
// =================================================================

const bodyParser = require('body-parser');
const db = require('../util/db'); 
const logger = require('../util/logger');
const bycrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const sanitize = require('../util/sanitize'); 
// Node.js의 util 모듈 로드 (Promisify 사용을 위해)
const util = require('util'); 

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// =================================================================
// 2. Utility Functions (트랜잭션 처리를 위해 재정의)
// =================================================================

/**
 * @description 단일 MySQL 연결 객체를 사용하여 쿼리를 Promise 기반으로 실행합니다.
 * @param {object} connection 현재 사용 중인 DB 연결 객체
 * @param {string} sql 실행할 SQL 쿼리 문자열
 * @param {Array} values SQL 쿼리에 바인딩할 값들의 배열
 * @returns {Promise<object>} 쿼리 결과를 resolve하는 프로미스
 */
const connectionQueryPromise = (connection, sql, values) => {
    return new Promise((resolve, reject) => {
        connection.query(sql, values, (error, result) => {
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
     * @description 사용자 회원가입 처리 (트랜잭션 적용 및 데이터 타입 검증)
     */
    signUp: async (req, res) => {
        // connection 변수를 try 블록 밖에서 선언하여 finally에서도 접근 가능하게 함
        let connection; 

        try {
            // [1] 사용자 입력 추출 및 Sanitization
            const sanitizedPost = sanitize.sanitizeObject(req.body); 
            logger.debug(`[SignUp] 회원가입 시도: ${sanitizedPost.id}`);

            // [2] 비밀번호 해싱
            const hashedPassword = await bycrypt.hash(sanitizedPost.password, 10);

            // [3] DB 트랜잭션 시작 (연결 풀에서 연결을 얻어옴)
            connection = await util.promisify(db.getConnection).call(db); 
            await util.promisify(connection.beginTransaction).call(connection);

            
            // ===================================================
            // [4] DB 작업 실행 (원자성 확보)
            // ===================================================

            // [4-1] 회원 정보 저장 (users 테이블)
            const sql1 = `
                INSERT INTO users (role, name, birth, phoneNumber, id, password, nickName, job) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const userValues = [
                'user',
                sanitizedPost.name, 
                sanitizedPost.birth, 
                sanitizedPost.phoneNumber, 
                sanitizedPost.id, 
                hashedPassword,
                sanitizedPost.nickName, 
                sanitizedPost.job
            ];
            const result1 = await connectionQueryPromise(connection, sql1, userValues);
            const newUserId = result1.insertId;

            // [4-2] 이력서 정보 저장 (resumes 테이블)
            const sql3 = `
                INSERT INTO resumes (userId, address, mbti, workStyle, workTime, techStack, interest, gitHub, blog, projectExp, coverLetter) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            // BOOLEAN 타입 변환: 'true' 문자열 또는 true 불리언을 1로, 나머지를 0으로
            const projectExpValue = (sanitizedPost.projectExp === 'true' || sanitizedPost.projectExp === true || sanitizedPost.projectExp === 1) ? 1 : 0;
            
            const resumeValues = [
                newUserId, 
                sanitizedPost.address, 
                sanitizedPost.mbti, 
                sanitizedPost.workStyle, 
                sanitizedPost.workTime, 
                sanitizedPost.techStack, 
                sanitizedPost.interest, 
                sanitizedPost.gitHub, 
                sanitizedPost.blog, 
                projectExpValue,
                sanitizedPost.coverLetter
            ];
            
            await connectionQueryPromise(connection, sql3, resumeValues);
            await util.promisify(connection.commit).call(connection);

            // [5] 회원가입 성공 및 JWT 토큰 생성
            logger.info(`[SignUp Success] 사용자 ID: ${newUserId} 회원가입 및 커밋 완료`);
                            
            const tokenPayload = {
                userId: newUserId,
                // role: 'user', // users 쿼리에 role 필드를 포함하면 더 좋습니다.
            };

            const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

            res.status(201).json({
                message: 'SignUp successful',
                token: token,
                expiresIn: JWT_EXPIRES_IN
            });


        } catch (error) {
            // [6] 오류 처리 및 롤백
            if (connection) {
                // 오류 발생 시 트랜잭션 롤백
                await util.promisify(connection.rollback).call(connection); 
                logger.warn(`[SignUp Rollback] 회원가입 중 오류로 롤백 실행됨.`);
            }

            logger.error(`[SignUp Error] 회원가입 처리 중 오류 발생: ${error.message}`, error);
            
            // ID 중복 오류 분리 처리 (MySQL ER_DUP_ENTRY 코드: 1062)
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                 res.status(409).json({ message: '이미 사용 중인 ID입니다.' });
                 return;
            }
            
            // 기타 서버/DB 오류
            res.status(500).json({ message: '회원가입 처리 중 알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
            
        } finally {
            // 연결 해제 (Pool로 반환)
            if (connection) {
                connection.release();
            }
        }
    }
};