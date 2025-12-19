package com.teammatching.admin.auth.dto;

import com.teammatching.admin.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "관리자 로그인 성공 응답")
public class LoginApiResponse extends ApiResponse<TokenResponse> {
    //Swagger를 위한 설명용 클래스, 개발 사용 X
    public LoginApiResponse(String contenType, int resultCode, String successMessage, TokenResponse data) {
        super(contenType, resultCode, successMessage, data);
    }
}
