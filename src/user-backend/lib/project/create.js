// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// HTTP 요청 본문 파싱 미들웨어 로드
const bodyParser = require('body-parser');
// 데이터베이스 연결 모듈 로드 (db.js에서 완성된 연결 풀 객체를 가져옴)
const db = require('../util/db');
// 프로젝트 전역 로거 (Winston) 로드
const logger = require('../util/logger');
// 입력 객체 Sanitization 유틸리티 로드 (XSS 방지 및 기본 입력 Sanitization)
const sanitize = require('../util/sanitize');
// Node.js의 util 모듈 로드 (Promisify 사용을 위해)
const util = require('util');


// =================================================================
// 2. Utility Functions (트랜잭션 처리를 위해 재정의)
// =================================================================

/**
 * @description 단일 MySQL 연결 객체를 사용하여 쿼리를 Promise 기반으로 실행합니다.
 * 트랜잭션 환경에서 사용됩니다.
 * @param {object} connection 현재 사용 중인 DB 연결 객체 (풀에서 가져온 것)
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
     * @description 프로젝트 생성 후 해당 프로젝트 정보 반환 (트랜잭션 적용)
     */
    create: async (req, res) => {
        let connection; 

        try {
            const userIdFromToken = req.user.userId;

            logger.info(`[Project Create] 사용자 ID: ${userIdFromToken}의 프로젝트 생성 시작`);

            // [1] 사용자 입력 추출 및 Sanitization
            const sanitizedPost = sanitize.sanitizeObject(req.body);

            // [2] SQL 쿼리 정의 (생략)
            const sqlContest = `SELECT contestId FROM contests WHERE name = ?`;
            const sqlNewContest = `INSERT INTO contests (name) VALUES (?)`;
            const sqlProjects = `INSERT INTO projects (name, type, contestId, category, require, recruitment, explain, statement) VALUES (?, ?, ?, ?, ?, ?, ?, "모집중")`;
            const sqlMembers = `INSERT INTO members (projectId, member, role, state) VALUES (?, ?, "팀장", "참여")`;
            const sqlNewProject = `SELECT * FROM projects WHERE projectId = ?`;

            // [3] DB 트랜잭션 시작
            connection = await util.promisify(db.getConnection).call(db); 
            await util.promisify(connection.beginTransaction).call(connection);

            
            // ===================================================
            // [4] DB 작업 실행
            // ===================================================

            // [4-1] 공모전 정보 확인 및 ID 획득
            const contestValue = [sanitizedPost.contestName];
            const newContestValue = [sanitizedPost.newContestName];
            let contestId; // var 대신 let 사용 권장

            if (sanitizedPost.contestName === '그 외') {
                // 새 공모전 생성
                const result1 = await connectionQueryPromise(connection, sqlNewContest, newContestValue);
                contestId = result1.insertId;
            } else {
                // 기존 공모전 조회
                const result1 = await connectionQueryPromise(connection, sqlContest, contestValue);
                
                if (result1 && result1.length > 0) {
                    contestId = result1[0].contestId;
                } else {
                    throw new Error(`선택된 공모전(${sanitizedPost.contestName})이 DB에 존재하지 않아 프로젝트를 생성할 수 없습니다. (데이터 오류)`);
                }
            }

            // [4-2] 프로젝트 정보 저장 (projects 테이블)
            const projectValues = [
                sanitizedPost.name,
                sanitizedPost.type,
                contestId, // 획득한 contestId 사용
                sanitizedPost.category,
                sanitizedPost.require,
                sanitizedPost.recruitment,
                sanitizedPost.explain
            ];
            const result2 = await connectionQueryPromise(connection, sqlProjects, projectValues);
            const newProjectId = result2.insertId;

            // [4-3] 참여 멤버 정보 저장 (members 테이블)
            const memberValues = [
                newProjectId,
                userIdFromToken,
            ];
            await connectionQueryPromise(connection, sqlMembers, memberValues);

            // 모든 작업 성공 시 트랜잭션 커밋
            await util.promisify(connection.commit).call(connection);

            // [4-4] 생성된 프로젝트 정보 조회
            const newProjectValue = [newProjectId];
            const result3 = await connectionQueryPromise(connection, sqlNewProject, newProjectValue);
            const newProject = result3[0];

            // [5] 최종 응답 전송
            logger.info(`[Project Success] 프로젝트 ID: ${newProjectId} 생성 완료`);
            res.status(201).json({
                message: 'Project created successfully',
                project: newProject
            });

        } catch (error) {
            // [6] 오류 처리 및 롤백
            if (connection) {
                // 오류 발생 시 트랜잭션 롤백
                await util.promisify(connection.rollback).call(connection, () => {}); 
                logger.warn(`[Project Rollback] 프로젝트 생성 중 오류로 롤백 실행됨.`);
            }

            logger.error(`[Create Error] 프로젝트 생성 처리 중 오류 발생: ${error.message}`, error);
            
            // 클라이언트에게 오류 메시지 반환 (catch 블록에서 명시적으로 throw한 오류 메시지 사용)
            const displayMessage = error.message.includes('존재하지 않아') ? error.message : '프로젝트 생성 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
            res.status(500).json({ message: displayMessage });
            
        } finally {
            // 연결 해제 (Pool로 반환)
            if (connection) {
                connection.release();
            }
        }
    }
}