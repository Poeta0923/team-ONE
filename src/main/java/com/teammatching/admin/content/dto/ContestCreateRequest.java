package com.teammatching.admin.content.dto;

import jakarta.validation.constraints.NotBlank;

public record ContestCreateRequest(
        // 공모전 이름
        @NotBlank(message = "공모전 이름은 빈칸일 수 없습니다. 공모전 이름을 입력해주세요")
        String name
) {
}
