// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// HTTP 요청 본문 파싱 미들웨어 로드 (사용자 입력을 req.body로 가져오기 위함)
const bodyParser = require('body-parser');
// 데이터베이스 연결 모듈 로드 (db.js에서 완성된 연결 객체를 가져옴)
const db = require('./util/db');
// 프로젝트 전역 로거 (Winston) 로드
const logger = require('./util/logger');

// 🔑 헬퍼 함수: db.query를 Promise 기반 함수로 변환
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
    * (사용자 프로젝트 목록, 최신 프로젝트 2개, 인기 프로젝트 2개 포함)
    * @param {object} req Express Request 객체 (req.user에 사용자 ID가 있음)
    * @param {object} res Express Response 객체
    */
    mainPage: async (req, res) => {
        const userIdFromToken = req.user.userId; 

        logger.info(`[MainPage Access] 사용자 ID: ${userIdFromToken}의 메인페이지 조회 시작`);

        // SQL 쿼리 정의
        const sqlUser = `SELECT nickname, point FROM users WHERE userId = ?`;
        const sql1 = `SELECT projectId FROM members WHERE member = ? AND role = '팀장'`;
        
        // 팀장 프로젝트 상세 쿼리
        const sql2 = `
            SELECT 
                p.*, 
                COUNT(l.likeId) AS likeCount
            FROM projects p
            LEFT JOIN \`like\` l ON p.projectId = l.projectId
            WHERE p.projectId = ?
            GROUP BY p.projectId
        `;
        
        // 전체 최신 프로젝트 쿼리
        const sqlRecent = `
            SELECT 
                p.*, 
                COUNT(l.likeId) AS likeCount
            FROM projects p
            LEFT JOIN \`like\` l ON p.projectId = l.projectId
            GROUP BY p.projectId
            ORDER BY p.date DESC 
            LIMIT 2
        `;

        // 수정된 인기 프로젝트 쿼리: 최근 1주일 좋아요가 있는 프로젝트 중 상위 2개
        const sqlPopular = `
            SELECT 
                p.*, 
                COUNT(l.likeId) AS popularCount 
            FROM projects p
            INNER JOIN \`like\` l ON p.projectId = l.projectId /* 좋아요가 있는 프로젝트만 대상 */
            WHERE l.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) 
            GROUP BY p.projectId
            ORDER BY popularCount DESC 
            LIMIT 2
        `;
        
        // 변수 정의
        let myProjects = []; 
        let userData = {};
        let recentProjects = [];
        let popularProjects = [];
        
        try {
            // [1] 병렬 처리할 Promise 정의
            const userPromise = queryPromise(sqlUser, [userIdFromToken]);
            const recentPromise = queryPromise(sqlRecent, null); 
            const projectsIdPromise = queryPromise(sql1, [userIdFromToken]);
            const popularPromise = queryPromise(sqlPopular, null); 

            // [2] 모든 쿼리를 병렬로 실행
            const [userResult, recentResult, result1, popularResult] = await Promise.all([
                userPromise,
                recentPromise,
                projectsIdPromise,
                popularPromise
            ]);

            // 사용자 기본 정보 처리 및 할당
            if (userResult.length === 0) {
                logger.warn(`[User Not Found] 유효 토큰 사용자(${userIdFromToken})의 DB 정보 없음`);
                return res.status(404).json({ message: 'User data not found' });
            }
            userData = userResult[0];
            
            // 최신 프로젝트 정보 처리
            recentProjects = recentResult;

            // 인기 프로젝트 정보 처리
            popularProjects = popularResult;

            // 팀장 프로젝트 목록 상세 조회 처리
            if (result1.length > 0) {
                const projectDetailPromises = result1.map(projectRow => {
                    // sql2를 사용하여 좋아요 개수가 포함된 상세 정보를 조회
                    return queryPromise(sql2, [projectRow.projectId]); 
                });

                const projectDetailsResults = await Promise.all(projectDetailPromises);
                
                projectDetailsResults.forEach(detailRow => {
                    if (detailRow.length > 0) {
                        myProjects.push(detailRow[0]);
                    }
                });
            }

            logger.info(`[MainPage Success] ${userIdFromToken}의 데이터 로드 완료. 팀장 프로젝트: ${myProjects.length}개, 최신 프로젝트: ${recentProjects.length}개, 인기 프로젝트: ${popularProjects.length}개.`);

            // [3] 최종 응답 전송
            res.status(200).json({
                message: 'Main page data retrieved successfully',
                userData: {
                    userId: userIdFromToken,
                    nickname: userData.nickname,
                    point: userData.point
                },
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