package com.teammatching.admin.global.jwt;


import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.stereotype.Component;
import java.security.Key;
import java.util.Date;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import java.util.Collections;
@Component
public class TokenProvider {

    private final Key key;

    // application.yml에 설정한 비밀 키(jwt.secret)를 가져와서 초기화합니다.
    public TokenProvider(@Value("${jwt.secret}") String secretKey) {
        byte[] keyBytes = secretKey.getBytes();
        this.key = Keys.hmacShaKeyFor(keyBytes);
    }

    // 1. 로그인 성공 시 토큰을 생성하는 메소드
    public String createToken(String adminId, String role) {
        long now = (new Date()).getTime();
        long accessTokenValidityInMilliseconds = 1000 * 60 * 60; // 1시간 유효

        return Jwts.builder()
                .setSubject(adminId) // 토큰의 주인 (관리자 ID)
                .claim("role", role) // 토큰에 담을 정보 (권한)
                .setIssuedAt(new Date(now)) // 토큰 발행 시간
                .setExpiration(new Date(now + accessTokenValidityInMilliseconds)) // 토큰 만료 시간
                .signWith(key, SignatureAlgorithm.HS256) // 사용할 암호화 알고리즘과 비밀 키
                .compact();
    }

    // 2. API 요청 시 헤더에 담긴 토큰이 유효한지 검증하는 메소드
    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
            return true; // 유효하면 true
        } catch (Exception e) {
            // 유효하지 않으면 (만료, 변조 등) false
            return false;
        }
    }

    // 3. 토큰에서 관리자 ID(Subject)를 추출하는 메소드
    public String getAdminIdFromToken(String token) {
        Claims claims = Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();
        return claims.getSubject();
    }

    public Authentication getAuthentication(String token) {
        Claims claims = Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();
        String adminId = claims.getSubject();
        String role = claims.get("role", String.class);

        // 권한 정보를 Spring Security가 이해할 수 있는 형태로 변환
        SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + role);

        // 인증된 사용자 정보를 담은 Authentication 객체 생성
        return new UsernamePasswordAuthenticationToken(adminId, null, Collections.singletonList(authority));
    }
}
