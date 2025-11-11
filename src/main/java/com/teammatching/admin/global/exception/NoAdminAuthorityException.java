package com.teammatching.admin.global.exception;

public class NoAdminAuthorityException extends RuntimeException{
    public NoAdminAuthorityException(String message) {
        super(message); // ex.getMessage()가 이 메시지를 반환합니다.
    }
}
