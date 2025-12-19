package com.teammatching.admin;

import com.teammatching.admin.user.domain.Role;
import com.teammatching.admin.user.domain.User;
import com.teammatching.admin.user.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.time.LocalDateTime;

@SpringBootApplication
public class AdminServerApplication {


	public static void main(String[] args) {
		SpringApplication.run(AdminServerApplication.class, args);
	}
	@Bean
	public CommandLineRunner initData(UserRepository userRepository, PasswordEncoder passwordEncoder) {
		return args -> {
			if (!userRepository.existsById("admin")) {
				User admin = new User();
				admin.setId("admin");
				admin.setPassword(passwordEncoder.encode("1234"));
				admin.setRole(Role.ADMIN);

				// 👇👇👇 아래 필수 값들이 모두 있는지 확인!
				admin.setName("최고관리자");
				admin.setBirth(LocalDate.of(1990, 1, 1));
				admin.setPhoneNumber("010-0000-0000");
				admin.setNickName("Admin");
				admin.setJob("Administrator");
				admin.setDate(LocalDateTime.now());

				userRepository.save(admin); // <-- 모든 값 설정 후에 저장!
				System.out.println("✅ 테스트용 관리자 계정이 생성되었습니다: admin");
			}
		};
	}
	}

