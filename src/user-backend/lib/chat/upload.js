// =================================================================
// 1. Core Modules & Configuration
// =================================================================

const db = require('../util/db');
const logger = require('../util/logger');
const util = require('util');
const wsManager = require('./wsManager');
const path = require('path');

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

// 메시지 INSERT
const sqlInsertFileMessage = `
    INSERT INTO message (roomId, userId, content, contentType)
    VALUES (?, ?, ?, 'file');
`;

// 마지막 메시지 시간 갱신
const sqlUpdateRoomLastMessage = `
    UPDATE room SET lastMessage = NOW() WHERE roomId = ?;
`;

// =================================================================
// 3. File Upload Handler
// =================================================================

module.exports = {
    uploadFile: async (req, res) => {
        let connection;

        try {
            // --------------------------------------------------------
            // 1. 인증 정보
            // --------------------------------------------------------
            const userId = req.user.userId;

            // --------------------------------------------------------
            // 2. 필수값 검증
            // --------------------------------------------------------
            const roomId = req.body.roomId;
            const file = req.file;

            if (!roomId) {
                return res.status(400).json({ error: "roomId is required" });
            }

            if (!file) {
                return res.status(400).json({ error: "file is required" });
            }

            logger.info(`[FILE UPLOAD] User ${userId} uploading file to Room ${roomId}`);

            // --------------------------------------------------------
            // 3. 파일 URL 생성
            // --------------------------------------------------------
            const fileUrl = `/uploads/chat/${file.filename}`;

            // --------------------------------------------------------
            // 4. DB 연결
            // --------------------------------------------------------
            connection = await util.promisify(db.getConnection).call(db);

            // --------------------------------------------------------
            // 5. DB 저장
            // --------------------------------------------------------
            const insert = await connectionQueryPromise(
                connection,
                sqlInsertFileMessage,
                [roomId, userId, fileUrl]
            );

            const messageId = insert.insertId;

            // Room lastMessage 업데이트
            await connectionQueryPromise(connection, sqlUpdateRoomLastMessage, [roomId]);

            // --------------------------------------------------------
            // 6. WebSocket 브로드캐스트
            // --------------------------------------------------------
            const payload = {
                type: "NEW_MESSAGE",
                roomId,
                messageId,
                userId,
                content: {
                    url: fileUrl,
                    fileName: file.originalname,
                    fileSize: file.size,
                },
                contentType: "file",
                date: new Date().toISOString(),
            };

            await wsManager.broadcastMessageToRoom(roomId, payload);

            logger.info(`[FILE UPLOAD SUCCESS] messageId=${messageId}`);

            // --------------------------------------------------------
            // 7. 클라이언트 응답
            // --------------------------------------------------------
            res.status(200).json({
                status: "success",
                fileUrl,
                messageId,
                payload,
            });

        } catch (err) {
            logger.error(`[FILE UPLOAD ERROR] ${err.message}`, err);

            res.status(500).json({
                status: "error",
                message: "파일 전송 중 오류 발생",
            });
        } finally {
            if (connection) connection.release();
        }
    },
};
