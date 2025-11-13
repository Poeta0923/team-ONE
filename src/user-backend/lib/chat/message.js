// =================================================================
// 1. Core Modules & Configuration
// =================================================================

const logger = require('../util/logger');
const db = require('../util/db'); 
const sanitize = require('../util/sanitize');
const util = require('util'); 

// =================================================================
// 2. Utility Functions (트랜잭션 처리를 위해 재정의 - 기존 코드와 동일)
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
// 3. Global State Management (연결된 클라이언트 관리)
// =================================================================

// { userId: [ws1, ws2, ...] } 형태로 연결된 사용자들을 관리합니다.
const connectedClients = {};

// 메시지 저장 쿼리
const sqlInsertMessage = `
    INSERT INTO message (roomId, userId, content, contentType) 
    VALUES (?, ?, ?, ?);
`;

// 채팅방 참여자 ID 조회 쿼리
const sqlGetParticipants = `SELECT userId FROM participant WHERE roomId = ?`;


// =================================================================
// 4. Feature Implement (모듈 내보내기)
// =================================================================

/**
 * @description WebSocket 연결을 처리하고 메시지 수신 및 발송을 관리합니다.
 */
async function handleWebSocketConnection(ws, req) {
    const userId = req.user.userId;

    // [1] 연결 수립 시 처리
    if (!connectedClients[userId]) {
        connectedClients[userId] = [];
    }
    connectedClients[userId].push(ws);
    logger.info(`[WS Connect] User ${userId} connected. Total connections: ${connectedClients[userId].length}`);

    
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

            // 2-5. 해당 채팅방의 모든 참여자에게 메시지 발송
            await broadcastMessageToRoom(roomId, broadcastPayload);
            logger.debug(`[WS Send] Message ${messageId} broadcasted to Room ${roomId}`);


        } catch (error) {
            // [6] 오류 처리 및 롤백 (WS는 롤백이 필요 없음)
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
        if (connectedClients[userId]) {
            connectedClients[userId] = connectedClients[userId].filter(client => client !== ws);
            
            if (connectedClients[userId].length === 0) {
                delete connectedClients[userId];
            }
        }
        logger.info(`[WS Disconnect] User ${userId} disconnected. Remaining connections: ${connectedClients[userId]?.length || 0}`);
    });
}

/**
 * @description 특정 채팅방의 모든 참여자에게 메시지를 발송합니다. (DB 접근 포함)
 */
async function broadcastMessageToRoom(roomId, payload) {
    let connection;
    try {
        // [1] DB 연결 획득
        connection = await util.promisify(db.getConnection).call(db);

        // [2] DB에서 해당 채팅방의 모든 참여자 ID를 조회합니다.
        const results = await connectionQueryPromise(connection, sqlGetParticipants, [roomId]);
        
        const participantIds = results.map(row => row.userId);
        const payloadString = JSON.stringify(payload);

        // [3] 연결된 클라이언트 맵을 순회하며 메시지 전송
        participantIds.forEach(participantId => {
            const clients = connectedClients[participantId];
            
            if (clients) {
                clients.forEach(client => {
                    if (client.readyState === 1) { // WebSocket.OPEN
                        client.send(payloadString);
                    }
                });
            }
        });

    } catch (error) {
        logger.error(`[Broadcast Error] Failed to broadcast message for Room ${roomId}: ${error.message}`);
    } finally {
        if (connection) connection.release();
    }
}


module.exports = {
    message: handleWebSocketConnection
};