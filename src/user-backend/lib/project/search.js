// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// 데이터베이스 연결 모듈 로드 (db.js에서 완성된 연결 객체를 가져옴)
const db = require('../util/db');
// 프로젝트 전역 로거 (Winston) 로드
const logger = require('../util/logger');
// HTML 파싱 & 필터링 라이브러리 로드 (XSS 방지 및 기본 입력 Sanitization)
var sanitizeHtml = require('sanitize-html');

// 헬퍼 함수: db.query를 Promise 기반 함수로 변환
const queryPromise = (sql, params) => {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (error, results) => {
            if (error) {
                return reject(error);
            }
            resolve(results);
        });
    });
};

// =================================================================
// 2. Feature Implement (모듈 내보내기)
// =================================================================

// 전체 최신 프로젝트 쿼리
const sqlAllRecent = `
    SELECT 
        p.*, 
        COUNT(DISTINCT l.likeId) AS likeCount,
        COUNT(DISTINCT m.member) AS memberCount, 
        EXISTS (
           SELECT 1 
            FROM \`like\`
           WHERE projectId = p.projectId AND userId = ?
        ) AS isLiked 
    FROM projects p
    LEFT JOIN \`like\` l ON p.projectId = l.projectId
    LEFT JOIN members m ON p.projectId = m.projectId AND m.state = '참여'
    WHERE 
        p.type = ?
        AND p.category LIKE CONCAT('%', ?, '%')
        AND (
            p.name LIKE CONCAT('%', ?, '%') OR
            p.type LIKE CONCAT('%', ?, '%') OR
            p.category LIKE CONCAT('%', ?, '%') OR
            p.tech_stack LIKE CONCAT('%', ?, '%') OR
            p.description LIKE CONCAT('%', ?, '%')
        )
    GROUP BY p.projectId
    HAVING memberCount < p.recruitment  
    ORDER BY p.date DESC;
`;

// 인기 프로젝트 쿼리
const sqlAllPopular = `
    SELECT 
        p.*, 
        COUNT(DISTINCT l.likeId) AS likeCount,
        COUNT(DISTINCT m.member) AS memberCount, 
        EXISTS (
            SELECT 1 
            FROM \`like\` 
            WHERE projectId = p.projectId AND userId = ? 
        ) AS isLiked 
    FROM projects p
    LEFT JOIN \`like\` l ON p.projectId = l.projectId
    LEFT JOIN members m ON p.projectId = m.projectId AND m.state = '참여'
    WHERE 
        p.type = ?
        AND p.category LIKE CONCAT('%', ?, '%')
        AND (
            p.name LIKE CONCAT('%', ?, '%') OR
            p.type LIKE CONCAT('%', ?, '%') OR
            p.category LIKE CONCAT('%', ?, '%') OR
            p.tech_stack LIKE CONCAT('%', ?, '%') OR
            p.description LIKE CONCAT('%', ?, '%')
        )
    GROUP BY p.projectId
    HAVING memberCount < p.recruitment 
    ORDER BY likeCount DESC;
`;


// 좋아요 누른 프로젝트 쿼리
const sqlUserLikes = `
    SELECT 
        p.*, 
        COUNT(DISTINCT l.likeId) AS likeCount,
        COUNT(DISTINCT m.member) AS memberCount, 
        -- 사용자가 좋아요를 눌렀는지 확인 (이 쿼리에서는 항상 TRUE)
        TRUE AS isLiked 
    FROM projects p
    -- 좋아요 테이블을 INNER JOIN하여 현재 사용자가 좋아요를 누른 프로젝트만 필터링
    INNER JOIN \`like\` l ON p.projectId = l.projectId AND l.userId = ?
    LEFT JOIN members m ON p.projectId = m.projectId AND m.state = '참여'
    WHERE 
        p.type = ?
        AND p.category LIKE CONCAT('%', ?, '%')
        AND (
            p.name LIKE CONCAT('%', ?, '%') OR
            p.type LIKE CONCAT('%', ?, '%') OR
            p.category LIKE CONCAT('%', ?, '%') OR
            p.tech_stack LIKE CONCAT('%', ?, '%') OR
            p.description LIKE CONCAT('%', ?, '%')
        )
    GROUP BY p.projectId
    HAVING memberCount < p.recruitment 
    ORDER BY l.date DESC;
`;

