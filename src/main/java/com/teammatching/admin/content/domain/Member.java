package com.teammatching.admin.content.domain;

import com.teammatching.admin.user.domain.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDateTime;
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "members")
@Entity
public class Member {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "projectId")
    private Project project;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member")
    private User user;

    @Column(nullable = false)
    private String role;

    @Column(nullable = false)
    private String state;

    @Column(nullable = false)
    private LocalDateTime date;

    // 복합 키를 위한 ID 클래스
    public static class MemberId implements Serializable {
        private Integer project;
        private Integer user;
    }
}
