// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// 데이터베이스 연결 모듈 로드 (db.js에서 완성된 연결 객체를 가져옴)
const db = require('./util/db');
// 프로젝트 전역 로거 (Winston) 로드
const logger = require('./util/logger');

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

// 팀장 프로젝트 상세 쿼리
const sqlProjectDetail = `
    SELECT 
        p.*, 
        COUNT(DISTINCT l.likeId) AS likeCount,
        COUNT(DISTINCT m.member) AS memberCount, 
        EXISTS (
            SELECT 1 
            FROM \`like\` 
            WHERE projectId = p.projectId AND userId = ? -- 1: userIdFromToken
        ) AS isLiked 
    FROM projects p
    LEFT JOIN \`like\` l ON p.projectId = l.projectId
    LEFT JOIN members m ON p.projectId = m.projectId AND m.state = '참여'
    WHERE p.projectId = ? -- 2: projectId
    GROUP BY p.projectId
`;

// 전체 최신 프로젝트 쿼리
const sqlRecent = `
    SELECT 
        p.*, 
        COUNT(DISTINCT l.likeId) AS likeCount,
        COUNT(DISTINCT m.member) AS memberCount, 
        EXISTS (
            SELECT 1 
            FROM \`like\` 
            WHERE projectId = p.projectId AND userId = ? -- 1: userIdFromToken
        ) AS isLiked 
    FROM projects p
    LEFT JOIN \`like\` l ON p.projectId = l.projectId
    LEFT JOIN members m ON p.projectId = m.projectId AND m.state = '참여'
    GROUP BY p.projectId
    HAVING memberCount < p.recruitment  
    ORDER BY p.date DESC 
    LIMIT 2
`;

// 인기 프로젝트 쿼리
const sqlPopular = `
    SELECT 
        p.*, 
        COUNT(DISTINCT l.likeId) AS likeCount,
        COUNT(DISTINCT m.member) AS memberCount, 
        EXISTS (
            SELECT 1 
            FROM \`like\` 
            WHERE projectId = p.projectId AND userId = ? -- 1: userIdFromToken
        ) AS isLiked 
    FROM projects p
    LEFT JOIN \`like\` l ON p.projectId = l.projectId
    LEFT JOIN members m ON p.projectId = m.projectId AND m.state = '참여'
    WHERE p.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) 
    GROUP BY p.projectId
    HAVING memberCount < p.recruitment 
    ORDER BY likeCount DESC
    LIMIT 2
`;

module.exports = {
    /**
    * @description 인증된 사용자의 JWT Payload를 사용하여 메인 페이지 정보를 조회하고 반환
    * @param {object} req Express Request 객체 (req.user에 사용자 ID가 있음)
    * @param {object} res Express Response 객체
    */
    mainPage: async (req, res) => {
        const userIdFromToken = req.user.userId; 

        logger.info(`[MainPage Access] 사용자 ID: ${userIdFromToken}의 메인페이지 조회 시작 (userData 제외)`);

        // SQL 쿼리 정의
        const sqlFindTeamLeadProjects = `SELECT projectId FROM members WHERE member = ? AND role = '팀장'`;
        
        // 변수 정의
        let myProjects = []; 
        let recentProjects = [];
        let popularProjects = [];
        
        try {
            // [1] 병렬 처리할 Promise 정의
            const recentPromise = queryPromise(sqlRecent, [userIdFromToken]); // 쿼리 인자 수정
            const popularPromise = queryPromise(sqlPopular, [userIdFromToken]); // 쿼리 인자 수정
            const projectsIdPromise = queryPromise(sqlFindTeamLeadProjects, [userIdFromToken]);

            // [2] 모든 쿼리를 병렬로 실행
            const [recentResult, popularResult, result1] = await Promise.all([
                recentPromise,
                popularPromise,
                projectsIdPromise,
            ]);
            
            // 최신/인기 프로젝트 정보 처리
            recentProjects = recentResult;
            popularProjects = popularResult;

            // 팀장 프로젝트 목록 상세 조회 처리 (2단계)
            if (result1.length > 0) {
                const projectDetailPromises = result1.map(projectRow => {
                    const projectId = projectRow.projectId;
                    return queryPromise(sqlProjectDetail, [userIdFromToken, projectId]); 
                });

                const projectDetailsResults = await Promise.all(projectDetailPromises);
                
                projectDetailsResults.forEach(detailRow => {
                    if (detailRow.length > 0) {
                        myProjects.push(detailRow[0]);
                    }
                });
            }

            logger.info(`[MainPage Success] ${userIdFromToken}의 데이터 로드 완료. 팀장 프로젝트: ${myProjects.length}개, 최신 프로젝트(모집중): ${recentProjects.length}개, 인기 프로젝트(모집중, 7일 이내 생성): ${popularProjects.length}개.`);

            // [3] 최종 응답 전송
            res.status(200).json({
                message: 'Main page data retrieved successfully',
                myProjects: myProjects,
                recentProjects: recentProjects,
                popularProjects: popularProjects
            });

        } catch (error) {
            // DB 또는 비동기 작업 중 발생한 오류 처리
            logger.error(`[DB/Promise Error] 메인 페이지 정보 조회 중 오류 발생: ${error.message}`, error);
            res.status(500).json({ message: '메인 페이지 정보를 조회하는 중 서버 오류가 발생했습니다.' });
        }
    }
};