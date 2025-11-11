package com.teammatching.admin.user.dto;

import com.teammatching.admin.user.domain.Report;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
public record ReportListResponse(
        @Schema(description = "신고 고유번호", example = "1")
        Integer reportId,

        @Schema(description = "신고한 사용자 이름", example = "홍길동")
        String reporterName,

        @Schema(description = "신고된 사용자 이름", example = "김철수")
        String reportedName,

        // 신고된 사용자의 고유 ID
        Integer reportedUserId,
        // 신고된 사용자의 계정 차단 여부
        String reportedUserStatus,
        @Schema(description = "신고 사유", example = "프로젝트 잠수")
        String reason,

        @Schema(description = "신고 날짜")
        LocalDateTime createdAt,

        @Schema(description = "처리 상태", example = "pending")
        String status
) {
    /**
     * Report 엔티티를 ReportListResponse DTO로 변환하는 정적 팩토리 메소드
     */
    public static ReportListResponse from(Report report, String reportedUserStatus) {
        return new ReportListResponse(

                report.getReportId(),
                report.getReporter().getName(), // 신고한 사람의 이름
                report.getReported().getName(), // 신고된 사람의 이름
                report.getReported().getUserId(),
                reportedUserStatus,
                report.getReason(),
                report.getCreatedAt(),
                report.getStatus()
        );
    }
}
