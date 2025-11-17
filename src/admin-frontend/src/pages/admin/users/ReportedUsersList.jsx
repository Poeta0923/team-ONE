import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchReports, updateReportStatus, banUser, unbanUser, fetchUserReportDetail, fetchBannedUsers } from '../../../utils/api';
import Pagination from './Pagination';

const ReportedUsersList = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  
  // 모달 관련 상태
  const [selectedReport, setSelectedReport] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [showBlockInput, setShowBlockInput] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadReportedUsers(currentPage);
  }, [currentPage]);

  const loadReportedUsers = async (page) => {
    setLoading(true);
    
    try {
      const result = await fetchReports(page - 1, 10);
      
      if (result.resultCode === 200) {
        setReports(result.data.reports || []);
        setTotalElements(result.data.totalElements || 0);
        setTotalPages(result.data.totalPages || 1);
      } else {
        alert(`신고 내역 조회 실패: ${result.successMessage || '알 수 없는 오류'}`);
      }
    } catch (error) {
      alert('신고 내역 조회 중 오류가 발생했습니다. 다시 로그인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleMoreClick = async (report) => {
    setSelectedReport(report);
    setShowModal(true);
    setShowBlockInput(false);
    setBlockReason('');
    setLoadingDetails(true);
    
    
    if (report.reportedUserStatus) {
      setUserDetails({
        userId: report.reportedUserId,
        name: report.reportedName,
        nickName: report.reportedName,
        status: report.reportedUserStatus
      });
      setLoadingDetails(false);
    } else {
      // reportedUserStatus가 없는 경우 - 블랙리스트 API로 확인
      try {
        // 차단된 회원 목록 가져오기 (큰 limit으로 전체 조회)
        const bannedResult = await fetchBannedUsers(0, 1000);
        
        if (bannedResult.resultCode === 200 && bannedResult.data && bannedResult.data.users) {
          // 차단된 회원 목록에서 해당 userId 찾기
          const isBanned = bannedResult.data.users.some(u => u.userId === report.reportedUserId);
          
          setUserDetails({
            userId: report.reportedUserId,
            name: report.reportedName,
            nickName: report.reportedName,
            status: isBanned ? 'banned' : 'active'
          });
        } else {
          setUserDetails({
            userId: report.reportedUserId,
            name: report.reportedName,
            nickName: report.reportedName,
            status: 'active'  // 기본값
          });
        }
      } catch (error) {
        // 에러 시에도 기본 정보로 설정
        setUserDetails({
          userId: report.reportedUserId,
          name: report.reportedName,
          nickName: report.reportedName,
          status: 'active'
        });
      } finally {
        setLoadingDetails(false);
      }
    }
  };
  
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedReport(null);
    setShowBlockInput(false);
    setBlockReason('');
    setUserDetails(null);
  };
  
  const handleReportStatusChange = async (reportId, newStatus) => {
    try {
      const result = await updateReportStatus(reportId, newStatus);
      
      if (result.resultCode === 200) {
        alert(result.successMessage || '신고 상태가 변경되었습니다.');
        // 리스트 업데이트
        setReports(reports.map(report => 
          report.reportId === reportId ? { ...report, status: newStatus } : report
        ));
        // 선택된 리포트도 업데이트
        if (selectedReport && selectedReport.reportId === reportId) {
          setSelectedReport({ ...selectedReport, status: newStatus });
        }
      } else {
        alert(result.successMessage || '신고 상태 변경에 실패했습니다.');
      }
    } catch (error) {
      alert('신고 상태 변경에 실패했습니다.');
    }
  };
  
  const handleBlock = async () => {
    if (!blockReason.trim()) {
      alert('차단 사유를 입력해주세요.');
      return;
    }

    if (!window.confirm('정말로 이 회원을 차단하시겠습니까?')) {
      return;
    }

    try {
      // reportedUserId 사용
      const result = await banUser(selectedReport.reportedUserId, blockReason);
      
      if (result.resultCode === 200) {
        alert(result.successMessage || '회원이 차단되었습니다.');
        setUserDetails({ ...userDetails, status: 'banned' });
        setShowBlockInput(false);
        setBlockReason('');
        // 목록 새로고침
        loadReportedUsers(currentPage);
      } else {
        alert(result.successMessage || '회원 차단에 실패했습니다.');
      }
    } catch (error) {
      alert('회원 차단에 실패했습니다.');
    }
  };

  const handleUnblock = async () => {
    if (!window.confirm('정말로 이 회원의 차단을 해제하시겠습니까?')) {
      return;
    }

    try {
      // reportedUserId 사용
      const result = await unbanUser(selectedReport.reportedUserId);
      
      if (result.resultCode === 200) {
        alert(result.successMessage || '차단이 해제되었습니다.');
        setUserDetails({ ...userDetails, status: 'active' });
        // 목록 새로고침
        loadReportedUsers(currentPage);
      } else {
        alert(result.successMessage || '차단 해제에 실패했습니다.');
      }
    } catch (error) {
      alert('차단 해제에 실패했습니다.');
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return '처리 대기';
      case 'resolved': return '처리 완료';
      default: return status;
    }
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  if (reports.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <p>신고 내역이 없습니다.</p>
      </div>
    );
  }

  return (
    <div>
      <table className="users-table">
        <thead>
          <tr>
            <th>신고한 사람</th>
            <th>피신고자</th>
            <th>신고시간</th>
            <th>신고사유</th>
            <th>상태</th>
            <th>신고정보</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(report => (
            <tr key={report.reportId}>
              <td>{report.reporterName}</td>
              <td>{report.reportedName}</td>
              <td>{formatDateTime(report.createdAt)}</td>
              <td>{report.reason}</td>
              <td>
                <span className={`status-badge status-${report.status}`}>
                  {getStatusLabel(report.status)}
                </span>
              </td>
              <td>
                <button
                  className="more-button"
                  onClick={() => handleMoreClick(report)}
                >
                  더보기
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
      
      {/* 신고 상세 모달 */}
      {showModal && selectedReport && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>신고 상세 정보</h3>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            
            <div className="modal-body">
              {loadingDetails ? (
                <div className="loading">사용자 정보 로딩 중...</div>
              ) : (
                <>
                  {/* 회원 상태 표시 */}
                  {userDetails && (
                    <div className="user-status-section">
                      <div className="detail-row">
                        <span className="detail-label">피신고자:</span>
                        <span className="detail-value">{userDetails.name}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">회원 상태:</span>
                        <span className="detail-value">
                          <span className={`status-badge ${userDetails.status === 'banned' ? 'status-banned' : 'status-active'}`}>
                            {userDetails.status === 'banned' ? '차단됨' : '활성'}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* 신고 정보 */}
                  <div className="report-detail-section">
                    <h4>신고 정보</h4>
                    <div className="detail-row">
                      <span className="detail-label">신고 ID:</span>
                      <span className="detail-value">{selectedReport.reportId}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">신고자:</span>
                      <span className="detail-value">{selectedReport.reporterName}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">피신고자:</span>
                      <span className="detail-value">{selectedReport.reportedName}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">신고 사유:</span>
                      <span className="detail-value">{selectedReport.reason}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">신고 일시:</span>
                      <span className="detail-value">{formatDateTime(selectedReport.createdAt)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">처리 상태:</span>
                      <span className="detail-value">
                        <span className={`status-badge status-${selectedReport.status}`}>
                          {getStatusLabel(selectedReport.status)}
                        </span>
                      </span>
                    </div>
                  </div>
                  
                  {/* 신고 처리 */}
                  <div className="modal-actions">
                    <h4>신고 처리</h4>
                    {selectedReport.status === 'pending' ? (
                      <button 
                        className="btn-resolve" 
                        onClick={() => handleReportStatusChange(selectedReport.reportId, 'resolved')}
                      >
                        처리 완료로 변경
                      </button>
                    ) : (
                      <button 
                        className="btn-reopen" 
                        onClick={() => handleReportStatusChange(selectedReport.reportId, 'pending')}
                      >
                        대기중으로 변경
                      </button>
                    )}
                  </div>
                  
                  {/* 회원 차단/해제 */}
                  <div className="modal-actions">
                    <h4>회원 관리</h4>
                    {!userDetails ? (
                      <div className="info-message">
                        ⚠️ 회원 정보를 불러올 수 없어 차단/해제 기능을 사용할 수 없습니다.
                      </div>
                    ) : userDetails.status === 'banned' ? (
                      <button className="btn-unblock" onClick={handleUnblock}>
                        차단 해제
                      </button>
                    ) : (
                      <div>
                        {!showBlockInput ? (
                          <button className="btn-block" onClick={() => setShowBlockInput(true)}>
                            회원 차단
                          </button>
                        ) : (
                          <div className="block-input-group">
                            <textarea
                              className="block-reason-input"
                              placeholder="차단 사유를 입력하세요..."
                              value={blockReason}
                              onChange={(e) => setBlockReason(e.target.value)}
                              rows={3}
                            />
                            <div className="block-buttons">
                              <button className="btn-confirm-block" onClick={handleBlock}>
                                차단 확정
                              </button>
                              <button className="btn-cancel" onClick={() => {
                                setShowBlockInput(false);
                                setBlockReason('');
                              }}>
                                취소
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportedUsersList;

