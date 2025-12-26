import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import { fetchAIModelAccuracy } from '../../../utils/api';
import './AIPage.css';

const AIPage = () => {
  const navigate = useNavigate();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAIModels();
  }, []);

  const loadAIModels = async () => {
    setLoading(true);
    try {
      const result = await fetchAIModelAccuracy();
      
      if (result.resultCode === 200) {
        setModels(result.data);
      } else {
        alert(`조회 실패: ${result.successMessage || '알 수 없는 오류'}`);
      }
    } catch (error) {
      alert(`오류 발생: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 모델별로 적절한 메트릭 렌더링
  const renderModelMetrics = (model) => {
    // embedding 모델 (후보생성 모델)
    if (model.model === "embedding" && model.data) {
      const hitRate = model.data["HitRate@K"];
      const recall = model.data["Recall@K"];
      
      if (hitRate && recall) {
        return (
          <div className="model-metrics-detailed">
            <div className="metrics-section">
              <h5>HitRate@K</h5>
              <div className="metrics-grid">
                <span className="metric">K=1: {(hitRate["1"] * 100).toFixed(1)}%</span>
                <span className="metric">K=3: {(hitRate["3"] * 100).toFixed(1)}%</span>
                <span className="metric">K=5: {(hitRate["5"] * 100).toFixed(1)}%</span>
                <span className="metric">K=10: {(hitRate["10"] * 100).toFixed(1)}%</span>
              </div>
            </div>
            <div className="metrics-section">
              <h5>Recall@K</h5>
              <div className="metrics-grid">
                <span className="metric">K=1: {(recall["1"] * 100).toFixed(1)}%</span>
                <span className="metric">K=3: {(recall["3"] * 100).toFixed(1)}%</span>
                <span className="metric">K=5: {(recall["5"] * 100).toFixed(1)}%</span>
                <span className="metric">K=10: {(recall["10"] * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        );
      }
    } 
    // uum_matcher 모델 (재정렬 모델)
    else if (model.model === "uum_matcher" && model.data?.data) {
      return (
        <div className="model-metrics-simple">
          <span className="metric">Threshold: {model.data.threshold}</span>
          <span className="metric">Best Threshold: {model.data.best_threshold_sweep_on_evalset?.toFixed(4)}</span>
        </div>
      );
    } 
    // acceptor 모델 (수락확률 모델)
    else if (model.model === "acceptor" && model.data) {
      return (
        <div className="model-metrics-simple">
          <span className="metric">Features: {model.data.features?.length || 0}개</span>
          <span className="metric">Backend: {model.data.backend}</span>
          <span className="metric">Threshold: {model.data.threshold}</span>
        </div>
      );
    }
    
    return (
      <div className="model-metrics-simple">
        <span className="metric">데이터 로드 중...</span>
      </div>
    );
  };

  // 모델 이름 한글 변환
  const getModelDisplayName = (modelId) => {
    const names = {
      "embedding": "후보생성 모델",
      "uum_matcher": "재정렬 모델",
      "acceptor": "수락확률 모델"
    };
    return names[modelId] || modelId;
  };

  // 모델별 설명
  const getModelDescription = (modelId) => {
    const descriptions = {
      "embedding": "프로젝트에 적합한 팀원 후보를 생성하여 추천하는 모델",
      "uum_matcher": "추천된 후보들을 최적의 순서로 재정렬하는 모델",
      "acceptor": "팀원이 프로젝트 제안을 수락할 확률을 예측하는 모델"
    };
    return descriptions[modelId] || "";
  };

  // 모델에 파라미터가 있는지 확인
  const hasParameters = (modelId) => {
    return modelId === "uum_matcher" || modelId === "acceptor";
  };

  // 파라미터 수정 페이지로 이동
  const handleEditClick = (model) => {
    let modelType;
    if (model.model === "uum_matcher") {
      modelType = "score";
    } else if (model.model === "acceptor") {
      modelType = "acceptor";
    }
    
    if (modelType) {
      // 현재 모델 데이터를 state로 전달
      navigate(`/admin/ai/edit/${modelType}`, { 
        state: { 
          currentModel: model,
          currentLearningRate: model.data?.learningRate || model.data?.threshold || null
        } 
      });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="ai-content">
          <div className="loading">AI 모델 정보를 불러오는 중...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="ai-content">
        <div className="content-header">
          <h2>AI 모델 관리</h2>
          <button className="btn btn-primary" onClick={loadAIModels}>🔄 새로고침</button>
        </div>
        
        <div className="ai-stats">
          <div className="stat-card">
            <div className="stat-icon">🤖</div>
            <div className="stat-info">
              <h3>활성 AI 모델</h3>
              <p className="stat-number">{models.length}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <h3>평균 정확도</h3>
              <p className="stat-number">
                {models.length > 0 ? 
                  ((models.reduce((acc, model) => {
                    if (model.model === "embedding" && model.data?.["HitRate@K"]) {
                      return acc + model.data["HitRate@K"]["1"];
                    } else if (model.model === "uum_matcher") {
                      return acc + 0.9; // 임시값
                    } else if (model.model === "acceptor") {
                      return acc + 0.95; // 임시값
                    }
                    return acc;
                  }, 0) / models.length) * 100).toFixed(1) + '%'
                  : 'N/A'}
              </p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚡</div>
            <div className="stat-info">
              <h3>모델 상태</h3>
              <p className="stat-number">정상</p>
            </div>
          </div>
        </div>

        <div className="ai-models">
          <h3>AI 모델 현황</h3>
          {models.length === 0 ? (
            <div className="empty-state">
              <p>AI 모델 정보가 없습니다.</p>
            </div>
          ) : (
            <div className="models-grid">
              {models.map((modelData, index) => (
                <div key={index} className="model-card">
                  <div className="model-header">
                    <h4>{getModelDisplayName(modelData.model)}</h4>
                    <span className="model-status active">{modelData.OK ? '활성' : '오류'}</span>
                  </div>
                  <p className="model-description">{getModelDescription(modelData.model)}</p>
                  {renderModelMetrics(modelData)}
                  {hasParameters(modelData.model) && (
                    <div className="model-actions">
                      <button 
                        className="btn-small btn-primary"
                        onClick={() => handleEditClick(modelData)}
                      >
                        수정
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AIPage;
