package com.teammatching.admin.auth.service;

import com.teammatching.admin.auth.dto.LoginRequest;
import com.teammatching.admin.auth.dto.TokenResponse;
import com.teammatching.admin.global.jwt.TokenProvider;
import com.teammatching.admin.user.domain.Role;
import com.teammatching.admin.user.domain.User;
import com.teammatching.admin.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class AuthServiceTest {
    @InjectMocks // 테스트 대상이 되는 실제 객체, @Mock으로 만든 가짜 객체들이 주입
    private AuthService authService;

    @Mock // 가짜(Mock) 객체 1: DB에 접근하는 척만 함
    private UserRepository userRepository;

    @Mock // 가짜(Mock) 객체 2: 비밀번호를 비교하는 척만 함
    private PasswordEncoder passwordEncoder;

    @Mock // 가짜(Mock) 객체 3: 토큰을 생성하는 척만 함
    private TokenProvider tokenProvider;

    @Test
    @DisplayName("성공: 올바른 정보로 로그인 시 토큰이 정상적으로 발급된다.")
    void loginSuccessTest() {
        // Given: 이런 상황이 주어졌을 때 (가짜 객체들의 행동을 정의)
        LoginRequest request = new LoginRequest("admin", "password1234");
        User fakeAdmin = createFakeAdmin();

        // userRepository.findById("admin")이 호출되면, 가짜 admin 객체를 반환하도록 설정
        when(userRepository.findById(request.id())).thenReturn(Optional.of(fakeAdmin));
        // passwordEncoder.matches()가 호출되면, 무조건 true를 반환하도록 설정
        when(passwordEncoder.matches(request.password(), fakeAdmin.getPassword())).thenReturn(true);
        // tokenProvider.createToken()이 호출되면, "fake-jwt-token" 문자열을 반환하도록 설정
        when(tokenProvider.createToken(fakeAdmin.getId(), fakeAdmin.getRole().name())).thenReturn("fake-jwt-token");

        // When
        TokenResponse tokenResponse = authService.login(request);

        // Then
        assertNotNull(tokenResponse);
        assertEquals("fake-jwt-token", tokenResponse.accessToken());
    }

    @Test
    @DisplayName("실패: 존재하지 않는 아이디로 로그인 시 예외가 발생한다.")
    void loginFail_whenUserNotFound() {
        // Given: 존재하지 않는 아이디로 로그인 요청
        LoginRequest request = new LoginRequest("non-existent-user", "password1234");

        // userRepository.findById()가 호출되면, '결과 없음'을 반환하도록 설정
        when(userRepository.findById(request.id())).thenReturn(Optional.empty());

        // When & Then: authService.login()을 실행하면 IllegalArgumentException이 터지는지 검증
        assertThrows(IllegalArgumentException.class, () -> authService.login(request));
    }

    @Test
    @DisplayName("실패: 비밀번호가 틀렸을 경우 예외가 발생한다.")
    void loginFail_whenPasswordMismatch() {
        // Given: 비밀번호가 틀린 로그인 요청
        LoginRequest request = new LoginRequest("admin", "wrong-password");
        User fakeAdmin = createFakeAdmin();

        when(userRepository.findById(request.id())).thenReturn(Optional.of(fakeAdmin));
        // passwordEncoder.matches()가 호출되면, false를 반환하도록 설정
        when(passwordEncoder.matches(request.password(), fakeAdmin.getPassword())).thenReturn(false);

        // When & Then: authService.login()을 실행하면 예외가 발생하는지 검증
        assertThrows(IllegalArgumentException.class, () -> authService.login(request));
    }

    @Test
    @DisplayName("실패: 관리자(ADMIN) 권한이 없는 사용자가 로그인 시 예외가 발생한다.")
    void loginFail_whenNotAdminRole() {
        // Given: 권한이 'USER'인 가짜 사용자 생성
        LoginRequest request = new LoginRequest("user", "password1234");
        User fakeUser = createFakeAdmin(); // 재활용
        fakeUser.setRole(Role.USER); // 권한을 USER로 변경

        when(userRepository.findById(request.id())).thenReturn(Optional.of(fakeUser));
        when(passwordEncoder.matches(request.password(), fakeUser.getPassword())).thenReturn(true);

        // When & Then: authService.login()을 실행하면 예외가 발생하는지 검증
        assertThrows(IllegalArgumentException.class, () -> authService.login(request));
    }


    // 테스트용 가짜 관리자 객체를 만드는 헬퍼 메소드
    private User createFakeAdmin() {
        User admin = new User();
        admin.setId("admin");
        admin.setPassword("encryptedPassword"); // 암호화된 비밀번호라고 가정
        admin.setRole(Role.ADMIN);
        return admin;
    }
}
