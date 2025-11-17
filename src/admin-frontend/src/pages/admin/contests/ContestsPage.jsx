import React, { useState, useEffect } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import Pagination from '../users/Pagination';
import { fetchContests, createContest, deleteContest } from '../../../utils/api';
import './ContestsPage.css';

const ContestsPage = () => {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [newContestName, setNewContestName] = useState('');

  useEffect(() => {
    loadContests(currentPage);
  }, [currentPage]);

  const loadContests = async (page) => {
    setLoading(true);
    
    try {
      const result = await fetchContests(page - 1, 10);
      
      if (result.resultCode === 200) {
        setContests(result.data.contests);
        setTotalElements(result.data.totalElements);
        setTotalPages(result.data.totalPages);
      }
    } catch (error) {
      // Error handling
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContest = async () => {
    if (!newContestName.trim()) {
      alert('공모전 이름을 입력해주세요.');
      return;
    }

    try {
      const result = await createContest(newContestName);
      
      if (result.resultCode === 200) {
        alert(result.successMessage || '공모전이 등록되었습니다.');
        setShowModal(false);
        setNewContestName('');
        loadContests(currentPage); // 목록 새로고침
      } else {
        alert(result.successMessage || '공모전 등록에 실패했습니다.');
      }
    } catch (error) {
      alert('공모전 등록 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteContest = async (contestId, contestName) => {
    if (!confirm(`"${contestName}" 공모전을 정말 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const result = await deleteContest(contestId);
      
      if (result.resultCode === 200) {
        alert(result.successMessage || '공모전이 삭제되었습니다.');
        loadContests(currentPage); // 목록 새로고침
      } else {
        alert(result.successMessage || '공모전 삭제에 실패했습니다.');
      }
    } catch (error) {
      alert('공모전 삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="contests-page">
          <div className="loading">로딩 중...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="contests-page">
        <div className="contests-content">
          <div className="contests-header">
            <h2>공모전 관리</h2>
            <button className="create-contest-button" onClick={() => setShowModal(true)}>
              새 공모전 등록
            </button>
          </div>

          {contests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏆</div>
              <p>등록된 공모전이 없습니다.</p>
            </div>
          ) : (
            <>
              <table className="contests-table">
                <thead>
                  <tr>
                    <th>번호</th>
                    <th>공모전 이름</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {contests.map((contest) => (
                    <tr key={contest.contestId}>
                      <td>{contest.contestId}</td>
                      <td>{contest.name}</td>
                      <td>
                        <button
                          className="delete-button"
                          onClick={() => handleDeleteContest(contest.contestId, contest.name)}
                        >
                          삭제하기
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
            </>
          )}
        </div>

        {/* 공모전 등록 모달 */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>새 공모전 등록</h3>
              <input
                type="text"
                className="contest-input"
                placeholder="공모전 이름을 입력하세요"
                value={newContestName}
                onChange={(e) => setNewContestName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateContest();
                  }
                }}
              />
              <div className="modal-buttons">
                <button className="btn-confirm" onClick={handleCreateContest}>
                  등록
                </button>
                <button className="btn-cancel" onClick={() => {
                  setShowModal(false);
                  setNewContestName('');
                }}>
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default ContestsPage;
