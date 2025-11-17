package com.teammatching.admin.system.controller;

import com.teammatching.admin.global.response.ApiResponse;
import com.teammatching.admin.system.domain.AiModel;
import com.teammatching.admin.system.dto.AiModelLearningRateRequest; // 1. 'IN' DTO 임포트
import com.teammatching.admin.system.dto.AiModelParametersResponse; // 2. 'OUT' DTO 임포트
import com.teammatching.admin.system.service.SystemAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

@RequiredArgsConstructor
@RequestMapping("/admin")
@RestController
public class SystemAdminController {

    private final SystemAdminService systemAdminService;

    // AI 모델 정확도 조회 API
    @GetMapping("/ai-model")
    public ApiResponse<List<Object>> getAiModelStatus() {
        Object[] internalDataArray = systemAdminService.getAiModelStats();
        List<Object> statsList = Arrays.asList(internalDataArray);
        return ApiResponse.success("AI 모델 현황 조회 성공", statsList);
    }

    // 재정렬 모델 파라미터 수정 API
    @PutMapping("/ai-model/parameter/score") // 4. API 주소 1
    public ApiResponse<AiModelParametersResponse> updateScoreModelParameters(
            @RequestBody @Valid AiModelLearningRateRequest request
    ) {
        // 5. Service의 'score' 메소드 호출
        AiModel savedAiModel = systemAdminService.updateScoreModel(request);
        AiModelParametersResponse responseDto = AiModelParametersResponse.from(savedAiModel);
        return ApiResponse.success("재정렬 모델 파라미터가 성공적으로 수정되었습니다.", responseDto);
    }

    // 수락 확률 모델 파라미터 수정 API
    @PutMapping("/ai-model/parameter/acceptor")
    public ApiResponse<AiModelParametersResponse> updateAcceptorModelParameters(
            @RequestBody @Valid AiModelLearningRateRequest request
    ) {
        // Service의 'acceptor' 메소드 호출
        AiModel savedAiModel = systemAdminService.updateAcceptorModel(request);
        AiModelParametersResponse responseDto = AiModelParametersResponse.from(savedAiModel);
        return ApiResponse.success("수락확률 모델 파라미터가 성공적으로 수정되었습니다.", responseDto);
    }
}