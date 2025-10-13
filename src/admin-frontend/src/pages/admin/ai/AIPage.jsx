import React from 'react';
import AdminLayout from '../../../components/AdminLayout';
import './AIPage.css';

const AIPage = () => {
  return (
    <AdminLayout>
      <div className="ai-content">
        <div className="content-header">
          <h2>AI 관리</h2>
          <button className="btn btn-primary">AI 모델 훈련</button>
        </div>
        
        <div className="ai-stats">
          <div className="stat-card">
            <div className="stat-icon">🤖</div>
            <div className="stat-info">
              <h3>활성 AI 모델</h3>
              <p className="stat-number">3</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <h3>매칭 정확도</h3>
              <p className="stat-number">94.2%</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚡</div>
            <div className="stat-info">
              <h3>평균 응답시간</h3>
              <p className="stat-number">0.3초</p>
            </div>
          </div>
        </div>

        <div className="ai-models">
          <h3>AI 모델 현황</h3>
          <div className="models-grid">
            <div className="model-card">
              <div className="model-header">
                <h4>스킬 매칭 모델</h4>
                <span className="model-status active">활성</span>
              </div>
              <p className="model-description">개발자 스킬을 분석하여 최적의 팀원을 매칭하는 모델</p>
              <div className="model-metrics">
                <span className="metric">정확도: 96.5%</span>
                <span className="metric">사용량: 1,234회</span>
              </div>
              <div className="model-actions">
                <button className="btn-small btn-outline">재훈련</button>
                <button className="btn-small btn-primary">상세보기</button>
              </div>
            </div>

            <div className="model-card">
              <div className="model-header">
                <h4>프로젝트 추천 모델</h4>
                <span className="model-status active">활성</span>
              </div>
              <p className="model-description">사용자 선호도에 기반한 프로젝트 추천 모델</p>
              <div className="model-metrics">
                <span className="metric">정확도: 92.1%</span>
                <span className="metric">사용량: 856회</span>
              </div>
              <div className="model-actions">
                <button className="btn-small btn-outline">재훈련</button>
                <button className="btn-small btn-primary">상세보기</button>
              </div>
            </div>

            <div className="model-card">
              <div className="model-header">
                <h4>성과 예측 모델</h4>
                <span className="model-status training">훈련중</span>
              </div>
              <p className="model-description">프로젝트 성공 가능성을 예측하는 모델</p>
              <div className="model-metrics">
                <span className="metric">정확도: 89.3%</span>
                <span className="metric">사용량: 0회</span>
              </div>
              <div className="model-actions">
                <button className="btn-small btn-outline">재훈련</button>
                <button className="btn-small btn-primary">상세보기</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AIPage;
