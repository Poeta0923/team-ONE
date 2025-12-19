package com.teammatching.admin.content.repository;

import com.teammatching.admin.content.domain.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MemberRepository extends JpaRepository<Member, Integer> {
    @Modifying(clearAutomatically = true)
    //@Query("DELETE FROM Member m WHERE m.project.projectId = :projectId")
    void deleteAllByProjectProjectId(@Param("projectId") Integer projectId);

    @Query("SELECT MONTH(m.date) as month, COUNT(DISTINCT m.user.userId) as count " +
            "FROM Member m " +
            "WHERE YEAR(m.date) = :year AND m.state = '참여' " +
            "GROUP BY MONTH(m.date)")
    List<Object[]> findMonthlyParticipantCounts(@Param("year") int year);
}
