package com.teammatching.admin.user.repository;

import com.teammatching.admin.user.domain.Report;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportRepository extends JpaRepository<Report, Integer> {
    // 처리 상태(status)를 기준으로 신고 내역을 페이징하여 찾는 메소드
    Page<Report> findByStatus(String status, Pageable pageable);

}