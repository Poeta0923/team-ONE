package com.teammatching.admin.content.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
@Setter
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "projects")
@Entity
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer projectId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String type;

    //contests 테이블과 매핑
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contestId")
    private Contest contest; // contestId 대신 Contest 객체를 참조

    //프로젝트 분야
    @Column(nullable = false)
    private String category;

    //DB의 tech_statck 필드와 매핑, 카멜케이스 기법에 맞추기 위해 필드명 변경
    @Column(name = "tech_stack", nullable = false)
    private String techStack;

    //모집 인원
    @Column(nullable = false)
    private int recruitment;

    //프로젝트 설명
    @Column(nullable = false)
    private String description;

    //프로젝트 진행 상태
    @Column(nullable = false)
    private String statement;

    //프로젝트 생성 날짜
    @Column(nullable = false)
    private LocalDateTime date;

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Member> members = new ArrayList<>();

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Like> likes = new ArrayList<>();

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Recommand> recommands = new ArrayList<>();
}
