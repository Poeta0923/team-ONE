package com.teammatching.admin.user.domain;


import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Table(name = "users")
@Entity
public class User {
    @Id //사용자 고유 번호
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "userId")
    private Integer userId;

    //역할(사용자 or 관리자)
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    //이름
    @Column(nullable = false)
    private String name;

    //생년월일
    @Column(nullable = false)
    private LocalDate birth;

    //전화번호
    @Column(nullable = false)
    private String phoneNumber;

    //계정 id
    @Column(nullable = false, unique = true)
    private String id;

    //계정 비밀번호
    @Column(nullable = false)
    private String password;

    //닉네임
    @Column(nullable = false)
    private String nickName;

    //직업
    @Column(nullable = false)
    private String job;

    //계정 생성 날짜 및 시간
    @Column(nullable = false)
    private LocalDateTime date;
}
