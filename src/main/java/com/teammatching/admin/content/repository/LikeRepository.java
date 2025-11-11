package com.teammatching.admin.content.repository;

import com.teammatching.admin.content.domain.Like;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface LikeRepository extends JpaRepository<Like, Integer> {
    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM Like l WHERE l.project.projectId = :projectId")
    void deleteAllByProjectProjectId(@Param("projectId") Integer projectId);
}
