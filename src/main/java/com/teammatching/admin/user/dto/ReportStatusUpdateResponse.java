package com.teammatching.admin.user.dto;

import com.teammatching.admin.user.domain.Report;

//특정 신고 처리 변경 완료 응답 DTO
public record ReportStatusUpdateResponse(
        //신고 처리된 신고 고유 번호, 변경 완료된 상태
        Integer reportId,
        String status
) {
    /**
     * Report 엔티티를 ReportStatusUpdateResponse DTO로 변환
     */
    public static ReportStatusUpdateResponse from(Report report) {
        return new ReportStatusUpdateResponse(
                report.getReportId(),
                report.getStatus()
        );
    }
}
