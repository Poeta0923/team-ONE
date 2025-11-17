// =================================================================
// 1. Core Modules & Configuration
// =================================================================

const db = require('../util/db'); 
const logger = require('../util/logger');
const util = require('util');

// =================================================================
// 2. DB Query Definition
// =================================================================

// DB 쿼리용 헬퍼 함수 (기존 프로젝트 형식 유지)
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

// 신고 처리 쿼리
const sqlReport = `INSERT INTO reports (reporterId, reportedId, reason, status) VALUES (?, ?, ?, 'pending')`;

// =================================================================
// 3. Feature Implement (모듈 내보내기)
// =================================================================

module.exports = {
    /**
     * @description 현재 사용자가 참여하고 있는 채팅방 메뉴의 필요 정보를 반환합니다.
     */
    report: async (req, res) => {
        let connection; 

        // [1=1] 사용자 ID 추출 (인증 미들웨어가 보장)
        const userId = req.user.userId; // ⭐ userId 사용
        
        // [1-2] 현재 신고 내용 추출
        const reported = req.body.reportedId;
        const reason = req.body.reason;

        logger.info(`[Report] 사용자 ID: ${userId}의 신고 접수 시작 (Reported: ${reported})`);
        
        try {
            // [2] DB 연결 획득
            connection = await util.promisify(db.getConnection).call(db);

            // [3] 쿼리 실행
            const resultReport = await connectionQueryPromise(connection, sqlReport, [userId, reported, reason]);

            // [4] 최종 응답 전송
            logger.info(`[Report Success] ${userId}의 채팅 신고 접수 완료 (Reported: ${reported})`);
            res.status(200).json({
                message: 'Report success',
            });

        } catch (error) {
            // [5] 오류 처리 (로그 태그 수정)
            logger.error(`[Report Error] 신고 접수 중 오류 발생: ${error.message}`, error); // ⭐ 로그 태그 및 메시지 수정
            
            res.status(500).json({ 
                message: '신고 접수 처리 중 서버 오류가 발생했습니다.'
            });
            
        } finally {
            // 연결 해제 (Pool로 반환)
            if (connection) {
                connection.release();
            }
        }
    }
};