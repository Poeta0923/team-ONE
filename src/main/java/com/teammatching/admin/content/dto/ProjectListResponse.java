package com.teammatching.admin.content.dto;

import com.teammatching.admin.content.domain.Project;

import java.time.LocalDateTime;

public record ProjectListResponse(
        Integer projectId,
        String name,
        String type,
        String category,
        String statement,
        LocalDateTime date
) {
    /**
     * Project 엔티티를 ProjectListResponse DTO로 변환
     */
    public static ProjectListResponse from(Project project) {
        return new ProjectListResponse(
                project.getProjectId(),
                project.getName(),
                project.getType(),
                project.getCategory(),
                project.getStatement(),
                project.getDate()
        );
    }
}
