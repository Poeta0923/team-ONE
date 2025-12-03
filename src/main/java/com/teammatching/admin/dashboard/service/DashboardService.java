package com.teammatching.admin.dashboard.service;

import com.teammatching.admin.user.domain.Role;
import com.teammatching.admin.content.repository.MemberRepository;
import com.teammatching.admin.content.repository.ProjectRepository;
import com.teammatching.admin.dashboard.dto.DashboardResponse;
import com.teammatching.admin.dashboard.dto.DashboardResponse.AnnualStat;
import com.teammatching.admin.dashboard.dto.DashboardResponse.MonthlyStat;
import com.teammatching.admin.dashboard.dto.DashboardResponse.RecentProjectResponse;
import com.teammatching.admin.dashboard.dto.DashboardResponse.RecentUserResponse;
import com.teammatching.admin.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap; // HashMap 임포트 추가
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

    public DashboardResponse getDashboardSummary() {
        int currentYear = LocalDate.now().getYear();
        List<MonthlyStat> monthlyStats = calculateMonthlyStats(currentYear);
        List<AnnualStat> annualStats = calculateAnnualStats(currentYear - 1);
        List<RecentProjectResponse> recentProjects = projectRepository.findTop3ByOrderByDateDesc().stream()
                .map(RecentProjectResponse::from)
                .toList();
        List<RecentUserResponse> recentUsers = userRepository.findTop3ByRoleOrderByDateDesc(Role.USER).stream()
                .map(RecentUserResponse::from)
                .toList();
        return DashboardResponse.builder()
                .monthlyUserGrowth(monthlyStats)
                .annualUserGrowth(annualStats)
                .recentProjects(recentProjects)
                .recentUsers(recentUsers)
                .build();
    }


    private List<MonthlyStat> calculateMonthlyStats(int year) {
        // 1. 안전한 변환 헬퍼 함수 사용
        Map<Integer, Long> userCounts = convertToMap(userRepository.findMonthlyUserCounts(year));
        Map<Integer, Long> participantCounts = convertToMap(memberRepository.findMonthlyParticipantCounts(year));

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

    private Map<Integer, Long> convertToMap(List<Object[]> results) {
        Map<Integer, Long> map = new HashMap<>();
        if (results == null) return map;

        for (Object[] result : results) {
            try {
                // DB 드라이버에 따라 리턴 타입이 다를 수 있으므로 안전하게 변환
                int key = result[0] != null ? ((Number) result[0]).intValue() : 0;
                long value = result[1] != null ? ((Number) result[1]).longValue() : 0L;
                map.put(key, value);
            } catch (Exception e) {
                // 변환 실패 시 로그만 남기고 건너뜀 (전체 에러 방지)
                System.err.println("대시보드 데이터 변환 오류: " + e.getMessage());
            }
        }
        return map;
    }

    // (calculateAnnualStats 메소드는 기존과 동일하지만, 위 헬퍼 메소드를 쓰면 더 좋습니다)
    private List<AnnualStat> calculateAnnualStats(int startYear) {
        return userRepository.findAnnualUserCounts(startYear).stream()
                .map(result -> AnnualStat.builder()
                        .year(((Number) result[0]).intValue())
                        .totalUserCount(((Number) result[1]).longValue())
                        .build())
                .toList();
    }
}