package com.teammatching.admin.content.domain;

import com.teammatching.admin.user.domain.User;
import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDateTime;
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "members")
@Entity
@IdClass(Member.MemberId.class)
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

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemberId implements Serializable {
        private Integer project;
        private Integer user;
    }
}
