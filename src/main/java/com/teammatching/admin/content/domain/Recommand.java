package com.teammatching.admin.content.domain;

import com.teammatching.admin.user.domain.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "recommand")
@Entity
@IdClass(Recommand.RecommandId.class)
public class Recommand {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer recommandId;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "projectId")
    private Project project;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member", referencedColumnName = "userId")
    private User user;

    @Column(nullable = false)
    private int score;

    // 복합 키를 위한 ID 클래스
    public static class RecommandId implements Serializable {
        private Integer recommandId;
        private Integer project;
        private Integer user;
    }
}
