package com.teammatching.admin.auth.controller;

import com.teammatching.admin.auth.dto.LoginApiResponse;
import com.teammatching.admin.auth.dto.LoginRequest;
import com.teammatching.admin.auth.dto.TokenResponse;
import com.teammatching.admin.auth.service.AuthService;
import com.teammatching.admin.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "1. 관리자 인증 API", description = "로그인/로그아웃 API")
@RequiredArgsConstructor
//@RequestMapping("/admin")
@RestController
public class AuthController {

    private final AuthService authService;

    // 로그인 API
    @Operation(summary = "관리자 로그인", description = "아이디와 비밀번호로 로그인하여 JWT 토큰을 발급받습니다.")
    @ApiResponses(value = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "로그인 성공",
                    content = @Content(schema = @Schema(implementation = LoginApiResponse.class))
            ),
            //  에러1 '인증 실패' 케이스
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", description = "인증 실패 (아이디 또는 비밀번호 불일치)",
                    content = @Content(schema = @Schema(implementation = Void.class))
            ),
            //  에러2 '권한 없음' 케이스
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", description = "권한 없음 (관리자 계정이 아님)",
                    content = @Content(schema = @Schema(implementation = Void.class))
            )
    })
    @PostMapping("/login")
    public ApiResponse<TokenResponse> login(@RequestBody LoginRequest request) {
        TokenResponse token = authService.login(request);
        return ApiResponse.success("로그인 성공", token);
    }

    // 로그아웃 API
    @Operation(summary = "관리자 로그아웃", description = "현재 로그인된 관리자를 로그아웃 처리합니다. (Authorization 헤더에 토큰 필요)")
    @PostMapping("/admin/logout")
    public ApiResponse<Void> logout() {
        // Request Header에서 토큰을 꺼내와서 AuthService.logout()에 전달
        authService.logout(null);
        return ApiResponse.success("로그아웃 성공", null);
    }

}
