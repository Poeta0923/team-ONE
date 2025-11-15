// =================================================================
// 1. Core Modules & Configuration
// =================================================================

const db = require('../util/db'); 
const logger = require('../util/logger');
const util = require('util');

// =================================================================
// 2. DB Query Definition
// =================================================================

// 특정 채팅방의 메시지 목록을 가져오는 쿼리 (닉네임 포함, 페이징 적용)
// 사용자에게 최신 메시지부터 보여주기 위해 messageId를 내림차순으로 정렬합니다.
// 클라이언트에서 메시지 전송 시각을 기반으로 정렬할 수 있도록 date도 포함합니다.
const sqlGetMessages = `
    SELECT
        M.messageId,
        M.roomId,
        M.userId,
        M.content,
        M.contentType,
        M.date,
        U.nickName
    FROM message M
    JOIN users U ON M.userId = U.userId
    WHERE M.roomId = ?
    ORDER BY M.messageId DESC, M.date DESC
    LIMIT ? OFFSET ?;
`;

// 사용자가 해당 방의 참여자인지 확인하는 쿼리
const sqlCheckParticipant = `
    SELECT participantId FROM participant WHERE roomId = ? AND userId = ?;
`;

// 사용자의 마지막 읽음 시간(lastRead)을 현재 시간으로 업데이트하는 쿼리
const sqlUpdateLastRead = `
    UPDATE participant SET lastRead = NOW() WHERE roomId = ? AND userId = ?;
`;


// =================================================================
// 3. Feature Implement (모듈 내보내기)
// =================================================================

module.exports = {
    /**
     * @description 특정 채팅방의 과거 메시지 목록을 조회하고, 사용자의 lastRead 시간을 업데이트합니다.
     */
    getMessages: async (req, res) => {
        let connection; 

        // [1] 사용자 ID 및 입력 추출
        const currentUserId = req.user.userId;
        const roomId = req.params.roomId;
        
        // 쿼리 파라미터에서 페이징 정보를 추출 (기본값 설정)
        const limit = parseInt(req.query.limit, 10) || 50; 
        const offset = parseInt(req.query.offset, 10) || 0; 

        logger.info(`[Chat Room] RoomId ${roomId} 메시지 조회 시작. User: ${currentUserId}, Limit: ${limit}, Offset: ${offset}`);
        
        try {
            // [2] DB 연결 획득
            connection = await util.promisify(db.getConnection).call(db);

            // [3] 사용자 권한 확인: 해당 방의 참여자인지 검사
            const isParticipant = await connectionQueryPromise(connection, sqlCheckParticipant, [roomId, currentUserId]);
            if (isParticipant.length === 0) {
                logger.warn(`[Chat Room] 403 Forbidden: User ${currentUserId}는 Room ${roomId}의 참여자가 아닙니다.`);
                return res.status(403).json({ message: '해당 채팅방에 접근 권한이 없습니다.' });
            }

            // [4] 메시지 목록 쿼리 실행
            // roomId, limit, offset을 전달
            const results = await connectionQueryPromise(connection, sqlGetMessages, [roomId, limit, offset]); 

            // [5] lastRead 시간 업데이트 (비동기로 실행, 응답에 영향 X)
            // 사용자가 메시지를 읽었으므로, 마지막 읽음 시간을 업데이트합니다.
            // 트랜잭션이 필요 없으므로 별도 처리
            await connectionQueryPromise(connection, sqlUpdateLastRead, [roomId, currentUserId]);
            logger.debug(`[Chat Room] User ${currentUserId}의 Room ${roomId} lastRead 업데이트 완료.`);


            // [6] 최종 응답 전송
            // 응답 시 메시지 목록은 클라이언트가 시간순으로 볼 수 있도록 배열을 반전시킬 수 있습니다.
            logger.info(`[Chat Room Success] Room ${roomId} 메시지 ${results.length}개 조회 완료.`);
            res.status(200).json({
                message: 'Messages retrieved successfully',
                roomId: roomId,
                // DESC로 가져왔으므로, 클라이언트에서 ASC로 보여주기 위해 .reverse()가 필요할 수 있습니다.
                list: results 
            });

        } catch (error) {
            // [7] 오류 처리
            logger.error(`[Chat Room Error] 메시지 조회 중 오류 발생: ${error.message}`, error);
            
            res.status(500).json({ 
                message: '채팅 메시지 조회 처리 중 서버 오류가 발생했습니다.' 
            });
            
        } finally {
            // 연결 해제 (Pool로 반환)
            if (connection) {
                connection.release();
            }
        }
    }
};