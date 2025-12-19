package com.teammatching.admin.content.dto;

import com.teammatching.admin.content.domain.Contest;

public record ContestListResponse(
        Integer contestId,
        String name
) {
    /**
     * Contest 엔티티를 ContestListResponse DTO로 변환
     */
    public static ContestListResponse from(Contest contest) {
        return new ContestListResponse(
                contest.getContestId(),
                contest.getName()
        );
    }
}
