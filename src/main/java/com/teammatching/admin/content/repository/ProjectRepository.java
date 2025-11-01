package com.teammatching.admin.content.repository;

import com.teammatching.admin.content.domain.Project;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project,Integer> {

    // 'statement' (진행중, 완료 등)를 기준으로 페이징하여 찾는 메소드
    Page<Project> findByStatement(String statement, Pageable pageable);
}
