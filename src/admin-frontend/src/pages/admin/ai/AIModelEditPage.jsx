import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import { 
  fetchAIModelParameterScore,
  fetchAIModelParameterAcceptor,
  updateAIModelParameterScore,
  updateAIModelParameterAcceptor
} from '../../../utils/api';
import './AIModelEditPage.css';

const AIModelEditPage = () => {
  const { modelType } = useParams(); // 'score' or 'acceptor'
  const navigate = useNavigate();
  
  const [modelName, setModelName] = useState('');
  const [learningRate, setLearningRate] = useState(0);
  const [originalLearningRate, setOriginalLearningRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 모델 타입에 따른 이름 매핑
  const getModelName = () => {
    return modelType === 'score' ? '재정렬 모델' : '수락확률 모델';
  };

  // 모델 설명
  const getModelDescription = () => {
    if (modelType === 'score') {
      return '추천된 후보들을 최적의 순서로 재정렬하는 모델의 파라미터를 설정합니다.';
    }
    return '팀원이 프로젝트 제안을 수락할 확률을 예측하는 모델의 파라미터를 설정합니다.';
  };

  // Learning Rate 설명
  const getLearningRateDescription = () => {
    return '모델의 학습 속도를 결정하는 하이퍼파라미터입니다. 값이 클수록 빠르게 학습하지만 불안정할 수 있으며, 값이 작을수록 천천히 안정적으로 학습합니다. 일반적으로 0.00001 ~ 0.01 사이의 값을 사용합니다.';
  };

  useEffect(() => {
    loadParameters();
  }, [modelType]);

  // 변경사항 감지
  useEffect(() => {
    setHasChanges(learningRate !== originalLearningRate);
  }, [learningRate, originalLearningRate]);

  const loadParameters = async () => {
    setLoading(true);
    try {
      let result;
      if (modelType === 'score') {
        result = await fetchAIModelParameterScore();
      } else if (modelType === 'acceptor') {
        result = await fetchAIModelParameterAcceptor();
      }
      
      if (result && result.resultCode === 200) {
        setModelName(result.data.modelName);
        setLearningRate(result.data.learningRate);
        setOriginalLearningRate(result.data.learningRate);
      } else {
        console.error('파라미터 조회 실패:', result?.successMessage);
        alert('파라미터를 불러오는데 실패했습니다.');
        navigate('/admin/ai');
      }
    } catch (error) {
      console.error('파라미터 조회 실패:', error);
      alert('파라미터를 불러오는데 실패했습니다.');
      navigate('/admin/ai');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!hasChanges) {
      alert('변경된 내용이 없습니다.');
      return;
    }

    if (!window.confirm('Learning Rate를 수정하시겠습니까?\n\n⚠️ 주의: 잘못된 값은 모델 성능에 영향을 줄 수 있습니다.')) {
      return;
    }

    setSaving(true);
    try {
      let result;
      if (modelType === 'score') {
        result = await updateAIModelParameterScore(learningRate);
      } else if (modelType === 'acceptor') {
        result = await updateAIModelParameterAcceptor(learningRate);
      }

      if (result && result.resultCode === 200) {
        alert(result.successMessage || '파라미터가 성공적으로 수정되었습니다.');
        setOriginalLearningRate(learningRate);
        setHasChanges(false);
      } else {
        alert(result?.successMessage || '파라미터 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('파라미터 수정 실패:', error);
      alert('파라미터 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!hasChanges) {
      return;
    }

    if (window.confirm('변경사항을 취소하시겠습니까?')) {
      setLearningRate(originalLearningRate);
    }
  };

  const handleBack = () => {
    if (hasChanges) {
      if (window.confirm('변경사항이 저장되지 않았습니다. 정말 나가시겠습니까?')) {
        navigate('/admin/ai');
      }
    } else {
      navigate('/admin/ai');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="ai-edit-content">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>파라미터를 불러오는 중...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="ai-edit-content">
        {/* 헤더 */}
        <div className="edit-header">
          <div className="header-left">
            <button className="back-button" onClick={handleBack}>
              ← 돌아가기
            </button>
            <div className="header-info">
              <h2>{getModelName()} 파라미터 설정</h2>
              <p className="header-description">{getModelDescription()}</p>
            </div>
          </div>
          <div className="header-actions">
            {hasChanges && (
              <span className="unsaved-indicator">● 저장되지 않은 변경사항</span>
            )}
          </div>
        </div>

        {/* 파라미터 폼 */}
        <div className="parameters-form">
          <div className="form-section">
            <h3>Learning Rate 설정</h3>
            <p className="section-description">
              {getLearningRateDescription()}
            </p>
            
            <div className="single-parameter-container">
              <div className="parameter-card">
                <div className="parameter-header">
                  <label className="parameter-name">learningRate</label>
                  <span className="parameter-current-value">{learningRate}</span>
                </div>
                <div className="parameter-input-group">
                  <input
                    type="number"
                    className="parameter-input"
                    value={learningRate}
                    onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                    min={0.00001}
                    max={0.1}
                    step={0.00001}
                  />
                  <div className="parameter-range-info">
                    권장 범위: 0.00001 ~ 0.01 (최대 0.1)
                  </div>
                </div>
                {hasChanges && (
                  <div className="change-indicator">
                    <span className="original-value">원래 값: {originalLearningRate}</span>
                    <span className="arrow">→</span>
                    <span className="new-value">새 값: {learningRate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 하단 액션 버튼 */}
        <div className="edit-actions">
          <button 
            className="btn-cancel" 
            onClick={handleReset}
            disabled={!hasChanges || saving}
          >
            취소
          </button>
          <button 
            className="btn-save" 
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? '저장 중...' : '💾 저장하기'}
          </button>
        </div>

        {/* 경고 메시지 */}
        <div className="warning-box">
          <div className="warning-icon">⚠️</div>
          <div className="warning-content">
            <h4>Learning Rate 설정 가이드</h4>
            <ul>
              <li><strong>Learning Rate란?</strong> 모델이 학습할 때 가중치를 얼마나 크게 업데이트할지 결정하는 값입니다.</li>
              <li><strong>권장 범위:</strong> 일반적으로 0.00001 ~ 0.01 사이의 값을 사용합니다.</li>
              <li><strong>너무 큰 값:</strong> 학습이 불안정해지고 모델이 수렴하지 못할 수 있습니다.</li>
              <li><strong>너무 작은 값:</strong> 학습이 매우 느려지고 시간이 오래 걸립니다.</li>
              <li><strong>변경 후:</strong> 모델 재학습이 필요할 수 있으며, 변경사항은 즉시 반영됩니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AIModelEditPage;

