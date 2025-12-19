package com.teammatching.admin.system.dto;

import com.teammatching.admin.system.domain.AiModel;
import lombok.Builder;

@Builder // Service에서 이 DTO를 쉽게 만들 수 있도록 빌더 패턴 사용
public record AiModelParametersResponse(

        String modelName,
        Double learningRate
) {
    /**
     * AiModel 엔티티(DB 저장 결과)를 '응답 DTO'로 변환
     * (설계서의 'OUT' 양식에 맞춤)
     */
    public static AiModelParametersResponse from(AiModel entity) {
        return AiModelParametersResponse.builder()
                .modelName(entity.getModelName())
                .learningRate(entity.getLearningRate())
                .build();
    }
}
