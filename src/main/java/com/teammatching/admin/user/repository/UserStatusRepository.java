package com.teammatching.admin.user.repository;

import com.teammatching.admin.user.domain.UserStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
public interface UserStatusRepository extends JpaRepository<UserStatus, Integer>{
    // 'status' 값을 기준으로 페이징하여 조회하는 메소드
    Page<UserStatus> findByStatus(String status, Pageable pageable);
}
