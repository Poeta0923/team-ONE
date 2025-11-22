package com.teammatching.admin.user.dto;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.Page;

import java.util.List;

@Schema(description = "신고 내역 페이징 응답 DTO")
public record ReportPagingResponse(
        @Schema(description = "신고 목록")
        List<ReportListResponse> reports,

        @Schema(description = "전체 페이지 수", example = "3")
        int totalPages,

        @Schema(description = "전체 신고 건수", example = "25")
        long totalElements
) {
    public static ReportPagingResponse from(Page<ReportListResponse> page) {
        return new ReportPagingResponse(
                page.getContent(),
                page.getTotalPages(),
                page.getTotalElements()
        );
    }
}
