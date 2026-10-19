const STATUS_CLASS = {
  Open: 'badge-open',
  'In Progress': 'badge-progress',
  Resolved: 'badge-resolved',
  Closed: 'badge-closed',
  Rejected: 'badge-rejected',
};

const StatusBadge = ({ status = 'Open' }) => {
  return <span className={`status-badge ${STATUS_CLASS[status] || 'badge-open'}`}>{status}</span>;
};

export default StatusBadge;