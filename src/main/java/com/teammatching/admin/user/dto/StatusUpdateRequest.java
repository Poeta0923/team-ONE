package com.teammatching.admin.user.dto;

public record StatusUpdateRequest(
        String status,
        String reason
) {
}
