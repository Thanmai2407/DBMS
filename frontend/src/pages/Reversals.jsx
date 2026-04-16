import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import client from '../api/client';

export default function Reversals() {
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    client.get('/reversals/pending').then(r => setPending(r.data));
    client.get('/reversals/history').then(r => setHistory(r.data));
  }, []);

  const resolve = async (id, resolution) => {
    try {
      await client.post('/reversals/resolve', { request_id: id, resolution });
      setPending(pending.filter(r => r.request_id !== id));
      client.get('/reversals/history').then(r => setHistory(r.data));
    } catch (e) { alert(e.response?.data?.error); }
  };

  const statusColor = s => ({ PENDING:'#d97706', APPROVED:'#16a34a', REJECTED:'#dc2626', EXPIRED:'#9ca3af' }[s] || '#6b7280');

  return (
    <div style={{ fontFamily:'sans-serif', background:'#f8fafc', minHeight:'100vh' }}>
      <Navbar />
      <div style={{ padding:24, maxWidth:900, margin:'0 auto' }}>
        <h2 style={{ color:'#1e3a5f' }}>↩️ Transaction Reversals</h2>

        <div style={card}>
          <h3 style={{ margin:'0 0 16px', color:'#1e3a5f' }}>Pending Requests (as Receiver)</h3>
          {!pending.length && <p style={{ color:'#9ca3af' }}>No pending reversal requests on your accounts</p>}
          {pending.map(r => (
            <div key={r.request_id} style={{ border:'1px solid #fde68a', background:'#fffbeb', borderRadius:8, padding:16, marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <strong>₹{parseFloat(r.amount).toFixed(2)}</strong>
                <span style={{ fontSize:12, color:'#6b7280' }}>Expires: {new Date(r.expires_at).toLocaleString()}</span>
              </div>
              <p style={{ margin:'6px 0', fontSize:13 }}>{r.description}</p>
              <p style={{ margin:'4px 0', fontSize:12, color:'#6b7280' }}>Reason: {r.reason}</p>
              <div style={{ display:'flex', gap:8, marginTop:10 }}>
                <button onClick={() => resolve(r.request_id, 'APPROVED')}
                  style={{ padding:'8px 16px', background:'#16a34a', color:'white', border:'none', borderRadius:6, cursor:'pointer' }}>
                  ✅ Approve Reversal
                </button>
                <button onClick={() => resolve(r.request_id, 'REJECTED')}
                  style={{ padding:'8px 16px', background:'#dc2626', color:'white', border:'none', borderRadius:6, cursor:'pointer' }}>
                  ❌ Reject
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...card, marginTop:20 }}>
          <h3 style={{ margin:'0 0 16px', color:'#1e3a5f' }}>Reversal History</h3>
          {history.map(r => (
            <div key={r.request_id} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f3f4f6', fontSize:13 }}>
              <span>{r.description} — ₹{parseFloat(r.amount).toFixed(2)}</span>
              <span style={{ color: statusColor(r.status), fontWeight:'bold' }}>{r.status}</span>
            </div>
          ))}
          {!history.length && <p style={{ color:'#9ca3af' }}>No reversal history</p>}
        </div>
      </div>
    </div>
  );
}
const card = { background:'white', border:'1px solid #e5e7eb', borderRadius:10, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' };