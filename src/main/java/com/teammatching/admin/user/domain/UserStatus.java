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
@Table(name = "userStatus")
@Entity
public class UserStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer statusId;

    // User와 1:1 관계 설정
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "userId", nullable = false)
    private User user;

    @Column(nullable = false)
    private String status;

    private String reason;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    // 생성 또는 업데이트 시 자동으로 날짜를 설정
    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    /**
     *'새로운' UserStatus 객체를 안전하게 생성하기 위한
     * 정적 팩토리 메소드
     */
    public static UserStatus of(User user, String status, String reason) {
        UserStatus userStatus = new UserStatus();
        userStatus.setUser(user);
        userStatus.setStatus(status);
        userStatus.setReason(reason);
        return userStatus;
    }
}
