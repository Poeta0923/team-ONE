package com.teammatching.admin.user.service;

import com.teammatching.admin.user.domain.Role;
import com.teammatching.admin.user.domain.User;
import com.teammatching.admin.user.domain.Report;
import com.teammatching.admin.user.domain.UserStatus;
import com.teammatching.admin.user.dto.*;
import com.teammatching.admin.user.repository.ReportRepository;
import com.teammatching.admin.user.repository.UserRepository;
import com.teammatching.admin.user.repository.UserStatusRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@RequiredArgsConstructor
@Transactional
@Service
public class UserAdminService {

    private final UserRepository userRepository;
    private final ReportRepository reportRepository;
    private final UserStatusRepository userStatusRepository;

    /**
     * 전체 회원 목록을 페이징하여 조회
     * @param pageable 페이징 정보 (예: 0번째 페이지, 10개씩)
     * @return 페이징된 회원 목록 (DTO)
     */
    @Transactional(readOnly = true)
    public UserPagingResponse getUsers(Pageable pageable) {
        // Role이 'USER'인 회원 목록만 Page 객체로 가져옴
        Page<User> users = userRepository.findByRole(Role.USER, pageable);
        Page<UserListResponse> userResponses = users.map(UserListResponse::from);

        return UserPagingResponse.from(userResponses);
    }

    /**
     * 전체 신고 내역을 페이징하여 조회
     * @param status   필터링할 상태 (null이면 전체 조회)
     * @param pageable 페이징 정보
     * @return 페이징된 신고 내역 (DTO)
     */
    @Transactional(readOnly = true)
    public ReportPagingResponse getReports(String status, Pageable pageable) {
        Page<Report> reports;

        // status 파라미터가 있는지 확인
        if (StringUtils.hasText(status)) {
            // status 값이 있으면, 특정 상태의 신고만 조회
            reports = reportRepository.findByStatus(status, pageable);
        } else {
            // status 값이 없으면, 모든 신고 조회
            reports = reportRepository.findAll(pageable);
        }

        // Page<Report>를 Page<ReportListResponse>로 변환
        Page<ReportListResponse> reportResponses = reports.map(ReportListResponse::from);

        // 최종 포장지 DTO로 변환하여 반환
        return ReportPagingResponse.from(reportResponses);
    }

    /**
     * 차단('banned')된 회원 목록을 페이징하여 조회합니다.
     * @param pageable 페이징 정보
     * @return 페이징된 차단 회원 목록 (DTO)
     */
    @Transactional(readOnly = true)
    public BannedUserPagingResponse getBannedUsers(Pageable pageable) {
        // DB에서 status가 'banned'인 목록을 Page 객체로 가져옵니다.
        Page<UserStatus> bannedStatuses = userStatusRepository.findByStatus("banned", pageable);

        // Page<UserStatus>를 Page<BannedUserResponse>로 변환합니다. (JOIN 발생)
        Page<BannedUserResponse> bannedUserResponses = bannedStatuses.map(BannedUserResponse::from);

        // BannedUserPagingResponse DTO로 최종 변환하여 반환합니다.
        return BannedUserPagingResponse.from(bannedUserResponses);
    }

    /**
     * 특정 회원의 계정 상태를 변경(블랙리스트 등록/해제).
     * @param userId  대상 회원 ID
     * @param request 변경할 상태와 사유
     * @return 변경된 상태 정보 DTO
     */
    public StatusUpdateResponse updateUserStatus(Integer userId, StatusUpdateRequest request) {
        // 1. 요청받은 status가 'active' 또는 'banned'인지 확인
        if (!request.status().equals("active") && !request.status().equals("banned")) {
            throw new IllegalArgumentException("잘못된 상태 값입니다: " + request.status());
        }

        // 2. 대상 회원이 DB에 존재하는지 확인
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 회원을 찾을 수 없습니다. userId: " + userId));

        // 3. 이미 UserStatus에 정보가 있는지 확인
        UserStatus userStatus = userStatusRepository.findByUser_UserId(userId)
                .orElse(null); // 없으면 null

        if (userStatus == null) {
            // 1. 첫 제재인 경우: 'new UserStatus()' 대신 'of()' 팩토리 메소드 사용, 생성자가 protected로 묶여 있어 별도의 메서드 사용
            userStatus = UserStatus.of(user, request.status(), request.reason());
        } else {
            // 2. 이미 제재 기록이 있는 경우: 상태와 사유만 업데이트
            userStatus.setStatus(request.status());
            userStatus.setReason(request.reason());
        }
        // (updatedAt은 @PreUpdate 어노테이션으로 자동 갱신됨)

        // 5. DB에 저장 (새로 생성되거나, 변경된 내용이 업데이트됨)
        UserStatus savedStatus = userStatusRepository.save(userStatus);

        // 6. 결과 DTO를 반환
        return StatusUpdateResponse.from(savedStatus);
    }

    public ReportStatusUpdateResponse updateReportStatus (Integer reportId, ReportStatusUpdateRequest request) {
        // 1. 대상 신고 건이 DB에 존재하는지 확인
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new IllegalArgumentException("해당 신고 내역을 찾을 수 없습니다. reportId: " + reportId));

        // 2. 상태를 업데이트
        report.setStatus(request.status());

        // 3. DB에 저장 (변경 내용 반영)
        Report savedReport = reportRepository.save(report);

        // 4. 결과 DTO를 반환
        return ReportStatusUpdateResponse.from(savedReport);
    }


}