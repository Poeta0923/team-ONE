package com.teammatching.admin.user.repository;

import com.teammatching.admin.user.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Integer> {
    // 1. 로그인 ID(String 타입)로 사용자를 찾기 위한 메소드
    Optional<User> findById(String id);

    // 2. 테스트용 계정 생성을 위해 ID(String 타입) 존재 여부를 확인하는 메소드
    boolean existsById(String id);
}
