package com.teammatching.admin.global.response;

import lombok.Getter;
import lombok.Setter;

@Getter
public class ApiResponse<T> {
    private final String contentType;
    private final int resultCode;
    private final String successMessage;
    private final T data;

    public ApiResponse(String contentType, int resultCode, String successMessage, T data) {
        this.contentType = contentType;
        this.resultCode = resultCode;
        this.successMessage = successMessage;
        this.data = data;
    }

    // 성공 응답을 쉽게 만들기 위한 정적 메소드
    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>("json", 200, message, data);
    }

    // 실패 응답을 위한 메소드
    public static <T> ApiResponse<T> error(int resultCode, String message) {
        return new ApiResponse<>("json", resultCode, message, null);
    }
}
