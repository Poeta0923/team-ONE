package com.teammatching.admin.content.repository;

import com.teammatching.admin.content.domain.Contest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

public interface ContestRepository extends JpaRepository<Contest, Integer> {
}
