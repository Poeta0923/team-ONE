package com.teammatching.admin.content.service;

import com.teammatching.admin.content.domain.Contest;
import com.teammatching.admin.content.domain.Project;
import com.teammatching.admin.content.dto.*;
import com.teammatching.admin.content.repository.ContestRepository;
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
    private final ContestRepository contestRepository;
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

    /**
     * 전체 공모전 목록을 페이징하여 조회합니다.
     * @param pageable 페이징 정보
     * @return 페이징된 공모전 목록 (DTO)
     */
    public ContestPagingResponse getContests(Pageable pageable) {
        // 1. DB에서 Contest 목록을 Page 객체로 가져옵니다.
        Page<Contest> contests = contestRepository.findAll(pageable);

        // 2. Page<Contest>를 Page<ContestListResponse>로 변환합니다.
        Page<ContestListResponse> contestResponses = contests.map(ContestListResponse::from);

        // 3. 최종 포장지 DTO로 변환하여 반환합니다.
        return ContestPagingResponse.from(contestResponses);
    }

    //공모전을 추가하여 저장
    public ContestListResponse createContest (ContestCreateRequest request) {
        // DTO의 name으로 Contest 엔티티 생성
        Contest newContest = Contest.of(request.name());
        Contest savedContest = contestRepository.save(newContest);
        // 저장된 엔티티를 DTO로 변환하여 반환
        return ContestListResponse.from(savedContest);
    }

    /**
     * 특정 프로젝트와, 관련된 모든 '자식' 데이터(팀원, 좋아요, 추천)를 함께 삭제
     * @param projectId 삭제할 프로젝트 ID
     */
    public void deleteProject(Integer projectId) {
        // 프로젝트가 여부 확인
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 프로젝트입니다. ID: " + projectId));

        // 관련된 '자식' 데이터를 모두 삭제 (순서는 상관없음)
        memberRepository.deleteAllByProjectProjectId(projectId);
        likeRepository.deleteAllByProjectProjectId(projectId);
        recommandRepository.deleteAllByProjectProjectId(projectId);
        reportRepository.deleteAllByProjectProjectId(projectId); // 🚨 ReportRepository 사용

        // 3. 모든 '자식'이 삭제된 것을 확인 후, '부모'인 프로젝트를 최종 삭제
        projectRepository.delete(project);
    }
}
