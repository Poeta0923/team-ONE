package com.teammatching.admin.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class AppConfig {
    //RestTemplate를 통해 다른 서버와 HTTP 통신을 가능하게 함
    @Bean
    public RestTemplate restTemplate(){
        return new RestTemplate();
    }
}
