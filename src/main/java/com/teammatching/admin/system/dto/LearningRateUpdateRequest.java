package com.teammatching.admin.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class LearningRateUpdateRequest {

    @NotNull(message = "학습률(learningRate) 값은 비워둘 수 없습니다.")
    private Double learningRate;
}
