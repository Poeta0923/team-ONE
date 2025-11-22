package com.teammatching.admin.system.repository;

import com.teammatching.admin.system.domain.AiModel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AiModelRepository extends JpaRepository<AiModel, Integer> {
    // 모델 이름으로 모델을 찾는 기능 (예: "재정렬 모델")
    Optional<AiModel> findByModelName(String modelName);
}
