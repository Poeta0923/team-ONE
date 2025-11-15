// =================================================================
// 1. Core Modules & Configuration
// =================================================================

const logger = require('../util/logger');
const db = require('../util/db'); 
const sanitize = require('../util/sanitize');
const util = require('util'); 
const wsManager = require('./wsManager'); // ⭐ wsManager 로드

// =================================================================
// 2. Utility Functions
// =================================================================

/**
 * @description 단일 MySQL 연결 객체를 사용하여 쿼리를 Promise 기반으로 실행합니다.
 */
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
// 3. DB Query Definition
// =================================================================

// 메시지 저장 쿼리
const sqlInsertMessage = `
    INSERT INTO message (roomId, userId, content, contentType) 
    VALUES (?, ?, ?, ?);
`;

// =================================================================
// 4. Feature Implement (모듈 내보내기)
// =================================================================

/**
 * @description WebSocket 연결을 처리하고 메시지 수신 및 발송을 관리합니다.
 */
async function handleWebSocketConnection(ws, req) {
    const userId = req.user.userId;

    // [1] 연결 수립 시 처리: wsManager에 등록
    wsManager.registerConnection(userId, ws);

    
    // ===================================================
    // [2] 메시지 수신 처리 (ws.on('message'))
    // ===================================================
    ws.on('message', async (msg) => {
        let connection;
        
        try {
            // 2-1. 메시지 파싱 및 정제
            const parsedMessage = sanitize.sanitizeObject(JSON.parse(msg.toString()));
            const { roomId, content, contentType } = parsedMessage;

            if (!roomId || !content) {
                logger.warn(`[WS Message] Invalid message format from User ${userId}`);
                ws.send(JSON.stringify({ error: 'Invalid message format' }));
                return;
            }

            // 2-2. DB 연결 획득
            connection = await util.promisify(db.getConnection).call(db);

            // 2-3. DB에 메시지 저장
            const messageData = { 
                roomId, 
                userId, 
                content, 
                contentType: contentType || 'text' 
            };
            
            const result = await connectionQueryPromise(connection, sqlInsertMessage, [
                messageData.roomId,
                messageData.userId,
                messageData.content,
                messageData.contentType
            ]);
            const messageId = result.insertId;
            
            // 2-4. 브로드캐스트할 최종 메시지 객체 생성
            const broadcastPayload = {
                type: 'NEW_MESSAGE',
                messageId: messageId,
                ...messageData,
                date: new Date().toISOString()
            };

            // 2-5. 해당 채팅방의 모든 참여자에게 메시지 발송 (wsManager 사용)
            await wsManager.broadcastMessageToRoom(roomId, broadcastPayload);
            logger.debug(`[WS Send] Message ${messageId} broadcasted to Room ${roomId} via WS Manager`);


        } catch (error) {
            // [6] 오류 처리 
            logger.error(`[WS Handler Error] Error processing message from User ${userId}: ${error.message}`, error);
            ws.send(JSON.stringify({ error: 'Internal server error processing message.' }));
            
        } finally {
            // 연결 해제 (Pool로 반환)
            if (connection) {
                connection.release();
            }
        }
    });

    // ===================================================
    // [3] 연결 종료 처리 (ws.on('close'))
    // ===================================================
    ws.on('close', () => {
        // wsManager에서 등록 해제
        wsManager.unregisterConnection(userId, ws);
    });

    // 참고: ws.on('error') 처리는 생략하고, wsManager의 unregisterConnection이 clean up을 처리하도록 합니다.
}


module.exports = {
    message: handleWebSocketConnection
};