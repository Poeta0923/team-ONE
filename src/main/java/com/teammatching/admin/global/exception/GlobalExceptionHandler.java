package com.teammatching.admin.global.exception;

import com.teammatching.admin.global.response.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MethodArgumentNotValidException;
@RestControllerAdvice //모든 Controller에서 발생하는 예외 처리
public class GlobalExceptionHandler {
    
    // 로그인 실패 핸들러 - 아이디, 비밀번호 불일치
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgumentException(IllegalArgumentException ex) {

        // 에러 코드와 에러 메시지 생성
        ApiResponse<Void> error = ApiResponse.error(401, ex.getMessage());
        // json 에러 응답 반환
        return new ResponseEntity<>(error, HttpStatus.UNAUTHORIZED);
    }

    // 로그인 실패 핸들러 - 관리자 권한 X
    @ExceptionHandler(NoAdminAuthorityException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoAdminAuthorityException(NoAdminAuthorityException ex) {

        ApiResponse<Void> error = ApiResponse.error(401, ex.getMessage());
        return new ResponseEntity<>(error, HttpStatus.UNAUTHORIZED);
    }

    // @Valid 실패 핸들러
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodArgumentNotValidException(MethodArgumentNotValidException ex) {

        String errorMessage = ex.getBindingResult()
                .getAllErrors()
                .get(0)
                .getDefaultMessage();

        ApiResponse<Void> errorResponse = ApiResponse.error(600, errorMessage);

        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }

    // 삭제 실패 핸들러
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalStateException(IllegalStateException ex) {

        String errorMessage = ex.getMessage();
        ApiResponse<Void> error = ApiResponse.error(409, errorMessage);

        return new ResponseEntity<>(error, HttpStatus.CONFLICT);
    }
}
