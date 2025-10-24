// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// HTTP 요청 본문 파싱 미들웨어 로드 (필요 없지만 일관성을 위해 유지)
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
     * @description 프로필 수정 후 해당 프로필 정보 반환
     */
    editProfile: async (req, res) => {
        let connection; 

        try {
            const userIdFromToken = req.user.userId;

            logger.info(`[Profile Edit] 사용자 ID: ${userIdFromToken}의 프로필 수정 시작`);

            // [1] 사용자 입력 추출 및 Sanitization
            // Note: DB 테이블 이름이 'users'가 아닌 'user'라면 쿼리를 수정해야 합니다. 현재는 'users'로 가정합니다.
            const sanitizedPost = sanitize.sanitizeObject(req.body);

            // [2] SQL 쿼리 정의
            const sqlEditProfile = `UPDATE users SET name = ?, birth = ?, phoneNumber = ?, address = ?, job = ?, mbti = ? WHERE userId = ?`;
            const sqlProfile = `SELECT * FROM users WHERE userId = ?`;

            const profileValues = [
                sanitizedPost.name,
                sanitizedPost.birth,
                sanitizedPost.phoneNumber,
                sanitizedPost.address,
                sanitizedPost.job,
                sanitizedPost.mbti,
                userIdFromToken
            ];
            const userValue = [userIdFromToken];

            // [3] DB 트랜잭션 시작
            connection = await util.promisify(db.getConnection).call(db); 
            await util.promisify(connection.beginTransaction).call(connection);

            // [4] 프로필 정보 수정 (users 테이블)
            const result1 = await connectionQueryPromise(connection, sqlEditProfile, profileValues);

            // UPDATE가 실제로 이루어졌는지 확인 (affectedRows가 0이면 해당 유저가 DB에 없다는 의미)
            if (result1.affectedRows === 0) {
                 throw new Error('NOT_FOUND: 수정할 사용자 프로필을 찾을 수 없습니다.');
            }
            
            // 모든 작업 성공 시 트랜잭션 커밋
            await util.promisify(connection.commit).call(connection);

            // [4-3] 수정된 프로필 정보 조회
            const result2 = await connectionQueryPromise(connection, sqlProfile, userValue);
            const patchedProfile = result2.length > 0 ? result2[0] : null;

            // [5] 최종 응답 전송
            logger.info(`[Profile Success] 유저 ID: ${userIdFromToken} 수정 완료`);
            res.status(200).json({
                message: 'Profile updated successfully',
                profile: patchedProfile
            });

        } catch (error) {
            // [6] 오류 처리 및 롤백
            if (connection) {
                // 오류 발생 시 트랜잭션 롤백
                await util.promisify(connection.rollback).call(connection, () => {}); 
                logger.warn(`[Profile Rollback] 프로필 수정 중 오류로 롤백 실행됨.`);
            }

            logger.error(`[Edit Error] 프로필 수정 처리 중 오류 발생: ${error.message}`, error);
            
            // 클라이언트에게 오류 메시지 반환
            let statusCode = 500;
            let displayMessage = '프로필 수정 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

            // 오류 메시지 기반으로 상태 코드 및 메시지 결정
            if (error.message.includes('NOT_FOUND')) {
                statusCode = 404;
                displayMessage = error.message.replace('NOT_FOUND: ', '');
            } else if (error.message.includes('AUTH_FAILED')) {
                statusCode = 403;
                displayMessage = '프로필을 수정할 권한이 없습니다. 본인만 수정할 수 있습니다.';
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