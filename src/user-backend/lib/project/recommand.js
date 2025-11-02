// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// 데이터베이스 연결 모듈 로드 (db.js에서 완성된 연결 풀 객체를 가져옴)
const db = require('../util/db');
// 프로젝트 전역 로거 (Winston) 로드
const logger = require('../util/logger');
// 입력 객체 Sanitization 유틸리티 로드 (XSS 방지 및 기본 입력 Sanitization)
const sanitize = require('../util/sanitize');
// Node.js의 util 모듈 로드 (Promisify 사용을 위해)
const util = require('util');

// fast api 요청 url 주소
const fastapiUrl = 'http://127.0.0.1:3004/recommend';
const POST = 'POST'; 

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
     * @description 가중치와 사용자 목록을 fast api 서버에 전달 후, 상위 매칭 스코어 4명의 정보를 반환합니다.
     * @param {object} req Express Request 객체
     * @param {object} res Express Response 객체
     */

    recommand: async (req, res) => {
        const userIdFromToken = req.user.userId;
        const projectId = sanitize(req.params.projectId); 

        logger.info(`[Project Recommand] 프로젝트 ID: ${projectId} 사용자 추천 시작 (사용자 ID: ${userIdFromToken})`);

        // [1] SQL 쿼리 정의
        // [1-1] 사용자 정보 & 이력서 정보 쿼리
        const sqlUsers =
        `SELECT
            u.userId,
            u.job,
            r.address,
            r.mbti,
            r.workStyle,
            r.workTime,
            r.interest,
            r.projectExp,
            r.coverLetter,
            t.techStack 
        FROM
            users u
        INNER JOIN
            resumes r ON u.userId = r.userId
        LEFT JOIN
            techStacks t ON u.userId = t.userId
        ORDER BY
            u.userId;`;

        // [1-2] 프로젝트 정보 조회 쿼리 추가
        const sqlProject = `SELECT * FROM projects WHERE projectId = ?`;

        // [1-3] 추천 정보 저장 쿼리
        const sqlRecommand = `INSERT INTO recommand (projectId, member, score) VALUES (?, ?, ?)`;

        // 최종적으로 반환할 상위 4명의 사용자 정보를 담을 배열
        let top4Users = [];

        try {
            // [2] 데이터 조회
            
            // [2-1] 사용자 정보 & 이력서 정보 조회
            const resultUsers = await queryPromise(sqlUsers);

            // [2-2] 프로젝트 정보 조회
            const resultProject = await queryPromise(sqlProject, [projectId]);

            // 프로젝트 정보가 없으면 에러 처리
            if (resultProject.length === 0) {
                logger.error(`[Project Recommand] 프로젝트 정보 없음: ID ${projectId}`);
                return res.status(404).json({ message: `프로젝트 ID ${projectId}를 찾을 수 없습니다.` });
            }
            const projectData = resultProject[0];

            // [3] fast api 서버로 요청할 데이터 구성
            const requestData = {
                "users": resultUsers,
                "project": projectData
            };

            // [4] fast api 서버로 요청
            const response = await fetch(fastapiUrl, {
                method: POST,
                headers: { 'Content-Type':'application/json'},
                body: JSON.stringify(requestData),
            });

            // 요청 실패 시 에러 처리
            if (!response.ok) {
                logger.error(`[Project Recommand] FastAPI 요청 실패: HTTP 상태 ${response.status}`);
                return res.status(500).json({ message: `FastAPI 요청 실패: HTTP 상태 ${response.status}` });
            }

            // [5] 요청 성공 시 응답 데이터 처리 및 DB 저장
            const responseJson = await response.json();
            const rawResults = responseJson.result; 

            // [5-1] rawResults 객체를 배열로 변환
            const recommendedUsers = Object.values(rawResults); 

            // [5-2] DB 저장 및 최종 반환 목록 생성
            for (let i = 0; i < recommendedUsers.length; i++){
                const item = recommendedUsers[i];
                
                // 1. DB에 저장할 값 및 최종 응답에 포함할 값 정의 및 정제
                const memberId = sanitize(item.id);
                const score = parseFloat(item.norm).toFixed(2); 
                const probability = parseFloat(item.pob).toFixed(4); 

                // 2. DB 저장 쿼리 실행
                await queryPromise(sqlRecommand, [
                    projectId, 
                    memberId,  
                    score      
                ]);
                
                logger.debug(`[Project Recommand] DB 저장 완료: 프로젝트 ${projectId}, 사용자 ${memberId}, 점수 ${score}`);

                // 3. 최종 반환할 top4Users 배열에 데이터 추가
                const userDetail = resultUsers.find(user => user.userId == memberId);

                if (userDetail) {
                    top4Users.push({
                        ...userDetail,
                        score: score,
                        probability: probability
                    });
                }
            }
            
            // [6] 성공 응답 반환
            logger.info(`[Project Recommand] 추천 과정 완료. ${top4Users.length}명 사용자 정보 반환.`);
            return res.status(200).json({
                message: '사용자 추천이 성공적으로 완료되었습니다.',
                top4Users: top4Users
            });

        } catch (error) {
            logger.error(`[Project Recommand] 처리 중 치명적인 오류 발생: ${error.message}`, error);
            return res.status(500).json({
                message: '사용자 추천 과정 중 서버 오류가 발생했습니다.',
                error: error.message
            });
        }
    }
}