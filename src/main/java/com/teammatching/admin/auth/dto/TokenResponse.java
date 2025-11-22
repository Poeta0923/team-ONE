package com.teammatching.admin.auth.dto;
import io.swagger.v3.oas.annotations.media.Schema;
@Schema(description = "로그인 성공 시 발급되는 토큰 정보")
public record TokenResponse(
        @Schema(description = "API 접근 인증에 사용되는 토큰", example = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc2MDc4MjQwMCwiZXhwIjoxNzYwNz...")
        String accessToken,

        @Schema(description = "AccessToken 재발급에 사용되는 토큰", example = "dGhpcyBpcyBhIHNhbXBsZSByZWZyZXNoIHRva2VuLi4u")
        String refreshToken) {
}
