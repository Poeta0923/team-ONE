package com.teammatching.admin.dashboard.controller;

import com.teammatching.admin.dashboard.dto.DashboardResponse;
import com.teammatching.admin.dashboard.service.DashboardService;
import com.teammatching.admin.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RequiredArgsConstructor
@RequestMapping("/admin")
@RestController
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/dashboard")
    public ApiResponse<DashboardResponse> getDashboard() {
        DashboardResponse summary = dashboardService.getDashboardSummary();

        return ApiResponse.success("대시보드 조회 성공", summary);
    }
}