module.exports = {
    /**
    * @description 인증된 사용자의 JWT Payload를 사용하여 메인 페이지 정보를 조회하고 반환
    * @param {object} req Express Request 객체 (req.user에 사용자 ID가 있음)
    * @param {object} res Express Response 객체
    */
    search: async (req, res) => {
        const userIdFromToken = req.user.userId; 
        const post = req.body;
        const searchClass = post.class; // '신규', '인기', '좋아요'
        
        // 입력 Sanitization (데이터베이스에 들어갈 데이터는 아니지만, 안전성 확보)
        const sanitizedType = sanitizeHtml(post.type || '');
        const sanitizedCategory = sanitizeHtml(post.category || '');
        // 검색어가 null이거나 undefined면 빈 문자열로 처리하여 '%%' 검색이 되도록 함
        const sanitizedSearchTerm = sanitizeHtml(post.searchTerm || ''); 

        logger.info(`[Project Search Access] 사용자 ID: ${userIdFromToken}의 프로젝트 탐색 페이지 조회 시작 (Class: ${searchClass}, Type: ${sanitizedType})`);

        // 변수 정의
        let sqlQuery = '';
        let projects = [];

        // 1. 클래스에 따라 SQL 쿼리 선택
        switch (searchClass) {
            case '신규':
                sqlQuery = sqlAllRecent;
                break;
            case '인기':
                sqlQuery = sqlAllPopular;
                break;
            case '좋아요':
                sqlQuery = sqlUserLikes;
                break;
            default:
                // 유효하지 않은 class 값일 경우 기본값 또는 오류 처리
                logger.warn(`[Project Search] 유효하지 않은 searchClass 값: ${searchClass}. 기본값(신규)으로 설정.`);
                sqlQuery = sqlAllRecent;
                break;
        }

        // 2. SQL 파라미터 구성
        // 통합 검색어 (? 5개)를 위해 동일한 검색어를 5번 반복하여 배열에 추가
        const searchTermArray = [
            sanitizedSearchTerm, // 4: p.name
            sanitizedSearchTerm, // 5: p.type
            sanitizedSearchTerm, // 6: p.category
            sanitizedSearchTerm, // 7: p.tech_stack
            sanitizedSearchTerm  // 8: p.description
        ];

        // 쿼리별로 첫 번째 파라미터(userIdFromToken)의 사용 여부가 다름
        // sqlUserLikes는 l.userId에 사용되고, 나머지는 EXISTS 서브쿼리에 사용됨
        let queryParams = [
            userIdFromToken,    // 1: userIdFromToken (l.userId 또는 EXISTS)
            sanitizedType,      // 2: p.type
            sanitizedCategory,  // 3: p.category (CONCAT 내부)
            ...searchTermArray  // 4~8: 통합 검색어 (5개)
        ];

        try{
            // 3. 쿼리 실행
            projects = await queryPromise(sqlQuery, queryParams);

            // 4. 결과 반환
            return res.status(200).json({
                success: true,
                message: `${searchClass} 프로젝트 목록 조회 성공`,
                projects: projects,
            });
            
        } catch (error) {
            logger.error(`[Project Search Error] 사용자 ID: ${userIdFromToken} 프로젝트 탐색 중 DB 오류 발생:`, error);
            return res.status(500).json({
                success: false,
                message: `프로젝트 목록 조회 중 서버 오류가 발생했습니다.`,
                error: error.message,
            });
        }
    }
}