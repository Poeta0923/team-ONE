package com.teammatching.admin.user.dto;
import com.teammatching.admin.user.domain.UserStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
public record BannedUserResponse(
        @Schema(description = "사용자 이름", example = "김철수")
        String name,

        @Schema(description = "닉네임", example = "코딩천재")
        String nickName,

        @Schema(description = "제재 상태 (banned 등)", example = "banned")
        String status,

        @Schema(description = "제재 사유", example = "반복적인 욕설 신고")
        String reason,

        @Schema(description = "제재 적용(수정) 날짜")
        LocalDateTime updatedAt
) {
    /**
     * UserStatus 엔티티를 BannedUserResponse DTO로 변환하는 정적 팩토리 메소드
     * UserStatus에 연결된 User 객체에서 이름/닉네임을 가져옴
     */
    public static BannedUserResponse from(UserStatus userStatus) {
        return new BannedUserResponse(
                userStatus.getUser().getName(),     // 연결된 User에서 이름 가져오기
                userStatus.getUser().getNickName(), // 연결된 User에서 닉네임 가져오기
                userStatus.getStatus(),
                userStatus.getReason(),
                userStatus.getUpdatedAt()
        );
    }
}
