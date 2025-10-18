import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Pagination from './Pagination';

const ReportedUsersList = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // TODO: 여기에 API 필요합니다 - 신고된 회원 목록 조회 API
  useEffect(() => {
    fetchReportedUsers(currentPage);
  }, [currentPage]);

  const fetchReportedUsers = async (page) => {
    setLoading(true);
    
    // 임시 데이터
    setTimeout(() => {
      const mockReports = Array.from({ length: 10 }, (_, index) => ({
        reportId: (page - 1) * 10 + index + 1,
        reporterName: `신고자${(page - 1) * 10 + index + 1}`,
        reportedName: `피신고자${(page - 1) * 10 + index + 1}`,
        reason: '시간 약속을 안 지킴',
        createdAt: '2025-09-30T14:00:00Z',
        status: index % 2 === 0 ? 'pending' : 'resolved'
      }));

      setReports(mockReports);
      setTotalPages(3);
      setTotalElements(25);
      setLoading(false);
    }, 500);

    /* 실제 API 호출 예시
    try {
      const response = await fetch(`/api/admin/reports?page=${page}&size=10`);
      const data = await response.json();
      
      setReports(data.data.reports);
      setTotalPages(data.data.totalPages);
      setTotalElements(data.data.totalElements);
      setLoading(false);
    } catch (error) {
      console.error('신고된 회원 조회 실패:', error);
      setLoading(false);
    }
    */
  };

  const handleMoreClick = (reportId) => {
    navigate(`/admin/users/report-detail/${reportId}`);
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
                  onClick={() => handleMoreClick(report.reportId)}
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
    </div>
  );
};

export default ReportedUsersList;

