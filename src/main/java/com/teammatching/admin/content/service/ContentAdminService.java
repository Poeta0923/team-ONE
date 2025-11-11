package com.teammatching.admin.content.service;

import com.teammatching.admin.content.domain.Contest;
import com.teammatching.admin.content.domain.Project;
import com.teammatching.admin.content.dto.*;
import com.teammatching.admin.content.repository.*;
import com.teammatching.admin.user.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@RequiredArgsConstructor
@Transactional
@Service
public class ContentAdminService {

    private final ProjectRepository projectRepository;
    private final ContestRepository contestRepository;
    private final MemberRepository memberRepository;
    private final LikeRepository likeRepository;
    private final RecommandRepository recommandRepository;

    /**
     * 전체 프로젝트 목록을 페이징하여 조회
     * @param statement 필터링할 상태 (null이면 전체 조회)
     * @param pageable 페이징 정보
     * @return 페이징된 프로젝트 목록 (DTO)
     */
    @Transactional(readOnly = true)
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
     * 전체 공모전 목록을 페이징하여 조회
     * @param pageable 페이징 정보
     * @return 페이징된 공모전 목록 (DTO)
     */
    @Transactional(readOnly = true)
    public ContestPagingResponse getContests(Pageable pageable) {

        Page<Contest> contests = contestRepository.findAll(pageable);
        // Page<Contest>를 Page<ContestListResponse>로 변환
        Page<ContestListResponse> contestResponses = contests.map(ContestListResponse::from);
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
        // 프로젝트 존재 여부 확인
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 프로젝트입니다. ID: " + projectId));

        likeRepository.deleteAllByProjectProjectId(projectId);
        recommandRepository.deleteAllByProjectProjectId(projectId);
        memberRepository.deleteAllByProjectProjectId(projectId);

        projectRepository.flush();
        // 프로젝트 삭제
        projectRepository.delete(project);
    }

    /**
     * 특정 공모전을 삭제
     * @param contestId 삭제할 프로젝트 ID
     */
    public void deleteContest(Integer contestId) {
        // 프로젝트가 해당 공모전을 사용하는지 확인
        if(projectRepository.existsByContest_ContestId(contestId)) {
            throw new IllegalStateException("해당 공모전을 사용중인 프로젝트가 있어 삭제할 수 없습니다.");
        }
        // 공모전 여부 확인
        Contest contest = contestRepository.findById(contestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 공모전입니다. ID : " + contestId));

        // 공모전 내용 삭제
        contestRepository.delete(contest);
    }
}
