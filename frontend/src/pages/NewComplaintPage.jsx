import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const NewComplaintPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    attachmentUrl: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/complaints', form);
      navigate(`/complaints/${data.complaint._id || data.complaint.id}`, {
        state: { notificationWarning: data.notificationWarning || '' },
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Complaint could not be created.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="eyebrow">New complaint</span>
          <h1>File a support ticket</h1>
        </div>
      </div>

      <form className="form-card" onSubmit={handleSubmit}>
        {error ? <div className="form-error">{error}</div> : null}

        <label>
          Title
          <input
            type="text"
            name="title"
            placeholder="Brief summary of the issue"
            value={form.title}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Description
          <textarea
            name="description"
            rows="6"
            placeholder="Describe the problem, what happened, and what outcome you expect"
            value={form.description}
            onChange={handleChange}
            required
          />
        </label>

        <p className="ai-analysis-note">
          After submission, AI will classify your complaint, set its priority and department, and prepare a short summary.
        </p>

        <label>
          Attachment URL (optional)
          <input
            type="url"
            name="attachmentUrl"
            placeholder="https://example.com/receipt.pdf"
            value={form.attachmentUrl}
            onChange={handleChange}
          />
        </label>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/complaints')}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? 'Analyzing and submitting...' : 'Analyze & submit complaint'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewComplaintPage;
