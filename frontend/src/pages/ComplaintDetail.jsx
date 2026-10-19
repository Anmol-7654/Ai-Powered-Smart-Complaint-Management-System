import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';

const statusOptions = ['Open', 'In Progress', 'Resolved', 'Closed', 'Rejected'];
const departmentOptions = [
  'Billing/Finance',
  'Quality Assurance',
  'Customer Service',
  'Logistics',
  'IT/Technical Support',
  'HR/Customer Relations',
  'General Support',
];

const ComplaintDetailPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Open');
  const [department, setDepartment] = useState('General Support');
  const [assignedTo, setAssignedTo] = useState('');
  const [admins, setAdmins] = useState([]);
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const [notificationWarning, setNotificationWarning] = useState(
    location.state?.notificationWarning || ''
  );
  const [emailWarning, setEmailWarning] = useState('');

  const loadComplaint = async () => {
    setLoading(true);

    try {
      const { data } = await api.get(`/complaints/${id}`);
      setComplaint(data.complaint);
      setStatus(data.complaint.status || 'Open');
      setDepartment(data.complaint.department || 'General Support');
      setAssignedTo(data.complaint.assignedTo?._id || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load this complaint.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplaint();
  }, [id]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    api.get('/users/admins')
      .then(({ data }) => setAdmins(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.response?.data?.message || 'Unable to load admin assignees.'));
  }, [user?.role]);

  const handleStatusUpdate = async () => {
    try {
      const { data } = await api.patch(`/complaints/${id}/status`, { status, note, department, assignedTo });
      setNotificationWarning(data.notificationWarning || '');
      setEmailWarning(data.emailWarning || '');
      setNote('');
      await loadComplaint();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update status.');
    }
  };

  const handleCommentSubmit = async () => {
    if (!comment.trim()) {
      return;
    }

    try {
      const { data } = await api.post(`/complaints/${id}/comments`, { message: comment });
      setNotificationWarning(data.notificationWarning || '');
      setComment('');
      await loadComplaint();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to add the comment.');
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm('Delete this complaint?');
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/complaints/${id}`);
      navigate('/complaints');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete complaint.');
    }
  };

  if (loading) {
    return <div className="page"><p className="loading-text">Loading complaint details...</p></div>;
  }

  if (!complaint) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>{error || 'Complaint not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header page-header--row">
        <div>
          <span className="eyebrow">{complaint.complaintId}</span>
          <h1>{complaint.title}</h1>
        </div>

        <div className="inline-actions">
          <StatusBadge status={complaint.status} />
          {user?.role === 'admin' ? (
            <button type="button" className="btn btn--danger" onClick={handleDelete}>
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {notificationWarning ? (
        <div className="notification-warning" role="status">{notificationWarning}</div>
      ) : null}
      {emailWarning ? (
        <div className="notification-warning" role="status">{emailWarning}</div>
      ) : null}

      <div className="detail-grid">
        <section className="detail-panel">
          <h2>Complaint details</h2>
          <p>{complaint.description}</p>

          {complaint.summary ? (
            <div className="ai-summary">
              <span className="eyebrow">AI summary</span>
              <p>{complaint.summary}</p>
            </div>
          ) : null}

          <div className="meta-list">
            <div>
              <span>Category</span>
              <strong>{complaint.category}</strong>
            </div>
            <div>
              <span>Priority</span>
              <strong>{complaint.priority}</strong>
            </div>
            <div>
              <span>Filed by</span>
              <strong>{complaint.submittedBy?.name || 'Unknown user'}</strong>
              {user?.role === 'admin' && complaint.submittedBy?.email ? (
                <small>{complaint.submittedBy.email}</small>
              ) : null}
            </div>
            <div>
              <span>Department</span>
              <strong>{complaint.department || 'General Support'}</strong>
            </div>
            <div>
              <span>Assigned</span>
              <strong>{complaint.assignedTo?.name || 'Unassigned'}</strong>
            </div>
            {user?.role === 'admin' && complaint.ipAddress ? (
              <div>
                <span>Submitter IP address</span>
                <strong>{complaint.ipAddress}</strong>
              </div>
            ) : null}
          </div>

          {complaint.attachmentUrl ? (
            <a href={complaint.attachmentUrl} target="_blank" rel="noreferrer" className="attachment-link">
              Open attachment
            </a>
          ) : null}
        </section>

        {user?.role === 'admin' ? (
          <aside className="detail-panel">
            <h2>Manage complaint</h2>
            <label>
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {statusOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Department
              <select value={department} onChange={(event) => setDepartment(event.target.value)}>
                {departmentOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label>
              Assign administrator
              <select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
                <option value="">Unassigned</option>
                {admins.map((admin) => (
                  <option key={admin._id} value={admin._id}>{admin.name} ({admin.email})</option>
                ))}
              </select>
            </label>

            <label>
              Note
              <textarea
                rows="4"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add a status update"
              />
            </label>

            <button type="button" className="btn btn--primary" onClick={handleStatusUpdate}>
              Save changes
            </button>
          </aside>
        ) : null}
      </div>

      <section className="detail-panel">
        <h2>Comments</h2>

        {complaint.comments && complaint.comments.length > 0 ? (
          <div className="comment-list">
            {complaint.comments.map((item) => (
              <div key={`${item.author}-${item.createdAt}`} className="comment-item">
                <strong>{item.authorName}</strong>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
                <p>{item.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-copy">No comments yet.</p>
        )}

        <div className="comment-form">
          <textarea
            rows="3"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Write an update or question..."
          />
          <button type="button" className="btn btn--primary" onClick={handleCommentSubmit}>
            Add comment
          </button>
        </div>
      </section>

      {complaint.history && complaint.history.length > 0 ? (
        <section className="detail-panel">
          <h2>History</h2>
          <ul className="history-list">
            {complaint.history.map((entry, index) => (
              <li key={`${entry.status}-${index}`}>
                <StatusBadge status={entry.status} />
                <span>{entry.note || 'Status updated'}</span>
                <small>{new Date(entry.changedAt || entry.createdAt).toLocaleString()}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};

export default ComplaintDetailPage;
