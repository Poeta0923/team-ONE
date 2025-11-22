package com.teammatching.admin.content.dto;

import org.springframework.data.domain.Page;

import java.util.List;

public record ProjectPagingResponse(
        List<ProjectListResponse> projects,
        int totalPages,
        long totalElements
) {
    public static ProjectPagingResponse from(Page<ProjectListResponse> page) {
        return new ProjectPagingResponse(
                page.getContent(),
                page.getTotalPages(),
                page.getTotalElements()
        );
    }
}
