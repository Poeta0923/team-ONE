// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// HTTP 요청 본문 파싱 미들웨어 로드 (필요 없지만 일관성을 위해 유지)
const bodyParser = require('body-parser');
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
     * @description 프로젝트 및 관련 테이블에서 상세 정보를 조회하고 사용자 역할 정보를 반환합니다.
     * @param {object} req Express Request 객체
     * @param {object} res Express Response 객체
     */
    detail: async (req, res) => {
        const userIdFromToken = req.user.userId;
        const projectId = req.params.projectId;

        logger.info(`[Project Detail] 프로젝트 ID: ${projectId} 상세 조회 시작 (사용자 ID: ${userIdFromToken})`);

        // [1] SQL 쿼리 정의
        // 프로젝트 정보 및 참여자 수, 좋아요 수 쿼리
        const sqlProject =
        `SELECT
            p.projectId,
            p.name,
            p.type,
            p.contestId,
            p.category,
            p.require,
            p.recruitment,
            p.explain,
            p.statement,
            p.date,
            p.status, -- 프로젝트 상태 필드 추가
            COALESCE(m_count.member_count, 0) AS member_count,
            COALESCE(l_count.like_count, 0) AS like_count
        FROM
            projects p
        LEFT JOIN (
            SELECT
                projectId,
                COUNT(member) AS member_count
            FROM
                members
            WHERE
                state = '참여' -- 현재 '참여' 중인 멤버만 카운트
            GROUP BY
                projectId
        ) m_count ON p.projectId = m_count.projectId
        LEFT JOIN (
            SELECT
                projectId,
                COUNT(likeId) AS like_count
            FROM
                \`like\` -- LIKE는 SQL 예약어일 가능성이 높아 백틱(\`) 사용
            GROUP BY
                projectId
        ) l_count ON p.projectId = l_count.projectId
        WHERE
            p.projectId = ?;`;

        // 사용자의 프로젝트 역할(팀장/팀원/미참여) 확인 쿼리
        const sqlCheckRole = `SELECT role FROM members WHERE projectId = ? AND member = ?`;

        const projectValue = [projectId];
        const checkRoleValues = [projectId, userIdFromToken];

        
        try {
            // [2] 프로젝트 정보 조회
            const resultProject = await queryPromise(sqlProject, projectValue);

            // 404 Not Found 처리
            if (resultProject.length === 0) {
                logger.warn(`[Project Detail] 프로젝트 ID: ${projectId}를 찾을 수 없음.`);
                return res.status(404).json({ message: '해당 프로젝트를 찾을 수 없습니다.' });
            }

            const projectDetail = resultProject[0];

            // [3] 사용자 역할 정보 조회
            const resultRole = await queryPromise(sqlCheckRole, checkRoleValues);

            // 사용자 역할 정보 추출 ('팀장' 또는 '팀원', 미참여 시 null)
            const userRole = resultRole.length > 0 ? resultRole[0].role : null;

            // [4] 프로젝트 정보 전송
            logger.info('[Project Detail] 프로젝트 상세 정보 조회 성공');
            res.status(200).json({
                message: 'Project data retrieved successfully',
                project: projectDetail,
                role: userRole
            });

        } catch (error) {
            // DB 오류 처리
            logger.error(`[DB Error] 프로젝트 상세 정보 조회 중 오류 발생: ${error.message}`, error);
            res.status(500).json({ message: '프로젝트 상세 정보를 조회하는 중 서버 오류가 발생했습니다.' });
        }
    }
}