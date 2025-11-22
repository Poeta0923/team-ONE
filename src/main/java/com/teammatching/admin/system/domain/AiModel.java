package com.teammatching.admin.system.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "ai_models")
@Entity
public class AiModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer modelId;

    @Column(nullable = false, unique = true)
    private String modelName;

    @Column(nullable = false, columnDefinition = "DECIMAL(10,5)")
    private Double learningRate;


    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 개발자가 '새로운' AiModel 객체를 안전하게 생성하기 위한
     * 정적 팩토리 메소드 (수정됨)
     */
    public static AiModel of(String modelName, Double learningRate) {
        AiModel aiModel = new AiModel();
        aiModel.setModelName(modelName);
        aiModel.setLearningRate(learningRate);
        return aiModel;
    }
}
