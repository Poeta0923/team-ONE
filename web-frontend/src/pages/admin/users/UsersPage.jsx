import React from 'react';
import AdminLayout from '../../../components/AdminLayout';
import './UsersPage.css';

const UsersPage = () => {
  return (
    <AdminLayout>
      <div className="users-content">
        <div className="content-header">
          <h2>회원 관리</h2>
          <button className="btn btn-primary">새 회원 추가</button>
        </div>
        
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
                <th>이메일</th>
                <th>가입일</th>
                <th>상태</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>김개발</td>
                <td>kim@example.com</td>
                <td>2024-01-15</td>
                <td><span className="status active">활성</span></td>
                <td>
                  <button className="btn-small btn-outline">수정</button>
                  <button className="btn-small btn-danger">삭제</button>
                </td>
              </tr>
              <tr>
                <td>2</td>
                <td>이백엔드</td>
                <td>lee@example.com</td>
                <td>2024-01-20</td>
                <td><span className="status active">활성</span></td>
                <td>
                  <button className="btn-small btn-outline">수정</button>
                  <button className="btn-small btn-danger">삭제</button>
                </td>
              </tr>
              <tr>
                <td>3</td>
                <td>박디자인</td>
                <td>park@example.com</td>
                <td>2024-02-01</td>
                <td><span className="status inactive">비활성</span></td>
                <td>
                  <button className="btn-small btn-outline">수정</button>
                  <button className="btn-small btn-danger">삭제</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default UsersPage;
