// 파일: ./lib/chat/resume.js

// =================================================================
// 1. Core Modules & Configuration
// =================================================================

const logger = require('../util/logger');
const db = require('../util/db');
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
// 3. SQL Queries
// =================================================================

// users + resumes JOIN
const sqlGetResumeInfo = `
    SELECT 
        u.userId,
        u.nickName,
        u.job,

        r.resumeId,
        r.address,
        r.mbti,
        r.workStyle,
        r.workTime,
        r.techStack AS resumeTechStack,
        r.interest,
        r.gitHub,
        r.blog,
        r.projectExp,
        r.coverLetter
    FROM users u
    LEFT JOIN resumes r ON u.userId = r.userId
    WHERE u.userId = ?;
`;

// techStacks (N개)
const sqlGetTechStackList = `
    SELECT techStack
    FROM techStacks
    WHERE userId = ?;
`;

// 메시지 DB 저장
const sqlInsertMessage = `
    INSERT INTO message (roomId, userId, content, contentType)
    VALUES (?, ?, ?, 'resume');
`;

// =================================================================
// 4. WebSocket Handler
// =================================================================

module.exports = {
    resume: (ws, req) => {
        const userId = req.user.userId;

        // WS 연결 등록
        wsManager.registerConnection(userId, ws);
        logger.info(`[WS-RESUME] User ${userId} connected to resume WS.`);

        ws.on('message', async (raw) => {
            let parsed;
            let connection;

            // -------------------------
            // JSON Parsing
            // -------------------------
            try {
                parsed = JSON.parse(raw.toString());
            } catch (e) {
                logger.warn(`[WS-RESUME] Invalid JSON from ${userId}: ${e.message}`);
                try { ws.send(JSON.stringify({ error: 'Invalid JSON format.' })); } catch (_) {}
                return;
            }

            const safe = sanitize.sanitizeObject(parsed);
            const { roomId } = safe;

            // -------------------------
            // Validate
            // -------------------------
            if (!roomId) {
                try { ws.send(JSON.stringify({ error: 'roomId is required.' })); } catch (_) {}
                return;
            }

            logger.info(`[WS-RESUME] User ${userId} sending resume to Room ${roomId}`);

            try {
                // DB 연결
                connection = await util.promisify(db.getConnection).call(db);

                // -------------------------
                // 1) users + resumes 조회
                // -------------------------
                const [resumeRow] = await connectionQueryPromise(
                    connection, sqlGetResumeInfo, [userId]
                );

                if (!resumeRow) throw new Error("Resume info not found");

                // -------------------------
                // 2) techStacks 조회
                // -------------------------
                const stackRows = await connectionQueryPromise(
                    connection, sqlGetTechStackList, [userId]
                );

                const techStackList = stackRows.map(r => r.techStack);

                // -------------------------
                // 3) 최종 ResumePayload 생성
                // -------------------------
                const resumePayload = {
                    userId: resumeRow.userId,
                    name: resumeRow.name,
                    phoneNumber: resumeRow.phoneNumber,
                    nickName: resumeRow.nickName,
                    job: resumeRow.job,

                    address: resumeRow.address,
                    mbti: resumeRow.mbti,
                    workStyle: resumeRow.workStyle,
                    workTime: resumeRow.workTime,
                    techStack: resumeRow.resumeTechStack,
                    interest: resumeRow.interest,
                    gitHub: resumeRow.gitHub,
                    blog: resumeRow.blog,
                    projectExp: !!resumeRow.projectExp,
                    coverLetter: resumeRow.coverLetter,

                    aiTechStackList: techStackList
                };

                // -------------------------
                // 4) DB Insert (JSON 저장)
                // -------------------------
                const insert = await connectionQueryPromise(
                    connection,
                    sqlInsertMessage,
                    [roomId, userId, JSON.stringify(resumePayload)]
                );

                const messageId = insert.insertId;

                // -------------------------
                // 5) 브로드캐스트용 Payload 구성
                // -------------------------
                const broadcastPayload = {
                    type: 'NEW_MESSAGE',
                    messageId,
                    roomId,
                    userId,
                    content: resumePayload,  // 객체 그대로 전송
                    contentType: 'resume',
                    date: new Date().toISOString()
                };

                await wsManager.broadcastMessageToRoom(roomId, broadcastPayload);

                logger.info(`[WS-RESUME] Resume message sent. Message ID: ${messageId}`);

                // 클라이언트에게 성공 응답
                try {
                    ws.send(JSON.stringify({
                        status: 'success',
                        sentMessage: broadcastPayload
                    }));
                } catch (_) {}

            } catch (e) {
                logger.error(`[WS-RESUME ERROR] ${e.message}`, e);
                try {
                    ws.send(JSON.stringify({
                        status: 'error',
                        message: '이력서 전송 중 오류 발생'
                    }));
                } catch (_) {}

            } finally {
                if (connection) connection.release();
            }
        });

        // 연결 종료
        ws.on('close', () => {
            wsManager.unregisterConnection(userId, ws);
        });

        ws.on('error', (err) => {
            logger.error(`[WS-RESUME ERROR] WS error for ${userId}: ${err.message}`);
            wsManager.unregisterConnection(userId, ws);
        });
    }
};
