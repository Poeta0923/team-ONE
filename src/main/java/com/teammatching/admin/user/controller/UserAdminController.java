package com.teammatching.admin.user.controller;

import com.teammatching.admin.global.response.ApiResponse;
import com.teammatching.admin.user.dto.BannedUserPagingResponse;
import com.teammatching.admin.user.dto.BannedUserResponse;
import com.teammatching.admin.user.dto.UserPagingResponse;
import com.teammatching.admin.user.dto.ReportPagingResponse;
import com.teammatching.admin.user.service.UserAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "3. 회원 목록 조회 API", description = "관리자용 회원 목록 조회 기능을 제공하는 API")
@RequiredArgsConstructor
@RequestMapping("/admin")
@RestController
public class UserAdminController {
    private final UserAdminService userAdminService;

    @Operation(summary = "전체 회원 목록 조회", description = "시스템에 등록된 모든 회원의 목록을 페이징하여 조회합니다.")
    @ApiResponses(value = {
            // (Swagger 문서용) 성공 시 응답 예시를 Page<UserListResponse>로 설정할 수 있습니다.
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "회원 목록 조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "인증 실패"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "권한 없음")
    })
    @SecurityRequirement(name = "jwtAuth") // 이 API는 JWT 인증이 필요함을 Swagger에 알림
    @GetMapping("/users")
    public ApiResponse<UserPagingResponse> getUsers(@PageableDefault(size = 10, sort = "userId") Pageable pageable) {
        UserPagingResponse users = userAdminService.getUsers(pageable);
        return ApiResponse.success("회원 목록 조회 성공", users);
    }

    @Operation(summary = "전체 신고 내역 조회", description = "접수된 모든 신고 내역을 페이징하여 조회합니다.")
    @ApiResponses(value = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "신고 내역 조회 성공")
    })
    @SecurityRequirement(name = "jwtAuth")
    @GetMapping("/reports") // API 주소: GET /admin/reports
    public ApiResponse<ReportPagingResponse> getReports(
            @Parameter(description = "처리 상태 (pending 또는 resolved)")
            @RequestParam(required = false) String status, // 'status' 파라미터 받기
            @PageableDefault(size = 10, sort = "reportId") Pageable pageable
    ) {
        ReportPagingResponse reports = userAdminService.getReports(status, pageable);
        return ApiResponse.success("신고 내역 조회 성공", reports);
    }

    /**
     * 차단된 회원 목록 조회 API
     * GET /admin/banned-users
     */
    @Operation(summary = "차단된 회원 목록 조회", description = "현재 'banned' 상태인 모든 회원의 목록을 페이징하여 조회합니다.")
    @ApiResponses(value = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "차단된 회원 목록 조회 성공")
    })
    @SecurityRequirement(name = "jwtAuth")
    @GetMapping("/banned-users") // API 주소 : Get admin/banned-users
    public ApiResponse<BannedUserPagingResponse> getBannedUsers(
            @Parameter(description = "페이지 번호 (0부터 시작)", example = "0")
            @PageableDefault(size = 10, sort = "statusId") Pageable pageable
    ) {
        BannedUserPagingResponse bannedUsers = userAdminService.getBannedUsers(pageable);
        return ApiResponse.success("차단된 회원 목록 조회 성공", bannedUsers);
    }
}
