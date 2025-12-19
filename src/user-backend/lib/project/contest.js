// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// 데이터베이스 연결 모듈 로드 (db.js에서 완성된 연결 풀 객체를 가져옴)
const db = require('../util/db');
// 프로젝트 전역 로거 (Winston) 로드
const logger = require('../util/logger');
// Node.js의 util 모듈 로드 (Promisify 사용을 위해)
const util = require('util');

// =================================================================
// 2. Utility Functions
// =================================================================

/**
 * @description MySQL 쿼리를 Promise 기반으로 감싸 async/await 사용을 가능하게 합니다.
 * DB 풀 직접 쿼리에 사용됩니다.
 * @param {string} sql 실행할 SQL 쿼리 문자열
 * @param {Array} values SQL 쿼리에 바인딩할 값들의 배열
 * @returns {Promise<object>} 쿼리 결과를 resolve하는 프로미스
 */
const queryPromise = util.promisify(db.query).bind(db);


// =================================================================
// 3. Feature Implement (모듈 내보내기)
// =================================================================

module.exports = {
    /**
     * @description contests 테이블에서 모든 공모전 이름을 조회하여 반환합니다.
     * @param {object} req Express Request 객체
     * @param {object} res Express Response 객체
     */
    contest: async (req, res) => {
        // SQL 정의
        const sqlContest = `SELECT name FROM contests`;
        
        try {
            const result = await queryPromise(sqlContest);

            // 공모전 이름 정보 전송
            logger.info('[Contest List] 공모전 목록 조회 성공');
            res.status(200).json({
                message: 'Contest data retrieved successfully',
                contest: result
            });

        } catch (error) {
            // DB 오류 처리
            logger.error(`[DB Error] 공모전 정보 조회 중 오류 발생: ${error.message}`, error);
            res.status(500).json({ message: '공모전 정보를 조회하는 중 서버 오류가 발생했습니다.' });
        }
    }
}