package com.teammatching.admin.content.dto;

import org.springframework.data.domain.Page;

import java.util.List;
public record ContestPagingResponse(
        //공모전 목록
        List<ContestListResponse> contests,
        // 전체 페이지 수
        int totalPages,
        //전체 공모전 수
        long totalElements
) {
    public static ContestPagingResponse from(Page<ContestListResponse> page) {
        return new ContestPagingResponse(
                page.getContent(),
                page.getTotalPages(),
                page.getTotalElements()
        );
    }
}
