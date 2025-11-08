package com.teammatching.admin.content.repository;

import com.teammatching.admin.content.domain.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface MemberRepository extends JpaRepository<Member, Member.MemberId> {
    // projectId를 기준으로 관련된 모든 Member(팀원) 데이터를 삭제
    @Modifying
    @Query("DELETE FROM Member m WHERE m.project.projectId = :projectId")
    void deleteAllByProjectProjectId(Integer projectId);
}
