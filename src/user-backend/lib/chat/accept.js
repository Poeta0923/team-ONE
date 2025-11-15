// =================================================================
// 1. Core Modules & Configuration
// =================================================================

const db = require('../util/db'); 
const logger = require('../util/logger');
const util = require('util');

// =================================================================
// 2. DB Query Definition
// =================================================================

// [1] 프로젝트에 멤버 추가 (초대 수락자)
// ⭐ state 필드에 '참여' 상태를 명시적으로 추가합니다.
const sqlAddMember = 'INSERT INTO members (projectId, member, role, state) VALUES (?, ?, "팀원", "참여");';

// [2] 프로젝트 ID로 기존 채팅방 찾기
const sqlFindProjectRoom = `
    SELECT roomId 
    FROM room 
    WHERE projectId = ?;
`;

// [3] 새로운 프로젝트 채팅방 생성
const sqlCreateProjectRoom = 'INSERT INTO room (projectId) VALUES (?);';

// [4] 채팅방에 참여자 추가
const sqlAddParticipant = 'INSERT INTO participant (roomId, userId) VALUES (?, ?);';

// [5] 해당 프로젝트의 팀장 ID 조회 (신규 채팅방 생성 시 필요)
const sqlGetTeamLeaderId = `
    SELECT member AS teamLeaderId 
    FROM members 
    WHERE projectId = ? AND role = '팀장';
`;

// [6] 프로젝트 이름 조회 (응답 메시지용)
const sqlGetProjectName = 'SELECT name FROM projects WHERE projectId = ?;';

// =================================================================
// 3. Feature Implement (모듈 내보내기)
// =================================================================

module.exports = {
    /**
     * @description 프로젝트 초대를 수락하고, 해당 프로젝트에 멤버 및 채팅방 참여자로 추가합니다.
     * API Endpoint: POST /api/project/accept-invite
     */
    accept: async (req, res) => {
        let connection;
        
        // [1] 사용자 ID 및 요청 데이터 추출
        const userId = req.user.userId; // JWT 인증 미들웨어가 보장
        const { projectId } = req.body;

        // [1-1] 필수 입력값 검증
        if (!projectId) {
            logger.warn(`[Accept Invite] 400 Bad Request: projectId가 누락되었습니다. User: ${userId}`);
            return res.status(400).json({ message: '프로젝트 ID가 필요합니다.' });
        }

        logger.info(`[Accept Invite] User ${userId} accepted invite for Project ${projectId}`);

        try {
            // [2] DB 연결 획득 및 트랜잭션 시작
            connection = await util.promisify(db.getConnection).call(db);
            await util.promisify(connection.beginTransaction).call(connection);

            // ------------------------------------------------------------------
            // A. 프로젝트 멤버 추가 (초대 수락자)
            // ------------------------------------------------------------------
            await connectionQueryPromise(connection, sqlAddMember, [projectId, userId]);
            logger.debug(`[Accept Invite] User ${userId} added to members table with state '참여'.`);

            // ------------------------------------------------------------------
            // B. 채팅방 확인 및 처리
            // ------------------------------------------------------------------
            
            // [3] 기존 프로젝트 채팅방 찾기
            let [roomResult] = await connectionQueryPromise(connection, sqlFindProjectRoom, [projectId]);
            let roomId;

            if (roomResult) {
                // 3-1. 방이 있으면 해당 roomId 사용
                roomId = roomResult.roomId;
                logger.debug(`[Accept Invite] Found existing room ${roomId} for project ${projectId}.`);
            } else {
                // 3-2. 방이 없으면 새로운 방 생성
                const newRoomResult = await connectionQueryPromise(connection, sqlCreateProjectRoom, [projectId]);
                roomId = newRoomResult.insertId;
                logger.debug(`[Accept Invite] Created new room ${roomId} for project ${projectId}.`);

                // ⭐ 3-3. 새 방이 생성되면 프로젝트 팀장 추가
                const [leaderResult] = await connectionQueryPromise(connection, sqlGetTeamLeaderId, [projectId]);
                const teamLeaderId = leaderResult ? leaderResult.teamLeaderId : null;

                if (teamLeaderId) {
                    await connectionQueryPromise(connection, sqlAddParticipant, [roomId, teamLeaderId]);
                    logger.debug(`[Accept Invite] Team Leader ${teamLeaderId} added as participant to new room ${roomId}.`);
                } else {
                     // 이 경우는 데이터 정합성 오류로 간주 (프로젝트에는 팀장이 반드시 있어야 함)
                     logger.warn(`[Accept Invite WARN] Project ${projectId} has no Team Leader found.`);
                }
            }

            // [4] 채팅방에 참여자 추가 (초대 수락자)
            await connectionQueryPromise(connection, sqlAddParticipant, [roomId, userId]);
            logger.debug(`[Accept Invite] User ${userId} added as participant to room ${roomId}.`);

            // [5] 트랜잭션 커밋
            await util.promisify(connection.commit).call(connection);
            
            // [6] 프로젝트 이름 조회 (응답 메시지용)
            const [projectInfo] = await connectionQueryPromise(connection, sqlGetProjectName, [projectId]);
            const projectName = projectInfo ? projectInfo.name : `ID ${projectId}`;


            // [7] 성공 응답 전송
            logger.info(`[Accept Invite Success] ${userId} successfully joined Project ${projectId}`);
            res.status(200).json({
                status: 'success',
                message: `프로젝트 '${projectName}'에 성공적으로 참여하였습니다.`,
                projectId: projectId,
                roomId: roomId 
            });

        } catch (error) {
            // [8] 오류 처리 및 롤백
            if (connection) {
                await util.promisify(connection.rollback).call(connection);
            }

            // 이미 멤버로 추가되어 있다면 409 Conflict 반환 (DB 중복 키 오류 1062)
            if (error.code === 'ER_DUP_ENTRY') {
                 logger.warn(`[Accept Invite WARN] User ${userId} is already a member or participant of Project ${projectId}.`);
                 return res.status(409).json({ 
                    message: '이미 해당 프로젝트의 멤버이거나 채팅방 참여자입니다.' 
                });
            }

            logger.error(`[Accept Invite Error] 초대 수락 처리 중 오류 발생: ${error.message}`, error);
            
            res.status(500).json({ 
                message: '초대 수락 처리 중 서버 오류가 발생했습니다.' 
            });
            
        } finally {
            // 연결 해제 (Pool로 반환)
            if (connection) {
                connection.release();
            }
        }
    }
};