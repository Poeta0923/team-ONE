package com.teammatching.admin.user.repository;

import com.teammatching.admin.user.domain.UserStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserStatusRepository extends JpaRepository<UserStatus, Integer>{
    // 'status' 값을 기준으로 페이징하여 조회하는 메소드
    Page<UserStatus> findByStatus(String status, Pageable pageable);

    /**
     * User의 고유 ID(userId)를 기준으로 UserStatus를 찾습니다.
     * (findByUser_UserId는 JPA가 User 객체 안의 userId 필드를 보고 자동으로 쿼리를 생성합니다)
     */
    Optional<UserStatus> findByUser_UserId(Integer userId);
}
