package com.teammatching.admin.user.repository;

import com.teammatching.admin.user.domain.Role;
import com.teammatching.admin.user.domain.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Integer> {
    // 로그인 ID(String 타입)로 사용자를 찾기 위한 메소드
    Optional<User> findById(String id);

    // 테스트용 계정 생성을 위해 ID(String 타입) 존재 여부를 확인하는 메소드
    boolean existsById(String id);
    
    // Role을 기준으로 페이징하여 사용자만 찾아내게 하기 위한 메소드
    Page<User> findByRole(Role role, Pageable pageable);


    //가장 최근에 가입한 'USER' 3명을 조회(내림차순 기준)
    List<User> findTop10ByRoleOrderByDateDesc(Role role);

    // 특정 년도의 월별 'USER' 가입자 수를 집계
    @Query("SELECT MONTH(u.date) as month, COUNT(u.userId) as count " +
            "FROM User u " +
            "WHERE u.role = 'USER' AND YEAR(u.date) = :year " +
            "GROUP BY MONTH(u.date)")
    List<Object[]> findMonthlyUserCounts(@Param("year") int year);

    // 최근 2년간의 월별 'USER' 가입자 수를 집계
    @Query("SELECT YEAR(u.date) as year, COUNT(u.userId) as count " +
            "FROM User u " +
            "WHERE u.role = 'USER' AND YEAR(u.date) >= :startYear " +
            "GROUP BY YEAR(u.date) " +
            "ORDER BY year DESC")
    List<Object[]> findAnnualUserCounts(@Param("startYear") int startYear);
}
