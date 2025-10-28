package com.teammatching.admin.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**") // 1. 우리 서버의 모든 API(/admin/** 등)에 대해

                // 2. 프론트엔드 주소
                .allowedOrigins(
                        "http://localhost:5173",  // React 개발 서버 주소
                        "http://ceprj.gachon.ac.kr:60002" // 학과 서버 주소
                )

                .allowedMethods("GET", "POST", "PUT", "DELETE") // 3. 허용할 HTTP 메소드
                .allowedHeaders("*") // 4. 모든 헤더 허용 (Authorization 헤더 포함)
                .allowCredentials(true) // 5. 쿠키/인증 헤더(토큰) 허용
                .maxAge(3600); // 6. pre-flight 요청 캐시 시간
    }
}
