package com.teammatching.admin.content.repository;

import com.teammatching.admin.content.domain.Recommand;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RecommandRepository extends JpaRepository<Recommand, Recommand.RecommandId> {
    // projectId를 기준으로 관련된 모든 Recommand(추천) 데이터를 삭제
    @Modifying
    @Query("DELETE FROM Recommand r WHERE r.project.projectId = :projectId")
    void deleteAllByProjectProjectId(Integer projectId);
}
