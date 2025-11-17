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
        console.error('AI 모델 정확도 조회 실패:', result.successMessage);
      }
    } catch (error) {
      console.error('AI 모델 정확도 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 모델별로 적절한 메트릭 렌더링
  const renderModelMetrics = (model) => {
    if (model.modelName === "후보생성 모델") {
      return (
        <div className="model-metrics-detailed">
          <div className="metrics-section">
            <h5>HitRate@K</h5>
            <div className="metrics-grid">
              <span className="metric">K=1: {(model["HitRate@K"]["1"] * 100).toFixed(1)}%</span>
              <span className="metric">K=3: {(model["HitRate@K"]["3"] * 100).toFixed(1)}%</span>
              <span className="metric">K=5: {(model["HitRate@K"]["5"] * 100).toFixed(1)}%</span>
              <span className="metric">K=10: {(model["HitRate@K"]["10"] * 100).toFixed(1)}%</span>
            </div>
          </div>
          <div className="metrics-section">
            <h5>Recall@K</h5>
            <div className="metrics-grid">
              <span className="metric">K=1: {(model["Recall@K"]["1"] * 100).toFixed(1)}%</span>
              <span className="metric">K=3: {(model["Recall@K"]["3"] * 100).toFixed(1)}%</span>
              <span className="metric">K=5: {(model["Recall@K"]["5"] * 100).toFixed(1)}%</span>
              <span className="metric">K=10: {(model["Recall@K"]["10"] * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      );
    } else if (model.modelName === "재정렬 모델") {
      return (
        <div className="model-metrics-simple">
          <span className="metric">NDCG@4: {(model["ndcg@4"] * 100).toFixed(2)}%</span>
          <span className="metric">Precision@4: {(model["precision@4"] * 100).toFixed(2)}%</span>
        </div>
      );
    } else if (model.modelName === "수락확률 모델") {
      return (
        <div className="model-metrics-simple">
          <span className="metric">PR-AUC: {(model["pr_auc"] * 100).toFixed(2)}%</span>
          <span className="metric">F1 Score: {(model["f1"] * 100).toFixed(2)}%</span>
        </div>
      );
    }
    return null;
  };

  // 모델별 설명
  const getModelDescription = (modelName) => {
    const descriptions = {
      "후보생성 모델": "프로젝트에 적합한 팀원 후보를 생성하여 추천하는 모델",
      "재정렬 모델": "추천된 후보들을 최적의 순서로 재정렬하는 모델",
      "수락확률 모델": "팀원이 프로젝트 제안을 수락할 확률을 예측하는 모델"
    };
    return descriptions[modelName] || "";
  };

  // 모델에 파라미터가 있는지 확인
  const hasParameters = (modelName) => {
    return modelName === "재정렬 모델" || modelName === "수락확률 모델";
  };

  // 파라미터 수정 페이지로 이동
  const handleEditClick = (model) => {
    let modelType;
    if (model.modelName === "재정렬 모델") {
      modelType = "score";
    } else if (model.modelName === "수락확률 모델") {
      modelType = "acceptor";
    }
    
    if (modelType) {
      navigate(`/admin/ai/edit/${modelType}`);
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
                    if (model.modelName === "후보생성 모델") {
                      return acc + model["HitRate@K"]["1"];
                    } else if (model.modelName === "재정렬 모델") {
                      return acc + model["ndcg@4"];
                    } else if (model.modelName === "수락확률 모델") {
                      return acc + model["pr_auc"];
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
              {models.map((model, index) => (
                <div key={index} className="model-card">
                  <div className="model-header">
                    <h4>{model.modelName}</h4>
                    <span className="model-status active">활성</span>
                  </div>
                  <p className="model-description">{getModelDescription(model.modelName)}</p>
                  {renderModelMetrics(model)}
                  {hasParameters(model.modelName) && (
                    <div className="model-actions">
                      <button 
                        className="btn-small btn-primary"
                        onClick={() => handleEditClick(model)}
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
