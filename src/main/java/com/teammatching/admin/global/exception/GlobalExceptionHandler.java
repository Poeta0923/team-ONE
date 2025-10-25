package com.teammatching.admin.global.exception;

import com.teammatching.admin.global.response.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice //모든 Controller에서 발생하는 예외 처리
public class GlobalExceptionHandler {
    
    //AuthService(관리자 인증)에서 발생한 예외 처리
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgumentException(IllegalArgumentException ex) {

        // 에러 코드와 에러 메시지 생성
        ApiResponse<Void> errorResponse = ApiResponse.error(401, ex.getMessage());

        // json 에러 응답 반환
        return new ResponseEntity<>(errorResponse, HttpStatus.UNAUTHORIZED);
    }
}
