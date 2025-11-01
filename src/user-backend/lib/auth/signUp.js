// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// HTTP 요청 본문 파싱 미들웨어 로드 (사용자 입력을 req.body로 가져오기 위함)
const bodyParser = require('body-parser');
// 데이터베이스 연결 모듈 로드 (db.js에서 완성된 연결 객체를 가져옴)
const db = require('../util/db'); 
// 프로젝트 전역 로거 (Winston) 로드
const logger = require('../util/logger');
// 단방향 해시 알고리즘 로드 (비밀번호 비교에 사용)
const bycrypt = require('bcrypt');
// jsonwebtoken 라이브러리 로드 (인증 토큰 생성 및 관리에 사용)
const jwt = require('jsonwebtoken');
// 입력 객체 Sanitization 유틸리티 로드 (XSS 방지 및 기본 입력 Sanitization)
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
        let connection; 

        try {
            // [1] 사용자 입력 추출 및 Sanitization
            const sanitizedPost = sanitize.sanitizeObject(req.body); 
            logger.debug(`[SignUp] 회원가입 시도: ${sanitizedPost.id}`);

            // [2] 비밀번호 해싱
            const hashedPassword = await bycrypt.hash(sanitizedPost.password, 10);
            
            // [2-1] techStack 문자열 가공 (AI 입력 전용)
            // 모든 공백과 특수문자를 제거하고 전부 소문자로 변환
            const aiTechStack = sanitizedPost.tech_stack
                .replace(/[^a-zA-Z0-9]/g, '') // 알파벳과 숫자 외 모든 문자(특수문자 및 공백) 제거
                .toLowerCase();

            // [3] DB 트랜잭션 시작
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
            const projectExpValue = (sanitizedPost.projectExp === 'true' || sanitizedPost.projectExp === true || sanitizedPost.projectExp === 1) ? 1 : 0;
            
            const resumeValues = [
                newUserId, 
                sanitizedPost.address, 
                sanitizedPost.mbti, 
                sanitizedPost.workStyle, 
                sanitizedPost.workTime, 
                sanitizedPost.tech_stack, // 원본 기술 스택 사용
                sanitizedPost.interest, 
                sanitizedPost.gitHub, 
                sanitizedPost.blog, 
                projectExpValue,
                sanitizedPost.coverLetter
            ];
            
            await connectionQueryPromise(connection, sql3, resumeValues);

            // [4-3] AI 전용 기술 스택 저장 (techStacks 테이블)
            const sql4 = `
                INSERT INTO techStacks (userId, techStack) 
                VALUES (?, ?)
            `;
            const techStackValues = [
                newUserId, 
                aiTechStack
            ];
            await connectionQueryPromise(connection, sql4, techStackValues);

            // 모든 쿼리가 성공했으므로 트랜잭션 커밋
            await util.promisify(connection.commit).call(connection);

            // [5] 회원가입 성공 및 JWT 토큰 생성
            logger.info(`[SignUp Success] 사용자 ID: ${newUserId} 회원가입 및 커밋 완료`);
                            
            const tokenPayload = {
                userId: newUserId,
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
            
            // ID 중복 오류 분리 처리
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