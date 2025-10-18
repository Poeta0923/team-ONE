package com.teammatching.admin.auth.controller;

import com.teammatching.admin.auth.dto.LoginRequest;
import com.teammatching.admin.auth.dto.TokenResponse;
import com.teammatching.admin.auth.service.AuthService;
import com.teammatching.admin.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RequiredArgsConstructor
@RequestMapping("/admin")
@RestController
public class AuthController {

    private final AuthService authService;

    // 로그인 API
    @PostMapping("/login")
    public ApiResponse<TokenResponse> login(@RequestBody LoginRequest request) {
        TokenResponse token = authService.login(request);
        return ApiResponse.success("로그인 성공", token);
    }

    // 로그아웃 API
    @PostMapping("/logout")
    public ApiResponse<Void> logout() {
        // TODO: Request Header에서 토큰을 꺼내와서 AuthService.logout()에 전달
        authService.logout(null);
        return ApiResponse.success("로그아웃 성공", null);
    }

}
