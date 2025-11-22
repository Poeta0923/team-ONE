package com.teammatching.admin.system.service;

import com.teammatching.admin.system.domain.AiModel;
import com.teammatching.admin.system.dto.AiModelLearningRateRequest;
import com.teammatching.admin.system.repository.AiModelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList; // 2. ArrayList, List 임포트
import java.util.List;

@RequiredArgsConstructor
@Transactional
@Service
public class SystemAdminService {

    private final RestTemplate restTemplate;
    private final AiModelRepository aiModelRepository;


    @Value("${ai.fastapi.url.scorer}")
    private String fastApiScorerUrl;

    @Value("${ai.fastapi.url.acceptor}")
    private String fastApiAcceptorUrl;

    @Value("${ai.fastapi.url.embedding}")
    private String fastApiEmbeddingUrl;

    // (수정용 URL 주입)
    @Value("${ai.fastapi.url.parameter.score}")
    private String fastApiScoreUpdateUrl;

    @Value("${ai.fastapi.url.parameter.acceptor}")
    private String fastApiAcceptorUpdateUrl;

    /**
     * 3개의 AI 모델 API를 각각 호출하여, 그 결과를 하나의 List로 합쳐 반환
     */
    @Transactional(readOnly = true)
    // 4. (핵심!) 반환 타입을 'List<Object>'로 변경
    public List<Object> getAiModelStats() {
        List<Object> allStats = new ArrayList<>();

        try {
            // 3개의 API를 각각 호출하고, Object.class로 응답을 받음
            // RestTemplate이 JSON 구조를 모르므로, 가장 일반적인 Object로 받음
            Object scorerStats = restTemplate.getForObject(fastApiScorerUrl, Object.class);
            Object acceptorStats = restTemplate.getForObject(fastApiAcceptorUrl, Object.class);
            Object embeddingStats = restTemplate.getForObject(fastApiEmbeddingUrl, Object.class);

            // 3개의 결과를 하나의 리스트에 추가
            allStats.add(scorerStats);
            allStats.add(acceptorStats);
            allStats.add(embeddingStats);

        } catch (RestClientException e) {
            System.err.println("AI 서버 3개 모델 중 하나 연결 실패: " + e.getMessage());
            // 실패 시 빈 리스트 반환
            return new ArrayList<>();
        }

        return allStats;
    }

    /**
     * [재정렬 모델] 파라미터를 수정
     */
    public AiModel updateScoreModel(AiModelLearningRateRequest request) {
        sendParametersToFastApi(fastApiScoreUpdateUrl, request);
        return findOrCreateAndSave("재정렬 모델", request.getLearningRate());
    }

    /**
     * [수락확률 모델] 파라미터를 수정
     */
    public AiModel updateAcceptorModel(AiModelLearningRateRequest request) {
        sendParametersToFastApi(fastApiAcceptorUpdateUrl, request);
        return findOrCreateAndSave("수락확률 모델", request.getLearningRate());
    }

    /**
     * (공통 로직) FastAPI 서버에 파라미터를 PUT 요청으로 전송
     */
    private void sendParametersToFastApi(String url, AiModelLearningRateRequest request) {
        try {
            HttpEntity<AiModelLearningRateRequest> entity = new HttpEntity<>(request);
            restTemplate.put(url, entity);
        } catch (RestClientException e) {
            System.err.println("AI 서버(" + url + ") 파라미터 적용 실패: " + e.getMessage());
        }
    }

    /**
     * (공통 로직) DB에서 모델을 찾거나, 새로 생성하여 파라미터를 저장(업데이트)
     */
    private AiModel findOrCreateAndSave(String modelName, Double learningRate) {
        AiModel aiModel = aiModelRepository.findByModelName(modelName)
                .orElse(AiModel.of(modelName, learningRate)); // 없으면 'of' 팩토리 메소드로 생성

        aiModel.setModelName(modelName);
        aiModel.setLearningRate(learningRate);

        return aiModelRepository.save(aiModel);
    }
}