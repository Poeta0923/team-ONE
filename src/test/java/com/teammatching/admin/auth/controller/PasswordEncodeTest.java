package com.teammatching.admin.auth.controller;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

public class PasswordEncodeTest {

    @Test
    void encodePassword() {
        PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
        // 암호화하고 싶은 비밀번호 입력
        String encodedPassword = passwordEncoder.encode("1234");
        System.out.println("암호화된 비밀번호: " + encodedPassword);
    }
}
