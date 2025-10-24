// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// HTTP 요청 본문 파싱 미들웨어 로드 (사용자 입력을 req.body로 가져오기 위함)
const bodyParser = require('body-parser');
// 데이터베이스 연결 모듈 로드 (db.js에서 완성된 연결 객체를 가져옴)
const db = require('./util/db');
// 프로젝트 전역 로거 (Winston) 로드
const logger = require('./util/logger');
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
    * @description 인증된 사용자의 JWT Payload를 사용하여 메인 페이지 정보를 조회하고 반환
    * (사용자 프로필, 사용자 이력서 표시)
    * @param {object} req Express Request 객체 (req.user에 사용자 ID가 있음)
    * @param {object} res Express Response 객체
    */
   myPage: async (req, res) =>{
        const userIdFromToken = req.user.userId; 

        logger.info(`[MyPage Access] 사용자 ID: ${userIdFromToken}의 마이페이지 조회 시작`);

        // [1] SQL 쿼리 정의
        const sqlProfile = `SELECT * FROM user WHERE userId = ?`; 
        const sqlResume = `SELECT * FROM resumes WHERE userId = ?`;

        const userValue = [userIdFromToken];

        try {
            // [2] 사용자 정보 조회
            const [resultProfile, resultResume] = await Promise.all([
                queryPromise(sqlProfile, userValue),
                queryPromise(sqlResume, userValue)
            ]);

            // [3] 사용자 프로필 존재 여부 확인 (404 처리)
            if (resultProfile.length === 0) {
                logger.warn(`[MyPage] 사용자 ID: ${userIdFromToken}의 프로필을 DB에서 찾을 수 없음 (404)`);
                return res.status(404).json({ 
                    message: '사용자 프로필을 찾을 수 없습니다.' 
                });
            }

            // [4] 사용자 정보 전송
            logger.info('[MyPage] 사용자 상세 정보 조회 성공');
            res.status(200).json({
                message: 'User data retrieved successfully',
                profile: resultProfile[0],
                resume: resultResume[0]
                // resume: resultResume.length > 0 ? resultResume[0] : null 
            });
        } catch (error) {
            // DB 오류 처리
            logger.error(`[DB Error] 사용자 정보 조회 중 오류 발생: ${error.message}`, error);
            res.status(500).json({ message: '사용자 정보를 조회하는 중 서버 오류가 발생했습니다.' });
        }
   }
}