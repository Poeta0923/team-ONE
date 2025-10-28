package com.teammatching.admin.auth.service;

import com.teammatching.admin.auth.dto.LoginRequest;
import com.teammatching.admin.auth.dto.TokenResponse;
import com.teammatching.admin.global.jwt.TokenProvider;
import com.teammatching.admin.user.domain.Role;
import com.teammatching.admin.user.domain.User;
import com.teammatching.admin.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@RequiredArgsConstructor
@Service
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenProvider tokenProvider;

    public TokenResponse login(LoginRequest request) {
        // 1. 아이디로 관리자(User)를 찾음, 없으면 예외 발생.
        User admin = userRepository.findById(request.id())
                .orElseThrow(() -> new IllegalArgumentException("아이디 또는 비밀번호가 일치하지 않습니다."));

        // 2. 비밀번호가 일치하는지 검증, 틀리면 예외 발생.
        if (!passwordEncoder.matches(request.password(), admin.getPassword())) {
            throw new IllegalArgumentException("아이디 또는 비밀번호가 일치하지 않습니다.");
        }

        // 3. 관리자(ADMIN) 권한이 있는지 확인
        if (admin.getRole() != Role.ADMIN) {
            throw new IllegalArgumentException("관리자 권한이 없습니다.");
        }

        // 4. 모든 검증 통과 시, 토큰을 생성한다.
        String accessToken = tokenProvider.createToken(admin.getId(), admin.getRole().name());
        // TODO: Refresh Token 생성 로직 추가
        String refreshToken = accessToken;

        return new TokenResponse(accessToken, refreshToken);
    }

    public void logout(String accessToken) {
        // TODO: 로그아웃된 토큰을 Redis 같은 곳에 저장하여 재사용을 막는 로직 추가
        System.out.println("Logout token: " + accessToken);
    }
}
