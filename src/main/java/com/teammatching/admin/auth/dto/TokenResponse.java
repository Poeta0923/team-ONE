package com.teammatching.admin.auth.dto;

public record TokenResponse(String accessToken, String refreshToken) {
}
