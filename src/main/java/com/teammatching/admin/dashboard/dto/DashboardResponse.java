package com.teammatching.admin.dashboard.dto;

import com.teammatching.admin.content.domain.Project;
import com.teammatching.admin.user.domain.User;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.List;

@Builder
public record DashboardResponse (

        List<MonthlyStat> monthlyUserGrowth,
        List<AnnualStat> annualUserGrowth,
        List<RecentProjectResponse> recentProjects,
        List<RecentUserResponse> recentUsers
) {

    @Builder
    public record MonthlyStat(

            int month,
            long totalUserCount,
            long projectParticipantCount
    ) {}

    @Builder
    public record AnnualStat(
            int year,
            long totalUserCount
    ) {}

    public record RecentUserResponse(

            Integer userId,
            String name,
            LocalDateTime date
    ) {

        public static RecentUserResponse from(User user) {
            return new RecentUserResponse(
                    user.getUserId(),
                    user.getName(),
                    user.getDate()
            );
        }
    }

    public record RecentProjectResponse(
            Integer projectId,
            String name,
            String statement
    ) {
        public static RecentProjectResponse from(Project project) {
            return new RecentProjectResponse(
                    project.getProjectId(),
                    project.getName(),
                    project.getStatement()
            );
        }
    }
}
