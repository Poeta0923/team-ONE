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
@Transactional(readOnly = true) // 조회 기능은 readOnly = true로 설정하면 성능에 유리
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
    public UserPagingResponse getUsers(Pageable pageable) {
        // Role이 'USER'인 회원 목록만 Page 객체로 가져옴
        Page<User> users = userRepository.findByRole(Role.USER, pageable);
        Page<UserListResponse> userResponses = users.map(UserListResponse::from);

        return UserPagingResponse.from(userResponses);
    }

    /**
     * 전체 신고 내역을 페이징하여 조회
     * @param status 필터링할 상태 (null이면 전체 조회)
     * @param pageable 페이징 정보
     * @return 페이징된 신고 내역 (DTO)
     */
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
    public BannedUserPagingResponse getBannedUsers(Pageable pageable) {
        // DB에서 status가 'banned'인 목록을 Page 객체로 가져옵니다.
        Page<UserStatus> bannedStatuses = userStatusRepository.findByStatus("banned", pageable);

        // Page<UserStatus>를 Page<BannedUserResponse>로 변환합니다. (JOIN 발생)
        Page<BannedUserResponse> bannedUserResponses = bannedStatuses.map(BannedUserResponse::from);

        // BannedUserPagingResponse DTO로 최종 변환하여 반환합니다.
        return BannedUserPagingResponse.from(bannedUserResponses);
    }
}
