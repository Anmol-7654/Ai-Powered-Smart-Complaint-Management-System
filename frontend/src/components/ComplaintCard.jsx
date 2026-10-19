import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { useAuth } from '../context/AuthContext';

const ComplaintCard = ({ complaint }) => {
  const { user } = useAuth();
  if (!complaint) {
    return null;
  }

  const date = complaint.createdAt
    ? new Date(complaint.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently';

  const complaintId = complaint._id || complaint.id;

  return (
    <Link to={`/complaints/${complaintId}`} className="ticket-card">
      <div className="ticket-main">
        <div className="ticket-id">{complaint.complaintId || 'CMP-'}</div>
        <h3 className="ticket-title">{complaint.title}</h3>
        {complaint.summary ? <p className="ticket-summary">{complaint.summary}</p> : null}
        <p className="ticket-meta">
          {complaint.category}. filed {date}
          {complaint.submittedBy?.name ? ` · ${complaint.submittedBy.name}` : ''}
          {user?.role === 'admin' && complaint.submittedBy?.email
            ? ` · ${complaint.submittedBy.email}`
            : ''}
        </p>
      </div>
      <div className="ticket-perforation" aria-hidden="true" />
      <div className="ticket-stub">
        <StatusBadge status={complaint.status} />
        <span className={`priority priority--${(complaint.priority || 'medium').toLowerCase()}`}>
          {complaint.priority || 'Medium'}
        </span>
      </div>
    </Link>
  );
};

export default ComplaintCard;