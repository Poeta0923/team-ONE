package com.teammatching.admin.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import com.teammatching.admin.global.jwt.JwtAuthenticationFilter; // 임포트 추가
import lombok.RequiredArgsConstructor; // 임포트 추가
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
//CORS 관련 improt 추가
import static org.springframework.security.config.Customizer.withDefaults;
@RequiredArgsConstructor
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    // 1. 비밀번호 암호화를 위한 도구를 Bean으로 등록
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    private final JwtAuthenticationFilter jwtAuthenticationFilter; // '출입증 검사원' 주입받기

    // 2. 보안 규칙을 정의하는 메소드
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // 2-1. CSRF, Form Login, HTTP Basic 등 기본 보안 기능 비활성화
                .csrf(csrf -> csrf.disable())
                .formLogin(formLogin -> formLogin.disable())
                .httpBasic(httpBasic -> httpBasic.disable())

                // 2-2. 세션을 사용하지 않고, JWT(토큰) 방식을 사용하도록 설정
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                //  WebConfig.java의 CORS 설정을 사용하겠다는 의미
                .cors(withDefaults())

                // 2-3. URL 별 접근 권한 설정
                .authorizeHttpRequests(authz -> authz
                        // Swagger 관련 주소는 모두 허용
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        // '/admin/login' API는 누구나 접근할 수 있도록 허용
                        .requestMatchers("/admin/login").permitAll()
                        // 나머지 모든 '/admin/**' 경로는 인증된 사용자만 접근 가능
                        .requestMatchers("/admin/**").authenticated()
                        // 그 외 모든 요청은 일단 허용 (필요에 따라 수정)
                        .anyRequest().permitAll()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
