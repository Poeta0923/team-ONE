package com.teammatching.admin.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.Page;

import java.util.List;
public record UserPagingResponse(
        @Schema(description = "회원 목록")
        List<UserListResponse> users, // 👈 'content' 대신 'users'라는 이름 사용

        @Schema(description = "전체 페이지 수", example = "5")
        int totalPages,

        @Schema(description = "전체 회원 수", example = "50")
        long totalElements
) {
    /**
     * Spring의 Page 객체를 설계서 DTO로 변환하는 정적 팩토리 메소드
     */
    public static UserPagingResponse from(Page<UserListResponse> page) {
        return new UserPagingResponse(
                page.getContent(),      // Page 객체에서 실제 목록을 가져옴
                page.getTotalPages(),   // Page 객체에서 전체 페이지 수를 가져옴
                page.getTotalElements() // Page 객체에서 전체 요소 수를 가져옴
        );
    }
}
