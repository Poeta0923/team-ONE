package com.teammatching.admin.system.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * AI 모델 파라미터 수정 요청 DTO (IN)
 * (PUT /.../score, PUT /.../acceptor)
 */
@Getter
@Setter
@NoArgsConstructor
public class AiModelLearningRateRequest {

    @NotNull(message = "학습률(learningRate)은 비워둘 수 없습니다.")
    private Double learningRate;
}
