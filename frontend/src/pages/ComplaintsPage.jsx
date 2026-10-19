import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import ComplaintCard from '../components/ComplaintCard';
import { useAuth } from '../context/AuthContext';

const categoryOptions = ['Billing', 'Product Quality', 'Service', 'Delivery', 'Technical', 'Staff behavior', 'other'];
const statusOptions = ['Open', 'In Progress', 'Resolved', 'Closed', 'Rejected'];
const priorityOptions = ['Low', 'Medium', 'High', 'Urgent'];

const ComplaintsPage = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', category: '', priority: '', search: '' });

  useEffect(() => {
    const loadComplaints = async () => {
      setLoading(true);

      try {
        const query = new URLSearchParams();

        if (filters.status) query.set('status', filters.status);
        if (filters.category) query.set('category', filters.category);
        if (filters.priority) query.set('priority', filters.priority);
        if (filters.search) query.set('search', filters.search);

        const { data } = await api.get(`/complaints?${query.toString()}`);
        setComplaints(Array.isArray(data.complaints) ? data.complaints : []);
      } catch (error) {
        console.error('Failed to load complaints', error);
        setComplaints([]);
      } finally {
        setLoading(false);
      }
    };

    loadComplaints();
  }, [filters]);

  const filterSummary = useMemo(() => {
    const active = Object.values(filters).filter(Boolean).length;
    return active ? `${active} filter${active > 1 ? 's' : ''} active` : 'All complaints';
  }, [filters]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  return (
    <div className="page">
      <div className="page-header page-header--row">
        <div>
          <span className="eyebrow">Complaints</span>
          <h1>Ticket list</h1>
        </div>

        <Link to="/complaints/new" className="btn btn--primary">
          New complaint
        </Link>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          name="search"
          placeholder={user?.role === 'admin'
            ? 'Search ID, title, details, user name or email'
            : 'Search tickets or keywords'}
          aria-label={user?.role === 'admin'
            ? 'Search complaints and reporting users'
            : 'Search complaints'}
          value={filters.search}
          onChange={handleFilterChange}
        />

        <select name="status" value={filters.status} onChange={handleFilterChange}>
          <option value="">All statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select name="category" value={filters.category} onChange={handleFilterChange}>
          <option value="">All categories</option>
          {categoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select name="priority" value={filters.priority} onChange={handleFilterChange}>
          <option value="">All priorities</option>
          {priorityOptions.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </div>

      <div className="section-head">
        <h2>{filterSummary}</h2>
      </div>

      {loading ? (
        <p className="loading-text">Loading complaints...</p>
      ) : complaints.length === 0 ? (
        <div className="empty-state">
          <p>No complaints match the current filters.</p>
        </div>
      ) : (
        <div className="ticket-list">
          {complaints.map((complaint) => (
            <ComplaintCard key={complaint._id || complaint.complaintId} complaint={complaint} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ComplaintsPage;
