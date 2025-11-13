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
const sqlChatList = `
    SELECT 
        R.roomId,
        R.projectId,
        R.date AS roomCreatedAt,
        R.lastMessage,
        
        CASE 
            WHEN R.projectId IS NULL THEN 
                (SELECT U.nickName
                 FROM participant P_OTHER 
                 JOIN users U ON P_OTHER.userId = U.userId
                 WHERE P_OTHER.roomId = R.roomId 
                 AND P_OTHER.userId != ?
                 LIMIT 1)
            ELSE P.name
        END AS chatName,

        CASE
            WHEN R.projectId IS NULL THEN 'PRIVATE'
            ELSE 'PROJECT'
        END AS chatType,

        (
            SELECT COUNT(M.messageId)
            FROM message M 
            WHERE M.roomId = R.roomId 
            AND M.date > IFNULL(T.lastRead, '1970-01-01')
        ) AS unreadCount
        
    FROM participant T
    JOIN room R ON T.roomId = R.roomId
    LEFT JOIN projects P ON R.projectId = P.projectId 
    
    WHERE T.userId = ? 
    ORDER BY R.lastMessage DESC, R.date DESC;
`;


// =================================================================
// 3. Feature Implement (모듈 내보내기)
// =================================================================

module.exports = {
    /**
     * @description 현재 사용자가 참여하고 있는 모든 채팅 목록을 조회하여 반환합니다.
     */
    list: async (req, res) => {
        let connection; 

        // [1] 사용자 ID 추출 (인증 미들웨어가 보장)
        const currentUserId = req.user.userId;

        logger.info(`[Chat List] 사용자 ID: ${currentUserId}의 채팅 목록 조회 시작`);
        
        try {
            // [2] DB 연결 획득
            connection = await util.promisify(db.getConnection).call(db);

            // [3] 채팅 목록 쿼리 실행
            // 두 개의 바인딩 변수에 currentUserId를 전달합니다. 
            // 1. 서브쿼리(나 아닌 상대방 찾기)
            // 2. 메인 쿼리(내가 참여한 방 찾기)
            const results = await connectionQueryPromise(connection, sqlChatList, [currentUserId, currentUserId]); 

            // [4] 최종 응답 전송
            logger.info(`[Chat List Success] ${currentUserId}의 채팅 목록 ${results.length}개 조회 완료`);
            res.status(200).json({
                message: 'Chat list retrieved successfully',
                list: results
            });

        } catch (error) {
            // [5] 오류 처리
            logger.error(`[Chat List Error] 채팅 목록 조회 중 오류 발생: ${error.message}`, error);
            
            res.status(500).json({ 
                message: '채팅 목록 조회 처리 중 서버 오류가 발생했습니다.' 
            });
            
        } finally {
            // 연결 해제 (Pool로 반환)
            if (connection) {
                connection.release();
            }
        }
    }
};