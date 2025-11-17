// =================================================================
// 1. Core Modules & Configuration
// =================================================================

// 데이터베이스 연결 모듈 로드 (db.js에서 완성된 연결 풀 객체를 가져옴)
const db = require('../util/db'); 
// 프로젝트 전역 로거 (Winston) 로드
const logger = require('../util/logger');
// 입력 객체 Sanitization 유틸리티 로드 (XSS 방지 및 기본 입력 Sanitization)
const sanitize = require('../util/sanitize');
// Node.js의 util 모듈 로드 (Promisify 사용을 위해)
const util = require('util');


// =================================================================
// 2. Utility Functions (트랜잭션 처리를 위해 재정의)
// =================================================================

/**
 * @description 단일 MySQL 연결 객체를 사용하여 쿼리를 Promise 기반으로 실행합니다.
 * 트랜잭션 환경에서 사용됩니다.
 * @param {object} connection 현재 사용 중인 DB 연결 객체 (풀에서 가져온 것)
 * @param {string} sql 실행할 SQL 쿼리 문자열
 * @param {Array} values SQL 쿼리에 바인딩할 값들의 배열
 * @returns {Promise<object>} 쿼리 결과를 resolve하는 프로미스
 */
// 💡 참고: connectionQueryPromise 함수 정의가 누락되어 있지만, 
//        기존 코드의 흐름을 유지하기 위해 사용한다고 가정하고 코드를 수정합니다.
const connectionQueryPromise = (connection, sql, values) => {
    return util.promisify(connection.query).call(connection, sql, values);
};


// =================================================================
// 3. Feature Implement (모듈 내보내기)
// =================================================================

// DB 쿼리 정의
const sqlFindRoom = `
    SELECT T1.roomId
    FROM participant T1
    JOIN participant T2 ON T1.roomId = T2.roomId
    JOIN room R ON T1.roomId = R.roomId
    WHERE 
        T1.userId = ? AND T2.userId = ? 
        AND R.projectId IS NULL
    GROUP BY T1.roomId
    HAVING COUNT(T1.roomId) = 2
`;
const sqlInsertRoom = `INSERT INTO room (projectId) VALUES (NULL)`;
const sqlInsertParticipants = `INSERT INTO participant (roomId, userId) VALUES (?, ?), (?, ?)`;
const sqlSelectRoomInfo = `SELECT * FROM room WHERE roomId = ?`;


module.exports = {
    /**
     * @description 1대1 채팅방 생성 또는 이미 존재하는 방 조회 후 반환
     */
    private: async (req, res) => {
        let connection; 
        // 🌟 수정: createdNew 변수를 함수 스코프 내에서 선언하여 
        //         try와 catch 블록 모두에서 접근 가능하게 만듭니다.
        let createdNew = false; 

        // [1] 사용자 ID 및 입력 추출
        const currentUserId = req.user.userId;
        const sanitizedBody = sanitize.sanitizeObject(req.body);
        const targetUserId = sanitizedBody.targetUserId;

        logger.info(`[Private Chat] 1:1 채팅방 처리 시작. User: ${currentUserId}, Target: ${targetUserId}`);

        // 유효성 검사
        if (!targetUserId) {
            logger.warn(`[Private Chat] 400 Bad Request: targetUserId 없음. User: ${currentUserId}`);
            return res.status(400).json({ message: '상대방 ID(targetUserId)가 필요합니다.' });
        }
        if (currentUserId === targetUserId) {
            logger.warn(`[Private Chat] 400 Bad Request: 자신과의 채팅방 생성 시도. User: ${currentUserId}`);
            return res.status(400).json({ message: '자신과의 채팅방은 생성할 수 없습니다.' });
        }
        
        try {
            // [2] DB 연결 획득 및 기존 채팅방 조회 (트랜잭션 없이 조회만)
            connection = await util.promisify(db.getConnection).call(db);

            const findRoomValues = [currentUserId, targetUserId];
            const resultFind = await connectionQueryPromise(connection, sqlFindRoom, findRoomValues);
            
            let roomId;
            let roomInfo;
            // 이전 코드에서 이곳에 'let createdNew = false;'가 있었는데, 제거하고 위에 선언했습니다.
            
            // [3] 기존 방 처리
            if (resultFind && resultFind.length > 0) {
                roomId = resultFind[0].roomId;
                logger.info(`[Private Chat] 기존 방 발견: RoomId ${roomId}`);
                
                // 기존 방 정보 조회
                const roomInfoResult = await connectionQueryPromise(connection, sqlSelectRoomInfo, [roomId]);
                roomInfo = roomInfoResult[0];

            } else {
                // [4] 새 방 생성 (트랜잭션 시작)
                await util.promisify(connection.beginTransaction).call(connection);
                createdNew = true; // 🌟 try 블록 외부의 변수에 값 할당
                
                // [4-1] room 테이블에 새 방 생성
                const resultRoomInsert = await connectionQueryPromise(connection, sqlInsertRoom);
                roomId = resultRoomInsert.insertId;

                // [4-2] participant 테이블에 두 사용자 추가
                const participantValues = [
                    roomId, currentUserId, 
                    roomId, targetUserId
                ];
                await connectionQueryPromise(connection, sqlInsertParticipants, participantValues);
                
                // 트랜잭션 커밋
                await util.promisify(connection.commit).call(connection);

                // [4-3] 생성된 방 정보 조회
                const roomInfoResult = await connectionQueryPromise(connection, sqlSelectRoomInfo, [roomId]);
                roomInfo = roomInfoResult[0];

                logger.info(`[Private Chat] 새 방 생성 완료: RoomId ${roomId}`);
            }

            // [5] 최종 응답 전송
            const statusCode = createdNew ? 201 : 200;
            const message = createdNew ? '새로운 1:1 채팅방이 생성되었습니다.' : '기존 1:1 채팅방을 조회했습니다.';
            
            res.status(statusCode).json({
                message: message,
                roomId: roomId,
                room: roomInfo // 조회된 방 정보를 응답에 포함
            });

        } catch (error) {
            // [6] 오류 처리 및 롤백
            // 🌟 이제 createdNew 변수에 안전하게 접근 가능
            if (connection && createdNew) { 
                // 새 방 생성 중 오류가 발생한 경우만 롤백 실행
                await util.promisify(connection.rollback).call(connection); 
                logger.warn(`[Private Chat Rollback] 새 방 생성 중 오류로 롤백 실행됨.`);
            }

            logger.error(`[Private Chat Error] 1:1 채팅방 처리 중 오류 발생: ${error.message}`, error);
            
            // 클라이언트에게 오류 메시지 반환
            res.status(500).json({ 
                message: '채팅방 생성/조회 처리 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' 
            });
            
        } finally {
            // 연결 해제 (Pool로 반환)
            if (connection) {
                connection.release();
            }
        }
    }
};