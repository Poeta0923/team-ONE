// =================================================================
// 1. Core Modules & Configuration
// =================================================================

const db = require('../util/db'); 
const logger = require('../util/logger');
const util = require('util');
const wsManager = require('./wsManager'); // ⭐ wsManager 로드 (필수)

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
// 2. DB Query Definition
// =================================================================

// [1] 프로젝트 이름 및 초대자 닉네임 조회
// Subquery를 사용하여 projectId와 inviterId를 기반으로 정보를 조회합니다.
const sqlGetRequiredInfo = `
    SELECT
        (SELECT name FROM projects WHERE projectId = ?) AS projectName,
        (SELECT nickName FROM users WHERE userId = ?) AS inviterNickName;
`;

// [2] 초대 메시지 기록
// contentType을 'project_invite'로 명시하고, content에는 JSON 문자열을 저장합니다.
const sqlInsertMessage = `
    INSERT INTO message (roomId, userId, content, contentType) 
    VALUES (?, ?, ?, 'project_invite');
`;

// =================================================================
// 3. WebSocket Handler
// =================================================================

module.exports = {
    /**
     * @description 특정 1:1 채팅방 내에서 프로젝트 초대 메시지를 전송하고 기록합니다.
     * @param {object} ws WebSocket 객체 (Inviter의 WS)
     * @param {object} req Express 요청 객체 (req.user에 Inviter 정보 포함)
     * * 클라이언트가 전송하는 메시지 형식: { "roomId": 123, "targetUserId": 1001, "projectId": 42 }
     */
    invite: (ws, req) => {
        let connection;
        // Inviter 정보 (req.user는 verifyToken 미들웨어가 보장)
        const inviterId = req.user.userId;

        // [1] WS 연결 시: 사용자-WS 매핑 (wsManager 사용)
        wsManager.registerConnection(inviterId, ws);
        logger.info(`[WS-INVITE] User ${inviterId} connected to invite WS.`);


        // [2] 메시지 수신 핸들러
        ws.on('message', async (msg) => {
            let parsedMessage;
            try {
                // 메시지 파싱
                parsedMessage = JSON.parse(msg.toString());
            } catch (e) {
                logger.error(`[WS-INVITE ERROR] Invalid JSON received from ${inviterId}: ${msg}`);
                return ws.send(JSON.stringify({ status: 'error', message: 'Invalid message format.' }));
            }
            
            const { roomId, targetUserId, projectId } = parsedMessage;

            // 필수 입력값 검증
            if (!roomId || !targetUserId || !projectId) {
                logger.warn(`[WS-INVITE WARN] Missing required IDs from ${inviterId}`);
                return ws.send(JSON.stringify({ status: 'error', message: '필수 ID(채팅방, 대상 사용자, 프로젝트)가 누락되었습니다.' }));
            }

            if (inviterId === targetUserId) {
                 return ws.send(JSON.stringify({ status: 'error', message: '자기 자신에게는 초대 메시지를 보낼 수 없습니다.' }));
            }
            
            logger.info(`[WS-INVITE] Inviter ${inviterId} sending invite in Room ${roomId} to ${targetUserId} for Project ${projectId}`);

            try {
                // [3] DB 연결 획득 및 트랜잭션 시작
                connection = await util.promisify(db.getConnection).call(db);
                await util.promisify(connection.beginTransaction).call(connection);

                // [4] 프로젝트 이름 및 Inviter 닉네임 조회
                // 파라미터 순서: [projectId, inviterId]
                const [infoResult] = await connectionQueryPromise(connection, sqlGetRequiredInfo, [projectId, inviterId]);
                const { projectName, inviterNickName } = infoResult;

                if (!projectName) {
                    throw new Error(`Project ID ${projectId} not found.`);
                }
                
                // [5] 초대 메시지 내용 (JSON 객체) 생성
                const inviteContent = JSON.stringify({
                    projectId: projectId,
                    projectName: projectName,
                    inviterId: inviterId,
                    inviterNickName: inviterNickName
                });

                // [6] 메시지 DB에 기록
                const insertResult = await connectionQueryPromise(connection, sqlInsertMessage, [roomId, inviterId, inviteContent]);
                const messageId = insertResult.insertId; // 새로 생성된 메시지 ID

                // [7] 트랜잭션 커밋
                await util.promisify(connection.commit).call(connection);

                // [8] 브로드캐스트할 최종 메시지 객체 생성
                const broadcastPayload = {
                    type: 'NEW_MESSAGE', // 클라이언트가 새 메시지 수신을 알 수 있도록 통일된 타입 사용
                    messageId: messageId, 
                    roomId: roomId,
                    userId: inviterId,
                    content: inviteContent,
                    contentType: 'project_invite',
                    date: new Date().toISOString()
                };

                // [9] 해당 채팅방의 모든 참여자에게 메시지 발송 (wsManager 사용)
                await wsManager.broadcastMessageToRoom(roomId, broadcastPayload);
                
                logger.info(`[WS-INVITE] Invite broadcasted successfully in Room ${roomId}. Message ID: ${messageId}`);
                
                // [10] Inviter에게 성공 응답 전송
                ws.send(JSON.stringify({ 
                    status: 'success', 
                    message: '초대 메시지가 성공적으로 전송되었습니다.',
                    sentMessage: broadcastPayload
                }));

            } catch (error) {
                // [11] 오류 처리 및 롤백
                if (connection) {
                    await util.promisify(connection.rollback).call(connection);
                }
                logger.error(`[WS-INVITE ERROR] Invitation process failed for ${inviterId} in Room ${roomId}: ${error.message}`, error);
                
                ws.send(JSON.stringify({ 
                    status: 'error', 
                    message: '초대 메시지 처리 중 서버 오류가 발생했습니다. (자세한 내용은 로그 확인)'
                }));
                
            } finally {
                // 연결 해제 (Pool로 반환)
                if (connection) {
                    connection.release();
                }
            }
        });

        // [12] WS 연결 종료 핸들러
        ws.on('close', () => {
            // wsManager에서 등록 해제
            wsManager.unregisterConnection(inviterId, ws);
        });

        // [13] WS 오류 핸들러
        ws.on('error', (error) => {
            logger.error(`[WS-INVITE ERROR] Connection error for ${inviterId}: ${error.message}`);
            wsManager.unregisterConnection(inviterId, ws);
        });
    }
};