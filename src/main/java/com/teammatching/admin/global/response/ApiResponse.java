package com.teammatching.admin.global.response;

public record ApiResponse<T>(
        String contentType,
        int resultCode,
        String successMessage,
        T data
) {
    // 성공 응답을 쉽게 만들기 위한 정적 메소드
    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>("json", 200, message, data);
    }

    // 실패 응답을 위한 메소드
    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>("json", 600, message, null);
    }
}
