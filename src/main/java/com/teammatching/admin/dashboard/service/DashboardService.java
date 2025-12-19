package com.teammatching.admin.dashboard.service;

import com.teammatching.admin.content.repository.MemberRepository;
import com.teammatching.admin.content.repository.ProjectRepository;
import com.teammatching.admin.dashboard.dto.DashboardResponse;
import com.teammatching.admin.dashboard.dto.DashboardResponse.AnnualStat;
import com.teammatching.admin.dashboard.dto.DashboardResponse.MonthlyStat;
import com.teammatching.admin.dashboard.dto.DashboardResponse.RecentProjectResponse;
import com.teammatching.admin.dashboard.dto.DashboardResponse.RecentUserResponse;
import com.teammatching.admin.user.domain.Role;
import com.teammatching.admin.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RequiredArgsConstructor
@Transactional(readOnly = true)
@Service
public class DashboardService {

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final MemberRepository memberRepository;


    //시스템의 주요 현황(통계 리스트, 최근 목록)을 요약하여 반환
    public DashboardResponse getDashboardSummary() {

        int currentYear = LocalDate.now().getYear();

        // 1. 월간 통계 리스트 계산 (가입자 + 참여자)
        List<MonthlyStat> monthlyStats = calculateMonthlyStats(currentYear);

        // 2. 연간 가입자 통계 리스트 계산 (최근 2년치)
        List<AnnualStat> annualStats = calculateAnnualStats(currentYear - 1);

        // 3. 최근 생성된 프로젝트 3개 조회 (DTO로 변환)
        List<RecentProjectResponse> recentProjects = projectRepository.findTop3ByOrderByDateDesc().stream()
                .map(RecentProjectResponse::from)
                .toList();

        // 4. 최근 가입한 회원 3명 조회 (DTO로 변환)
        List<RecentUserResponse> recentUsers = userRepository.findTop10ByRoleOrderByDateDesc(Role.USER).stream()
                .map(RecentUserResponse::from)
                .toList();

        // 5. 최종 DTO로 조합하여 반환
        return DashboardResponse.builder()
                .monthlyUserGrowth(monthlyStats)
                .annualUserGrowth(annualStats)
                .recentProjects(recentProjects)
                .recentUsers(recentUsers)
                .build();
    }

    //월간 가입자 및 참여자 누적 계산
    private List<MonthlyStat> calculateMonthlyStats(int year) {
        // 신규 가입자 수
        Map<Integer, Long> userCounts = userRepository.findMonthlyUserCounts(year).stream()
                .collect(Collectors.toMap(
                        result -> ((Number) result[0]).intValue(), // Key: 월(Month)
                        result -> ((Number) result[1]).longValue()  // Value: 가입자 수(Count)
                ));

        // 신규 프로젝트 참여자 수 맵
        Map<Integer, Long> participantCounts = memberRepository.findMonthlyParticipantCounts(year).stream()
                .collect(Collectors.toMap(
                        result -> ((Number) result[0]).intValue(), // Key: 월(Month)
                        result -> ((Number) result[1]).longValue()  // Value: 참여자 수(Count)
                ));

        // 3. 누적 계산
        List<MonthlyStat> results = new ArrayList<>();
        long cumulativeUserCount = 0;
        long cumulativeParticipantCount = 0;

        for (int month = 1; month <= 12; month++) {

            long newUserCount = userCounts.getOrDefault(month, 0L);
            long newParticipantCount = participantCounts.getOrDefault(month, 0L);

            cumulativeUserCount += newUserCount;
            cumulativeParticipantCount += newParticipantCount;

            results.add(MonthlyStat.builder()
                    .month(month)
                    .totalUserCount(cumulativeUserCount)
                    .projectParticipantCount(cumulativeParticipantCount)
                    .build());
        }

        return results;
    }

    // 연간 가입자 계산
    private List<AnnualStat> calculateAnnualStats(int startYear) {
        // startYear (작년) 부터 현재까지의 연도별 가입자 수 리스트
        return userRepository.findAnnualUserCounts(startYear).stream()
                .map(result -> AnnualStat.builder()
                        .year(((Number) result[0]).intValue())
                        .totalUserCount(((Number) result[1]).longValue())
                        .build())
                .toList();
    }
}
