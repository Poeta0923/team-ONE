package com.teammatching.admin.global.exception;

import com.teammatching.admin.global.response.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MethodArgumentNotValidException;
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


    // @Valid 어노테이션을 통한 유효성 검사 실패 시 발생하는 예외를 처리
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodArgumentNotValidException(MethodArgumentNotValidException ex) {

        // 3. 예외 객체에서 우리가 DTO에 정의했던 에러 메시지를 꺼냄
        String errorMessage = ex.getBindingResult()
                .getAllErrors()
                .get(0) // 첫 번째 에러 메시지를 가져옴
                .getDefaultMessage();

        // 4. 우리가 정한 600번 오류 코드와 함께 ApiResponse를 생성합니다.
        ApiResponse<Void> errorResponse = ApiResponse.error(600, errorMessage);

        // 5. 400 Bad Request 상태와 함께 에러 응답을 반환합니다.
        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }
}
