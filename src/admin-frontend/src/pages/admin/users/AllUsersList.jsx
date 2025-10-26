import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS, getAuthHeaders } from '../../../utils/api';
import Pagination from './Pagination';

const AllUsersList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // TODO: 여기에 API 필요합니다 - 전체 회원 조회 API
  useEffect(() => {
    fetchUsers(currentPage);
  }, [currentPage]);

  const fetchUsers = async (page) => {
    setLoading(true);
    
    // 임시 데이터
    setTimeout(() => {
      const mockUsers = Array.from({ length: 10 }, (_, index) => ({
        id: (page - 1) * 10 + index + 1,
        name: `김OO${(page - 1) * 10 + index + 1}`,
        nickName: `닉네임${(page - 1) * 10 + index + 1}`,
        techStack: 'React, Spring',
        phoneNumber: '010-1234-5678',
        birth: '1999-07-21',
        address: '경기 고양시'
      }));

      setUsers(mockUsers);
      setTotalPages(5);
      setTotalElements(50);
      setLoading(false);
    }, 500);

    /* 실제 API 호출 예시
    try {
      const response = await fetch(`${API_ENDPOINTS.USERS_ALL}?page=${page}&size=10`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      
      if (data.result_code === 200) {
        setUsers(data.data.users);
        setTotalPages(data.data.totalPages);
        setTotalElements(data.data.totalElements);
      } else {
        console.error('전체 회원 조회 실패');
      }
      setLoading(false);
    } catch (error) {
      console.error('전체 회원 조회 실패:', error);
      setLoading(false);
    }
    */
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  if (users.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">👥</div>
        <p>등록된 회원이 없습니다.</p>
      </div>
    );
  }

  return (
    <div>
      <table className="users-table">
        <thead>
          <tr>
            <th>이름</th>
            <th>닉네임</th>
            <th>주요스택</th>
            <th>전화번호</th>
            <th>생일</th>
            <th>거주지</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.nickName}</td>
              <td>{user.techStack}</td>
              <td>{user.phoneNumber}</td>
              <td>{user.birth}</td>
              <td>{user.address}</td>
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

export default AllUsersList;

