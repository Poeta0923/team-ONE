package com.teammatching.admin.content.controller;

import com.teammatching.admin.content.dto.ContestCreateRequest;
import com.teammatching.admin.content.dto.ContestListResponse;
import com.teammatching.admin.content.dto.ContestPagingResponse;
import com.teammatching.admin.content.dto.ProjectPagingResponse;
import com.teammatching.admin.content.service.ContentAdminService;
import com.teammatching.admin.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;

@Tag(name = "4. 콘텐츠 관리 API", description = "관리자용 콘텐츠(프로젝트/공모전) 관리 API")
@RequiredArgsConstructor
@RequestMapping("/admin")
@RestController
public class ContentAdminController {

    private final ContentAdminService contentAdminService;

    @Operation(summary = "전체 프로젝트 목록 조회", description = "시스템에 등록된 모든 프로젝트 목록을 페이징하여 조회합니다.")
    @SecurityRequirement(name = "jwtAuth")
    @GetMapping("/projects")
    public ApiResponse<ProjectPagingResponse> getProjects(
            @Parameter(description = "프로젝트 상태 (예: 진행중, 완료)")
            @RequestParam(required = false) String statement,
            @PageableDefault(size = 10, sort = "projectId") Pageable pageable
    ) {
        ProjectPagingResponse projects = contentAdminService.getProjects(statement, pageable);
        return ApiResponse.success("프로젝트 목록 조회 성공", projects);
    }

    @GetMapping("/contests")
    public ApiResponse<ContestPagingResponse> getContests(
            @PageableDefault(size = 10, sort = "contestId") Pageable pageable
    ) {
        ContestPagingResponse contests = contentAdminService.getContests(pageable);
        return ApiResponse.success("공모전 목록 조회 성공", contests);
    }

    @PostMapping("/contests")
    public ApiResponse<ContestListResponse> createContests(
        @RequestBody @Valid ContestCreateRequest request
    ) {
        ContestListResponse createdContest = contentAdminService.createContest(request);
        return ApiResponse.success("공모전이 성공적으로 등록되었습니다.", createdContest);
    }
}
