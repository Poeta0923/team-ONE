package com.teammatching.admin.content.repository;

import com.teammatching.admin.content.domain.Like;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface LikeRepository extends JpaRepository<Like, Integer> {
    // projectId를 기준으로 관련된 모든 Like(좋아요) 데이터를 삭제
    @Modifying
    @Query("DELETE FROM Like l WHERE l.project.projectId = :projectId")
    void deleteAllByProjectProjectId(Integer projectId);
}
