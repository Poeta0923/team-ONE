package com.teammatching.admin.user.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "reports")
@Entity
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer reportId;

    // '신고한 사람' (User 테이블과 연결)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporterId", nullable = false)
    private User reporter; // reporterId 대신 User 객체를 참조

    // '신고된 사람' (User 테이블과 연결)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reportedId", nullable = false)
    private User reported; // reportedId 대신 User 객체를 참조

    @Column(nullable = false)
    private String reason;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false, updatable = false) // 한번 생성되면 변경되지 않도록 설정
    private LocalDateTime createdAt;

    // 생성 시 자동으로 날짜를 설정하는 헬퍼 메소드
    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
