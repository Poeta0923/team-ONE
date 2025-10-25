package com.teammatching.admin.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.Page;

import java.util.List;
public record BannedUserPagingResponse(
        @Schema(description = "차단된 회원 목록")
        List<BannedUserResponse> users, // API 명세서와 이름을 맞추기 위해 'users'로 설정

        @Schema(description = "전체 페이지 수", example = "1")
        int totalPages,

        @Schema(description = "전체 차단된 회원 수", example = "3")
        long totalElements
) {
    public static BannedUserPagingResponse from(Page<BannedUserResponse> page) {
        return new BannedUserPagingResponse(
                page.getContent(),
                page.getTotalPages(),
                page.getTotalElements()
        );
    }
}
