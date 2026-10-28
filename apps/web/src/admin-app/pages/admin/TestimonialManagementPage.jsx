import { useState, useEffect, useCallback } from 'react';
import { adminResource } from '../../lib/api/resources/admin';

export default function TestimonialManagementPage() {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newTestimonial, setNewTestimonial] = useState({
    name: '',
    role: '',
    text: '',
    avatar: '👤',
    rating: 5,
  });

  const loadTestimonials = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await adminResource.listTestimonials();
      setTestimonials(rows);
    } catch (err) {
      setError('Failed to load testimonials: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTestimonials();
  }, [loadTestimonials]);

  const handleAdd = async () => {
    if (!newTestimonial.name || !newTestimonial.text) {
      setError('Name and text are required');
      return;
    }

    try {
      setError('');
      await adminResource.createTestimonial(newTestimonial);
      setNewTestimonial({ name: '', role: '', text: '', avatar: '👤', rating: 5 });
      await loadTestimonials();
    } catch (err) {
      setError('Failed to add testimonial: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this testimonial?')) {
      try {
        setError('');
        await adminResource.removeTestimonial(id);
        await loadTestimonials();
      } catch (err) {
        setError('Failed to delete: ' + err.message);
      }
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-lg font-bold text-white mb-6">Testimonials</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 space-y-3">
        <h2 className="font-semibold text-white">Add Testimonial</h2>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input
            type="text"
            value={newTestimonial.name}
            onChange={(e) => setNewTestimonial({ ...newTestimonial, name: e.target.value })}
            placeholder="Marina Silva"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Role</label>
          <input
            type="text"
            value={newTestimonial.role}
            onChange={(e) => setNewTestimonial({ ...newTestimonial, role: e.target.value })}
            placeholder="Freelancer"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Review Text</label>
          <textarea
            value={newTestimonial.text}
            onChange={(e) => setNewTestimonial({ ...newTestimonial, text: e.target.value })}
            placeholder="What did you love about Realwise?"
            rows="3"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Avatar (emoji)</label>
          <input
            type="text"
            value={newTestimonial.avatar}
            onChange={(e) => setNewTestimonial({ ...newTestimonial, avatar: e.target.value })}
            placeholder="👤"
            maxLength="2"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Rating (1-5)</label>
          <input
            type="number"
            min="1"
            max="5"
            value={newTestimonial.rating}
            onChange={(e) => setNewTestimonial({ ...newTestimonial, rating: parseInt(e.target.value, 10) })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={loading}
          className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {loading ? 'Adding...' : 'Add Testimonial'}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="space-y-3">
        <h2 className="font-semibold text-white mb-4">Active Testimonials ({testimonials.length})</h2>
        {testimonials.length === 0 ? (
          <p className="text-gray-400 text-sm">No testimonials yet</p>
        ) : (
          testimonials.map((testimonial) => (
            <div key={testimonial.id} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{testimonial.avatar}</span>
                    <span className="font-semibold text-white">{testimonial.name}</span>
                    {testimonial.role && <span className="text-xs text-gray-400">· {testimonial.role}</span>}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {[...Array(testimonial.rating || 5)].map((_, i) => (
                      <span key={i} className="text-amber-400">⭐</span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(testimonial.id)}
                  className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                >
                  Delete
                </button>
              </div>
              <p className="text-sm text-gray-300">"{testimonial.text}"</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
