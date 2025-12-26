import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import { 
  updateAIModelParameterScore,
  updateAIModelParameterAcceptor
} from '../../../utils/api';
import './AIModelEditPage.css';

const AIModelEditPage = () => {
  const { modelType } = useParams(); // 'score' or 'acceptor'
  const navigate = useNavigate();
  const location = useLocation();
  
  const [learningRate, setLearningRate] = useState('');
  const [currentLearningRate, setCurrentLearningRate] = useState(null);
  const [saving, setSaving] = useState(false);

  // 전달받은 현재 모델 데이터 처리
  useEffect(() => {
    if (location.state?.currentLearningRate) {
      setCurrentLearningRate(location.state.currentLearningRate);
    }
  }, [location.state, modelType]);

  // 모델 타입에 따른 이름 매핑
  const getModelName = () => {
    return modelType === 'score' ? '재정렬 모델' : '수락확률 모델';
  };

  // 모델 설명
  const getModelDescription = () => {
    if (modelType === 'score') {
      return '추천된 후보들을 최적의 순서로 재정렬하는 모델의 Learning Rate를 설정합니다.';
    }
    return '팀원이 프로젝트 제안을 수락할 확률을 예측하는 모델의 Learning Rate를 설정합니다.';
  };

  // Learning Rate 설명
  const getLearningRateDescription = () => {
    return '모델의 학습 속도를 결정하는 하이퍼파라미터입니다. 값이 클수록 빠르게 학습하지만 불안정할 수 있으며, 값이 작을수록 천천히 안정적으로 학습합니다. 초기값은 0.0005이며, 일반적으로 0.00001 ~ 0.01 사이의 값을 사용합니다.';
  };

  const handleSave = async () => {
    // 입력 검증
    if (!learningRate || learningRate === '') {
      alert('Learning Rate 값을 입력해주세요.');
      return;
    }

    const rate = parseFloat(learningRate);
    
    if (isNaN(rate)) {
      alert('올바른 숫자를 입력해주세요.');
      return;
    }

    if (rate < 0.00001 || rate > 0.1) {
      alert('Learning Rate는 0.00001 ~ 0.1 사이의 값을 권장합니다.');
      return;
    }

    if (!window.confirm(`Learning Rate를 ${rate}로 수정하시겠습니까?\n\n⚠️ 주의: 잘못된 값은 모델 성능에 영향을 줄 수 있습니다.`)) {
      return;
    }
    
    setSaving(true);
    try {
      let result;
      
      if (modelType === 'score') {
        result = await updateAIModelParameterScore(rate);
      } else if (modelType === 'acceptor') {
        result = await updateAIModelParameterAcceptor(rate);
      }

      if (result && result.resultCode === 200) {
        alert(result.successMessage || '파라미터가 성공적으로 수정되었습니다.');
        navigate('/admin/ai');
      } else {
        alert(result?.successMessage || '파라미터 수정에 실패했습니다.');
      }
    } catch (error) {
      alert('파라미터 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (learningRate && learningRate !== '') {
      if (window.confirm('입력한 내용이 저장되지 않았습니다. 정말 나가시겠습니까?')) {
        navigate('/admin/ai');
      }
    } else {
      navigate('/admin/ai');
    }
  };

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
        </div>

        {/* 파라미터 폼 */}
        <div className="parameters-form">
          <div className="form-section">
            <h3>Learning Rate 설정</h3>
            <p className="section-description">
              {getLearningRateDescription()}
            </p>
            
            <div className="single-parameter-container">
              <div className="parameter-card-simple">
                <div className="simple-header">
                  <div className="header-row">
                    <span className="param-label">Learning Rate</span>
                    {currentLearningRate !== null && (
                      <span className="current-badge">현재: {currentLearningRate}</span>
                    )}
                  </div>
                </div>
                
                <div className="input-wrapper">
                  <input
                    type="number"
                    className="parameter-input-large"
                    value={learningRate}
                    onChange={(e) => setLearningRate(e.target.value)}
                    placeholder="0.0005"
                    min={0.00001}
                    max={0.1}
                    step={0.00001}
                    autoFocus
                  />
                </div>
                
                <div className="simple-hint">
                  💡 초기값: 0.0005 | 권장 범위: 0.00001 ~ 0.01 (최대 0.1)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 액션 버튼 */}
        <div className="edit-actions">
          <button 
            className="btn-cancel" 
            onClick={handleBack}
            disabled={saving}
          >
            취소
          </button>
          <button 
            className="btn-save" 
            onClick={handleSave}
            disabled={saving || !learningRate}
          >
            {saving ? '저장 중...' : '💾 저장하기'}
          </button>
        </div>

        {/* 간단 안내 */}
        <div className="simple-guide">
          <span className="guide-icon">ℹ️</span>
          <span className="guide-text">
            <strong>초기 학습률:</strong> 0.0005 | 값이 너무 크면 학습이 불안정하고, 너무 작으면 학습이 느려집니다. 변경사항은 즉시 반영됩니다.
          </span>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AIModelEditPage;
