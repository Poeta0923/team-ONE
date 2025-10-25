package com.teammatching.admin.user.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Table(name = "resumes")
@Entity
@NoArgsConstructor(access = AccessLevel.PROTECTED) //JPA용 빈생성자 생성
public class Resume {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer resumeId; // 이력서 고유 번호

    // 1:1 관계 설정
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "userId", nullable = false)
    private User user; // users 테이블의 사용자 고유 번호

    @Column(nullable = false)
    private String address; // 사용자 주소

    @Column(nullable = false)
    private String mbti; // 사용자 mbti

    @Column(nullable = false)
    private String workStyle; // 선호 업무 방식

    @Column(nullable = false)
    private String workTime; // 선호 시간대

    @Column(nullable = false)
    private String techStack; // 사용 기술

    @Column(nullable = false)
    private String interest; // 관심 분야

    private String gitHub; // null 허용

    private String blog; // null 허용

    @Column(nullable = false)
    private boolean projectExp;

    @Lob // 자기소개서처럼 매우 긴 텍스트를 위한 설정
    @Column(nullable = false)
    private String coverLetter;
}
