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
     * @description 사용자의 이력서 상세 정보를 조회합니다.
     * @param {object} req Express Request 객체
     * @param {object} res Express Response 객체
     */
    resume: async (req, res) => {
        const userIdFromToken = req.user.userId;
        const userId = req.params.userId;

        logger.info(`[Resume Detail] 사용자 ID: ${userId}의 이력서 상세 조회 시작 (요청 사용자 ID: ${userIdFromToken})`);

        // [1] SQL 쿼리 정의
        const sqlResume = `SELECT
            U.userId,
            U.nickName,
            U.job,
            R.address,
            R.mbti,
            R.workStyle,
            R.workTime,
            R.techStack,
            R.interest,
            R.gitHub,
            R.blog,
            R.projectExp,
            R.coverLetter
        FROM
            users U
        INNER JOIN
            resumes R ON U.userId = R.userId
        WHERE
            U.userId = ?`;

        const resumeValue = [userId];

        
        try {
            // [2] 이력서 정보 조회
            const resultResume = await queryPromise(sqlResume, resumeValue);

            // 404 Not Found 처리
            if (resultResume.length === 0) {
                logger.warn(`[Resume Detail] 사용자 ID: ${userId}의 이력서를 찾을 수 없음.`);
                return res.status(404).json({ message: '해당 이력서를 찾을 수 없습니다.' });
            }

            const resumeDetail = resultResume[0];

            // [3] 이력서 정보 전송
            logger.info('[Resume Detail] 이력서 상세 정보 조회 성공');
            res.status(200).json({
                message: 'Resume data retrieved successfully',
                resume: resumeDetail,
            });

        } catch (error) {
            // DB 오류 처리
            logger.error(`[DB Error] 이력서 상세 정보 조회 중 오류 발생: ${error.message}`, error);
            res.status(500).json({ message: '이력서 상세 정보를 조회하는 중 서버 오류가 발생했습니다.' });
        }
    }
}