package com.teammatching.admin.global.response;

import lombok.Getter;

@Getter
public class BaseResponse {

    public final String contentType = "json";
    public final int resultCode;
    private final String successMessage;

    public BaseResponse(int resultCode, String successMessage) {
        this.resultCode = resultCode;
        this.successMessage = successMessage;
    }
}
