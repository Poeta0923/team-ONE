// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// HTTP 요청 본문 파싱 미들웨어 로드 (사용자 입력을 req.body로 가져오기 위함)
const bodyParser = require('body-parser');
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

module.exports = {
    /**
    * @description 인증된 사용자의 JWT Payload를 사용하여 메인 페이지 정보를 조회하고 반환
    * (사용자 프로젝트 목록, 최신 프로젝트 2개, 인기 프로젝트 2개 포함, isLiked, memberCount 상태 표시)
    * @param {object} req Express Request 객체 (req.user에 사용자 ID가 있음)
    * @param {object} res Express Response 객체
    */
    mainPage: async (req, res) => {
        const userIdFromToken = req.user.userId; 

        logger.info(`[MainPage Access] 사용자 ID: ${userIdFromToken}의 메인페이지 조회 시작 (userData 제외)`);

        // SQL 쿼리 정의
        const sql1 = `SELECT projectId FROM members WHERE member = ? AND role = '팀장'`;
        
        // 팀장 프로젝트 상세 쿼리
        const sql2 = (userId) => `
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
            LEFT JOIN members m ON p.projectId = m.projectId 
            WHERE p.projectId = ?
            GROUP BY p.projectId
        `;
        
        // 전체 최신 프로젝트 쿼리
        const sqlRecent = (userId) => `
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
            LEFT JOIN members m ON p.projectId = m.projectId 
            GROUP BY p.projectId
            HAVING memberCount < p.recruitment  
            ORDER BY p.date DESC 
            LIMIT 2
        `;

        // 인기 프로젝트 쿼리
        const sqlPopular = (userId) => `
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
            LEFT JOIN members m ON p.projectId = m.projectId 
            WHERE p.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) 
            GROUP BY p.projectId
            HAVING memberCount < p.recruitment 
            ORDER BY likeCount DESC
            LIMIT 2
        `;
        
        // 변수 정의
        let myProjects = []; 
        let recentProjects = [];
        let popularProjects = [];
        
        try {
            // [1] 병렬 처리할 Promise 정의
            const recentPromise = queryPromise(sqlRecent(userIdFromToken), [userIdFromToken]); 
            const popularPromise = queryPromise(sqlPopular(userIdFromToken), [userIdFromToken]); 
            const projectsIdPromise = queryPromise(sql1, [userIdFromToken]);

            // [2] 모든 쿼리를 병렬로 실행
            const [recentResult, popularResult, result1] = await Promise.all([
                recentPromise,
                popularPromise,
                projectsIdPromise,
            ]);
            
            // 최신 프로젝트 정보 처리
            recentProjects = recentResult;

            // 인기 프로젝트 정보 처리
            popularProjects = popularResult;

            // 팀장 프로젝트 목록 상세 조회 처리 (2단계)
            if (result1.length > 0) {
                const projectDetailPromises = result1.map(projectRow => {
                    const projectId = projectRow.projectId;
                    // sql2(userIdFromToken) 호출 후, 쿼리 내부의 '?' 두 개에 각각 userIdFromToken, projectId 바인딩
                    return queryPromise(sql2(userIdFromToken), [userIdFromToken, projectId]); 
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
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
};