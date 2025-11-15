// =================================================================
// 1. Core Modules & Configuration
// =================================================================

const logger = require('../util/logger');
const db = require('../util/db'); 
const util = require('util'); 

// =================================================================
// 2. Global State Management (연결된 클라이언트 관리)
// =================================================================

// { userId: [ws1, ws2, ...] } 형태로 연결된 사용자들을 관리합니다.
// 이 객체는 모든 WebSocket 핸들러가 공유하는 중앙 상태입니다.
const connectedClients = {};

// 채팅방 참여자 ID 조회 쿼리 (모든 브로드캐스트에 필요)
const sqlGetParticipants = `SELECT userId FROM participant WHERE roomId = ?`;

// DB 쿼리용 헬퍼 함수
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
// 3. Manager Functions
// =================================================================

/**
 * @description WebSocket 연결을 등록합니다. (ws, invite 모두 사용)
 */
function registerConnection(userId, ws) {
    if (!connectedClients[userId]) {
        connectedClients[userId] = [];
    }
    connectedClients[userId].push(ws);
    logger.info(`[WS Manager] User ${userId} connected. Total connections: ${connectedClients[userId].length}`);
}

/**
 * @description WebSocket 연결을 해제하고 등록을 취소합니다.
 */
function unregisterConnection(userId, ws) {
    if (connectedClients[userId]) {
        connectedClients[userId] = connectedClients[userId].filter(client => client !== ws);
        
        if (connectedClients[userId].length === 0) {
            delete connectedClients[userId];
        }
        logger.info(`[WS Manager] User ${userId} disconnected. Remaining: ${connectedClients[userId]?.length || 0}`);
    }
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
        logger.debug(`[WS Manager] Broadcast complete for Room ${roomId}. Target IDs: ${participantIds.join(',')}`);


    } catch (error) {
        logger.error(`[WS Manager ERROR] Failed to broadcast message for Room ${roomId}: ${error.message}`);
    } finally {
        if (connection) connection.release();
    }
}


module.exports = {
    registerConnection,
    unregisterConnection,
    broadcastMessageToRoom
};