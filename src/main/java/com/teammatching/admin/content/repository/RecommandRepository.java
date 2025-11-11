package com.teammatching.admin.content.repository;

import com.teammatching.admin.content.domain.Recommand;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface RecommandRepository extends JpaRepository<Recommand, Recommand.RecommandId> {
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM Recommand r WHERE r.project.projectId = :projectId")
    void deleteAllByProjectProjectId(@Param("projectId") Integer projectId);
}
