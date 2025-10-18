import React, { useState, useEffect } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import AllUsersList from './AllUsersList';
import ReportedUsersList from './ReportedUsersList';
import BlockedUsersList from './BlockedUsersList';
import './UsersPage.css';

const UsersPage = () => {
  const [activeTab, setActiveTab] = useState('all');

  const tabs = [
    { id: 'all', label: '전체 회원' },
    { id: 'reported', label: '신고받은 회원' },
    { id: 'blocked', label: '차단된 회원' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'all':
        return <AllUsersList />;
      case 'reported':
        return <ReportedUsersList />;
      case 'blocked':
        return <BlockedUsersList />;
      default:
        return <AllUsersList />;
    }
  };

  return (
    <AdminLayout>
      <div className="users-page">
        <div className="users-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="users-content">
          {renderContent()}
        </div>
      </div>
    </AdminLayout>
  );
};

export default UsersPage;
