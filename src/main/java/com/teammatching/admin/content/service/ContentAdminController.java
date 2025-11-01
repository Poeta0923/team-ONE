package com.teammatching.admin.content.service;

import com.teammatching.admin.content.dto.ProjectPagingResponse;
import com.teammatching.admin.content.service.ContentAdminService;
import com.teammatching.admin.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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
}
