// 파일: ./lib/chat/message.js

// =================================================================
// 1. Core Modules & Configuration
// =================================================================

const logger = require('../util/logger');
const db = require('../util/db');
const sanitize = require('../util/sanitize');
const util = require('util');
const wsManager = require('./wsManager');

// =================================================================
// 2. DB Helper & SQL 정의
// =================================================================

/**
 * @description MySQL connection.query를 Promise 방식으로 감싸는 헬퍼
 */
const connectionQueryPromise = (connection, sql, values = []) => {
    return new Promise((resolve, reject) => {
        connection.query(sql, values, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
};

// 메시지 저장 쿼리
const sqlInsertMessage =
    'INSERT INTO message (roomId, userId, content, contentType) VALUES (?, ?, ?, ?);';

// 마지막 메시지 시간 업데이트 쿼리
const sqlUpdateLastMessage =
    'UPDATE room SET lastMessage = NOW() WHERE roomId = ?;';

// =================================================================
// 4. Feature Implement
// =================================================================

/**
 * @description WebSocket 연결을 처리하고 메시지 수신 및 발송을 관리합니다.
 */
async function handleWebSocketConnection(ws, req) {
    const userId = req.user.userId;

    // [1] 연결 수립 시 처리: wsManager에 등록
    wsManager.registerConnection(userId, ws);

    // ===================================================
    // [2] 메시지 수신 처리
    // ===================================================
    ws.on('message', async (msg) => {
        let connection;

        try {
            // 2-1. 메시지 문자열 파싱
            const raw = msg.toString();
            let parsedMessage;

            try {
                parsedMessage = JSON.parse(raw);
            } catch (e) {
                logger.warn(
                    `[WS Message] Invalid JSON format from User ${userId}: ${e.message}`
                );
                try {
                    ws.send(JSON.stringify({ error: 'Invalid JSON format.' }));
                } catch (_) {}
                return;
            }

            // 2-2. 정제(XSS 방어)
            const safeMessage = sanitize.sanitizeObject(parsedMessage);
            const { roomId, content, contentType } = safeMessage;

            // 2-3. 유효성 검사
            if (!roomId || !content) {
                logger.warn(
                    `[WS Message] Invalid message format (Missing roomId or content) from User ${userId}`
                );
                try {
                    ws.send(
                        JSON.stringify({
                            error: 'Room ID and Content required for chat message',
                        })
                    );
                } catch (_) {}
                return;
            }

            // 2-4. DB 연결 획득
            connection = await util.promisify(db.getConnection).call(db);

            // 2-5. DB에 메시지 저장
            const messageData = {
                roomId,
                userId,
                content,
                contentType: contentType || 'text',
            };

            const result = await connectionQueryPromise(connection, sqlInsertMessage, [
                messageData.roomId,
                messageData.userId,
                messageData.content,
                messageData.contentType,
            ]);
            const messageId = result.insertId;

            // ⭐ 2-6. room 테이블의 lastMessage 갱신
            await connectionQueryPromise(connection, sqlUpdateLastMessage, [roomId]);

            // 2-7. WS 브로드캐스트용 메시지 객체
            const broadcastPayload = {
                type: 'NEW_MESSAGE',
                messageId,
                ...messageData,
                date: new Date().toISOString(),
            };

            // 2-8. 해당 방에 참여한 모든 유저에게 메시지 전송
            await wsManager.broadcastMessageToRoom(roomId, broadcastPayload);

            logger.debug(
                `[WS Send] Message ${messageId} broadcasted to Room ${roomId} via WS Manager`
            );

        } catch (error) {
            logger.error(
                `[WS Handler Error] Error processing message from User ${userId}: ${error.message}`,
                error
            );

            try {
                ws.send(
                    JSON.stringify({
                        error: 'Internal server error processing message.',
                    })
                );
            } catch (_) {}

        } finally {
            // DB 연결 반환
            if (connection) {
                connection.release();
            }
        }
    });

    // ===================================================
    // [3] 연결 종료 처리
    // ===================================================
    ws.on('close', () => {
        wsManager.unregisterConnection(userId, ws);
    });
}

module.exports = {
    message: handleWebSocketConnection,
};
