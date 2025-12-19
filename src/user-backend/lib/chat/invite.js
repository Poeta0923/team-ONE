// 파일: ./lib/chat/invite.js

// =================================================================
// 1. Core Modules & Configuration
// =================================================================

const db = require('../util/db'); 
const logger = require('../util/logger');
const util = require('util');
const sanitize = require('../util/sanitize');
const wsManager = require('./wsManager');

// =================================================================
// 2. DB Helper
// =================================================================

function connectionQueryPromise(connection, sql, values = []) {
    return new Promise((resolve, reject) => {
        connection.query(sql, values, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
}

// =================================================================
// 3. SQL Definition
// =================================================================

// 프로젝트명 + 초대자 닉네임 조회
const sqlGetRequiredInfo = `
    SELECT
        (SELECT name FROM projects WHERE projectId = ?) AS projectName,
        (SELECT nickName FROM users WHERE userId = ?) AS inviterNickName;
`;

// 초대 메시지 insert
const sqlInsertMessage = `
    INSERT INTO message (roomId, userId, content, contentType)
    VALUES (?, ?, ?, 'project_invite');
`;

// =================================================================
// 4. WebSocket Handler
// =================================================================

module.exports = {
    invite: (ws, req) => {
        let connection;
        const inviterId = req.user.userId;

        // WS 연결 등록
        wsManager.registerConnection(inviterId, ws);
        logger.info(`[WS-INVITE] User ${inviterId} connected to invite WS.`);

        // 메시지 수신
        ws.on('message', async (raw) => {
            // -----------------------------
            // JSON Parse
            // -----------------------------
            let parsed;
            try {
                parsed = JSON.parse(raw.toString());
            } catch (e) {
                logger.warn(`[WS-INVITE] Invalid JSON from ${inviterId}: ${e.message}`);
                try { ws.send(JSON.stringify({ error: 'Invalid JSON format.' })); } catch (_) {}
                return;
            }

            // -----------------------------
            // Sanitize  
            // -----------------------------
            const safe = sanitize.sanitizeObject(parsed);
            const { roomId, targetUserId, projectId } = safe;

            // -----------------------------
            // Validation
            // -----------------------------
            if (!roomId || !targetUserId || !projectId) {
                try {
                    ws.send(JSON.stringify({
                        error: 'roomId, targetUserId, projectId are required.'
                    }));
                } catch (_) {}
                return;
            }

            if (inviterId === targetUserId) {
                try { ws.send(JSON.stringify({ error: '본인에게 초대를 보낼 수 없습니다.' })); } catch (_) {}
                return;
            }

            logger.info(
                `[WS-INVITE] ${inviterId} -> ${targetUserId} / Project ${projectId} / Room ${roomId}`
            );

            try {
                // DB 연결 + 트랜잭션
                connection = await util.promisify(db.getConnection).call(db);
                await util.promisify(connection.beginTransaction).call(connection);

                // 프로젝트 이름 + 초대자 닉네임 조회
                const [info] = await connectionQueryPromise(
                    connection,
                    sqlGetRequiredInfo,
                    [projectId, inviterId]
                );

                if (!info.projectName) {
                    throw new Error(`Project ID ${projectId} not found`);
                }

                // 초대 메시지 content 객체
                const inviteData = {
                    projectId,
                    projectName: info.projectName,
                    inviterId,
                    inviterNickName: info.inviterNickName || null
                };

                // DB 저장 (content는 JSON 문자열)
                const insert = await connectionQueryPromise(
                    connection,
                    sqlInsertMessage,
                    [roomId, inviterId, JSON.stringify(inviteData)]
                );

                const messageId = insert.insertId;

                // 트랜잭션 커밋
                await util.promisify(connection.commit).call(connection);

                // -----------------------------
                // Broadcast Payload
                // -----------------------------
                const broadcastPayload = {
                    type: 'NEW_MESSAGE',
                    messageId,
                    roomId,
                    userId: inviterId,
                    content: inviteData,   // ⭐ JSON 문자열이 아닌 객체 그대로 전송!
                    contentType: 'project_invite',
                    date: new Date().toISOString()
                };

                // 브로드캐스트
                await wsManager.broadcastMessageToRoom(roomId, broadcastPayload);

                logger.info(`[WS-INVITE] Invite sent. Message ID: ${messageId}`);

                // 발신자에게 성공 응답
                try {
                    ws.send(JSON.stringify({
                        status: 'success',
                        sentMessage: broadcastPayload
                    }));
                } catch (_) {}

            } catch (error) {
                if (connection) {
                    await util.promisify(connection.rollback).call(connection);
                }

                logger.error(`[WS-INVITE ERROR] ${error.message}`, error);

                try {
                    ws.send(JSON.stringify({
                        status: 'error',
                        message: '초대 처리 중 서버 오류가 발생했습니다.'
                    }));
                } catch (_) {}

            } finally {
                if (connection) connection.release();
            }
        });

        // 연결 종료
        ws.on('close', () => {
            wsManager.unregisterConnection(inviterId, ws);
        });

        // 오류 발생 시
        ws.on('error', (error) => {
            logger.error(`[WS-INVITE ERROR] WS error for ${inviterId}: ${error.message}`);
            wsManager.unregisterConnection(inviterId, ws);
        });
    }
};
