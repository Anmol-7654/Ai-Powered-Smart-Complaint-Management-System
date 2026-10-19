import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ComplaintCard from '../components/ComplaintCard';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState('');
  const [insightsError, setInsightsError] = useState('');
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [statsRes, listRes] = await Promise.all([
          api.get('/complaints/stats/summary'),
          api.get('/complaints'),
        ]);

        setStats(statsRes.data);
        setRecent(Array.isArray(listRes.data.complaints) ? listRes.data.complaints.slice(0, 4) : []);
      } catch (error) {
        console.error('Failed to load dashboard', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') return;

    const loadInsights = async () => {
      setInsightsLoading(true);
      setInsightsError('');
      try {
        const { data } = await api.get('/ai/insights');
        setInsights(data.insights);
      } catch (error) {
        setInsightsError(error.response?.data?.message || 'AI insights could not be loaded.');
      } finally {
        setInsightsLoading(false);
      }
    };

    loadInsights();
  }, [user?.role]);

  const renderBars = (items, emptyLabel) => {
    if (!items?.length) return <p className="empty-copy">{emptyLabel}</p>;
    const maxCount = Math.max(...items.map((item) => item.count), 1);
    return (
      <div className="analytics-bars">
        {items.map((item) => (
          <div className="analytics-bar-row" key={item._id}>
            <div className="analytics-bar-label">
              <span>{item.label || item._id}</span>
              <strong>{item.count}</strong>
            </div>
            <div className="analytics-bar-track">
              <span style={{ width: `${Math.max((item.count / maxCount) * 100, 3)}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const cards = stats
    ? [
        { label: 'Total complaints', value: stats.total },
        { label: 'Open', value: stats.open },
        { label: 'In Progress', value: stats.inProgress },
        { label: 'Resolved', value: stats.resolved },
        { label: 'Closed', value: stats.closed },
        { label: 'Rejected', value: stats.rejected },
      ]
    : [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="eyebrow">{user?.role === 'admin' ? 'Admin overview' : 'Your overview'}</span>
          <h1>Hello, {user?.name?.split(' ')[0] || 'there'}</h1>
        </div>

        <Link to="/complaints/new" className="btn btn--primary">
          File a complaint
        </Link>
      </div>

      {loading ? (
        <p className="loading-text">Loading the queue...</p>
      ) : (
        <>
          <div className="stat-grid">
            {cards.map((card) => (
              <div className="stat-card" key={card.label}>
                <span className="stat-card-value">{card.value}</span>
                <span className="stat-card-label">{card.label}</span>
              </div>
            ))}
          </div>

          {user?.role === 'admin' && stats ? (
            <section className="admin-analytics">
              <div className="section-head">
                <div>
                  <span className="eyebrow">Operations</span>
                  <h2>Complaint analytics</h2>
                </div>
                <span className="analytics-caption">Live data from complaint records</span>
              </div>

              <div className="analytics-grid">
                <article className="detail-panel analytics-panel">
                  <h3>By category</h3>
                  {renderBars(stats.byCategory, 'No category data yet.')}
                </article>
                <article className="detail-panel analytics-panel">
                  <h3>By department</h3>
                  {renderBars(stats.byDepartment, 'No department data yet.')}
                </article>
                <article className="detail-panel analytics-panel">
                  <h3>Monthly volume</h3>
                  {renderBars(
                    stats.byMonth?.map((item) => ({
                      ...item,
                      label: new Date(`${item._id}-01T00:00:00`).toLocaleDateString('en-US', {
                        month: 'short',
                        year: '2-digit',
                      }),
                    })),
                    'No monthly complaint data yet.'
                  )}
                </article>
                <article className="detail-panel analytics-panel">
                  <h3>AI insights</h3>
                  {insightsLoading ? (
                    <p className="loading-text">Analyzing complaint trends...</p>
                  ) : insightsError ? (
                    <p className="form-error" role="alert">{insightsError}</p>
                  ) : (
                    <ol className="insights-list">
                      {insights.split(/\n+/).filter(Boolean).map((item, index) => (
                        <li key={`${index}-${item}`}>{item.replace(/^\s*(?:\d+[.)]|[-*])\s*/, '')}</li>
                      ))}
                    </ol>
                  )}
                </article>
              </div>
            </section>
          ) : null}

          <div className="section-head">
            <h2>Recent tickets</h2>
            <Link to="/complaints">View all</Link>
          </div>

          {recent.length === 0 ? (
            <div className="empty-state">
              <p>No tickets yet. Filing your first complaint takes under a minute.</p>
              <Link to="/complaints/new" className="btn btn--primary">
                File a complaint
              </Link>
            </div>
          ) : (
            <div className="ticket-list">
              {recent.map((complaint) => (
                <ComplaintCard key={complaint._id || complaint.complaintId} complaint={complaint} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;