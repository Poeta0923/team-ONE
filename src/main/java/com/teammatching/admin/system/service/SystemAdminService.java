package com.teammatching.admin.system.service;

import com.teammatching.admin.system.domain.AiModel;

import com.teammatching.admin.system.domain.AiModel;
import com.teammatching.admin.system.dto.AiModelLearningRateRequest;
import com.teammatching.admin.system.dto.FastApiStatsDto;
import com.teammatching.admin.system.repository.AiModelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@RequiredArgsConstructor
@Transactional
@Service
public class SystemAdminService {

    private final RestTemplate restTemplate;
    private final AiModelRepository aiModelRepository;

    // --- AI 서버 주소 주입 ---
    @Value("${ai.fastapi.url.stats}")
    private String fastApiStatsUrl;

    @Value("${ai.fastapi.url.parameter.score}")
    private String fastApiScoreUrl;

    @Value("${ai.fastapi.url.parameter.acceptor}")
    private String fastApiAcceptorUrl;

    // AI 모델 정확도 조회 기능
    @Transactional(readOnly = true)
    public Object[] getAiModelStats() {
        try {
            return restTemplate.getForObject(fastApiStatsUrl, Object[].class);
        } catch (RestClientException e) {
            System.err.println("AI 서버(" + fastApiStatsUrl + ") 연결 실패: " + e.getMessage());
            return new Object[0];
        }
    }


    /**
     * [재정렬 모델] 파라미터를 수정합니다.
     */
    public AiModel updateScoreModel(AiModelLearningRateRequest request) {
        // 1. FastAPI 서버에 '적용' 요청
        sendParametersToFastApi(fastApiScoreUrl, request);

        // 2. DB에 '저장' (모델 이름을 "재정렬 모델"로 하드코딩)
        return findOrCreateAndSave("재정렬 모델", request.getLearningRate());
    }

    /**
     * [수락확률 모델] 파라미터를 수정합니다.
     */
    public AiModel updateAcceptorModel(AiModelLearningRateRequest request) {
        // 1. FastAPI 서버에 '적용' 요청
        sendParametersToFastApi(fastApiAcceptorUrl, request);

        // 2. DB에 '저장' (모델 이름을 "수락확률 모델"로 하드코딩)
        return findOrCreateAndSave("수락확률 모델", request.getLearningRate());
    }

    /**
     * (공통 로직) FastAPI 서버에 파라미터를 PUT 요청으로 전송합니다.
     */
    private void sendParametersToFastApi(String url, AiModelLearningRateRequest request) {
        try {
            // (참고: FastAPI가 { "learningRate": 0.0005 } 형식만 받으므로
            //       AiModelParametersRequest 대신 AiModelLearningRateRequest를 보냅니다.)
            HttpEntity<AiModelLearningRateRequest> entity = new HttpEntity<>(request);
            restTemplate.put(url, entity);
        } catch (RestClientException e) {
            System.err.println("AI 서버(" + url + ") 파라미터 적용 실패: " + e.getMessage());
            // (AI 서버가 죽어도 DB 저장은 진행되도록 예외를 로깅만 합니다.)
        }
    }

    /**
     * (공통 로직) DB에서 모델을 찾거나, 새로 생성하여 파라미터를 저장(업데이트)합니다.
     */
    private AiModel findOrCreateAndSave(String modelName, Double learningRate) {
        // DB에서 모델 이름으로 검색
        AiModel aiModel = aiModelRepository.findByModelName(modelName)
                .orElse(null); // 없으면 null

        if (aiModel == null) {
            // 1. (신규) AiModel.of() 팩토리 메소드 사용
            aiModel = AiModel.of(modelName, learningRate);
        } else {
            // 2. (업데이트) 엔티티 필드 업데이트
            aiModel.setModelName(modelName);
            aiModel.setLearningRate(learningRate);
        }

        return aiModelRepository.save(aiModel);
    }
}