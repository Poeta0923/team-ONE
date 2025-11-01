package com.teammatching.admin.content.service;

import com.teammatching.admin.content.domain.Project;
import com.teammatching.admin.content.dto.ProjectListResponse;
import com.teammatching.admin.content.dto.ProjectPagingResponse;
import com.teammatching.admin.content.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@RequiredArgsConstructor
@Transactional(readOnly = true)
@Service
public class ContentAdminService {

    private final ProjectRepository projectRepository;

    /**
     * 전체 프로젝트 목록을 페이징하여 조회
     * @param statement 필터링할 상태 (null이면 전체 조회)
     * @param pageable 페이징 정보
     * @return 페이징된 프로젝트 목록 (DTO)
     */
    public ProjectPagingResponse getProjects(String statement, Pageable pageable) {
        Page<Project> projects;

        // 1. statement 파라미터가 있는지 확인
        if (StringUtils.hasText(statement)) {
            // status 값이 있으면, 특정 상태의 프로젝트만 조회
            projects = projectRepository.findByStatement(statement, pageable);
        } else {
            // status 값이 없으면, 모든 프로젝트 조회
            projects = projectRepository.findAll(pageable);
        }

        // 2. Page<Project>를 Page<ProjectListResponse>로 변환
        Page<ProjectListResponse> projectResponses = projects.map(ProjectListResponse::from);

        // 3. 최종 포장지 DTO로 변환하여 반환
        return ProjectPagingResponse.from(projectResponses);
    }
}
