// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// HTTP 요청 본문 파싱 미들웨어 로드
const bodyParser = require('body-parser');
// 데이터베이스 연결 모듈 로드 (db.js에서 완성된 연결 풀 객체를 가져옴)
const db = require('../util/db');
// 프로젝트 전역 로거 (Winston) 로드
const logger = require('../util/logger');
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
     * @description 프로젝트 완료 처리 (팀장 권한 확인 포함)
     */
    complete: async (req, res) => {
        let connection;

        try {
            const userIdFromToken = req.user.userId;
            const projectId = req.params.projectId;

            logger.info(`[Project Complete] 사용자 ID: ${userIdFromToken}의 프로젝트 완료 시작`);

            // [1] SQL 정의
            const sqlCheckOwner = `SELECT member FROM members WHERE projectId = ? AND role = '팀장' AND member = ?`;
            const sqlComplete = `UPDATE projects SET status = '완료' WHERE projectId = ?`;

            const checkOwnerValues = [projectId, userIdFromToken];
            const completeValue = [projectId];

            // [2] DB 트랜잭션 시작
            connection = await util.promisify(db.getConnection).call(db); 
            await util.promisify(connection.beginTransaction).call(connection);

            // ===================================================
            // [3] DB 작업 실행
            // ===================================================

            // [3-1] 프로젝트 소유자(팀장) 권한 확인
            const resultOwner = await connectionQueryPromise(connection, sqlCheckOwner, checkOwnerValues);

            if (resultOwner.length === 0) {
                // 권한이 없으면 즉시 트랜잭션 중단 및 오류 발생
                throw new Error('AUTH_FAILED: 프로젝트를 완료할 권한이 없습니다. (팀장만 가능)');
            }

            // [3-2] 프로젝트 완료 (projects 테이블)
            await connectionQueryPromise(connection, sqlComplete, completeValue);

            // 모든 작업 성공 시 트랜잭션 커밋
            await util.promisify(connection.commit).call(connection);

            // [4] 최종 응답 전송
            logger.info('[Project Complete] 프로젝트 완료 처리 성공');
            res.status(200).json({
                message: 'Contest complete successfully',
            });

        } catch (error) {
            // [5] 오류 처리 및 롤백
            if (connection) {
                await util.promisify(connection.rollback).call(connection, () => {}); 
                logger.warn(`[Project Rollback] 프로젝트 완료 중 오류로 롤백 실행됨.`);
            }

            logger.error(`[Patch Error] 프로젝트 완료 처리 중 오류 발생: ${error.message}`, error);
            
            // 클라이언트에게 오류 메시지 반환 (권한 오류 처리)
            let statusCode = 500;
            let displayMessage = '프로젝트 완료 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

            if (error.message.includes('AUTH_FAILED')) {
                statusCode = 403;
                displayMessage = '프로젝트를 완료할 권한이 없습니다. 팀장만 완료할 수 있습니다.';
            } 
            
            res.status(statusCode).json({ message: displayMessage });
            
        } finally {
            // 연결 해제 (Pool로 반환)
            if (connection) {
                connection.release();
            }
        }
    }
}