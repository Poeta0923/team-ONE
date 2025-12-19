package com.teammatching.admin.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "관리자 로그인 요청 DTO")
public record LoginRequest(
        @Schema(description = "관리자 아이디", example = "admin")
        String id,
        @Schema(description = "관리자 비밀번호", example = "1234")
        String password) {
}
