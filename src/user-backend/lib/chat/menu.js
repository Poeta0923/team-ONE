// =================================================================
// 1. Core Modules & Configuration
// =================================================================

const db = require('../util/db'); 
const logger = require('../util/logger');
const util = require('util');

// DB 쿼리용 헬퍼 함수 (기존 프로젝트 형식 유지)
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
// 2. DB Query Definition
// =================================================================

// 사용자가 참여하고 있는 모든 채팅방 목록을 조회하는 쿼리
// 개인 채팅(projectId IS NULL)일 경우 상대방 닉네임을,
// 프로젝트 채팅(projectId IS NOT NULL)일 경우 프로젝트 이름을 반환합니다.
const sqlProjects = `
    SELECT
        P.projectId,
        P.name
    FROM
        members M
    JOIN
        projects P ON M.projectId = P.projectId
    WHERE
        M.member = ?
        AND M.role = '팀장';
`;

const sqlMembers = `
    SELECT
        U.userId,
        U.nickName
    FROM
        participant P
    JOIN
        users U ON P.userId = U.userId
    WHERE
        P.roomId = ?;
`;

// =================================================================
// 3. Feature Implement (모듈 내보내기)
// =================================================================

module.exports = {
    /**
     * @description 현재 사용자가 참여하고 있는 채팅방 메뉴의 필요 정보를 반환합니다.
     */
    menu: async (req, res) => {
        let connection; 

        // [1=1] 사용자 ID 추출 (인증 미들웨어가 보장)
        const userId = req.user.userId; // ⭐ userId 사용
        
        // [1-2] 현재 채팅방 roomId 추출
        const roomId = req.params.roomId;

        // [1-3] 입력 유효성 검사 (roomId가 반드시 필요함)
        if (!roomId) {
            logger.warn(`[Chat Menu] 400 Bad Request: roomId가 누락되었습니다. User: ${userId}`);
            return res.status(400).json({ message: '채팅방 ID(roomId)가 필요합니다.' });
        }


        logger.info(`[Chat Menu] 사용자 ID: ${userId}의 메뉴 사용 시작 (Room: ${roomId})`);
        
        try {
            // [2] DB 연결 획득
            connection = await util.promisify(db.getConnection).call(db);

            // [3] 두 개의 쿼리 실행 (팀장인 프로젝트 목록, 현재 방의 참여자 목록)
            const resultProjects = await connectionQueryPromise(connection, sqlProjects, [userId]);
            const resultMembers = await connectionQueryPromise(connection, sqlMembers, [roomId]); 

            // [4] 최종 응답 전송
            logger.info(`[Chat Menu Success] ${userId}의 채팅 메뉴 정보 반환 완료 (Projects: ${resultProjects.length}개, Members: ${resultMembers.length}명)`);
            res.status(200).json({
                message: 'Chat menu information retrieved successfully', // 메시지 변경
                projects: resultProjects,
                members: resultMembers
            });

        } catch (error) {
            // [5] 오류 처리 (로그 태그 수정)
            logger.error(`[Chat Menu Error] 메뉴 정보 조회 중 오류 발생: ${error.message}`, error); // ⭐ 로그 태그 및 메시지 수정
            
            res.status(500).json({ 
                message: '채팅 메뉴 정보 조회 처리 중 서버 오류가 발생했습니다.' // 메시지 수정
            });
            
        } finally {
            // 연결 해제 (Pool로 반환)
            if (connection) {
                connection.release();
            }
        }
    }
};