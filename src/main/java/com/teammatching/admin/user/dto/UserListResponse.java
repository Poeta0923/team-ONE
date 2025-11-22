package com.teammatching.admin.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import com.teammatching.admin.user.domain.User;
import java.time.LocalDate;

public record UserListResponse (
        @Schema(description = "사용자 이름", example = "최고관리자")
        String name,

        @Schema(description = "닉네임", example = "Admin")
        String nickName,

        @Schema(description = "사용 기술", example = "Spring Boot")
        String techStack,

        @Schema(description = "전화번호", example = "010-0000-0000")
        String phoneNumber,

        @Schema(description = "생일", example = "1995-03-15")
        LocalDate birth,

        @Schema(description = "주소" , example = "경기 고양시")
        String address

) {
    /**
     * User 엔티티를 UserListResponse DTO로 변환하는 정적 팩토리 메소드
     */
    public static UserListResponse from(User user) {
        // user.getResume()가 null일 경우 대비 (NullPointerException 방지)
        String techStack = null;
        String address = null;

        // User가 Resume 데이터를 가지고 있는 경우에만 값을 가져옴, 관리자 계정은 못 가져옴
        if (user.getResume() != null) {
            techStack = user.getResume().getTechStack();
            address = user.getResume().getAddress();
        }

        return new UserListResponse(
                user.getName(),
                user.getNickName(),
                techStack,          // Resume에서 가져온 값
                user.getPhoneNumber(),
                user.getBirth(),
                address             // Resume에서 가져온 값
        );
    }
}
