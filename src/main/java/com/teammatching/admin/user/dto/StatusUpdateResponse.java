package com.teammatching.admin.user.dto;

import com.teammatching.admin.user.domain.UserStatus;

import java.time.LocalDateTime;

public record StatusUpdateResponse(
        Integer userId,
        String status,
        LocalDateTime updateAt
) {
    /**
     * UserStatus 엔티티를 StatusUpdateResponse DTO로 변환
     */
    public static StatusUpdateResponse from(UserStatus userStatus) {
        return new StatusUpdateResponse(
                userStatus.getUser().getUserId(),
                userStatus.getStatus(),
                userStatus.getUpdatedAt()
        );
    }
}
