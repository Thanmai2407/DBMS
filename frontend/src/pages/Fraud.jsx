import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import client from '../api/client';

export default function Fraud() {
  const [flags, setFlags] = useState([]);
  const [summary, setSummary] = useState([]);

  useEffect(() => {
    client.get('/fraud/flags').then(r => setFlags(r.data));
    client.get('/fraud/summary').then(r => setSummary(r.data));
  }, []);

  const resolve = async (id) => {
    await client.put(`/fraud/resolve/${id}`);
    setFlags(flags.map(f => f.flag_id === id ? {...f, status:'RESOLVED'} : f));
  };

  const sevColor = s => ({ HIGH:'#dc2626', MEDIUM:'#d97706', LOW:'#16a34a' }[s] || '#6b7280');

  return (
    <div style={{ fontFamily:'sans-serif', background:'#f8fafc', minHeight:'100vh' }}>
      <Navbar />
      <div style={{ padding:24, maxWidth:1000, margin:'0 auto' }}>
        <h2 style={{ color:'#1e3a5f' }}>🚨 Fraud Detection Dashboard</h2>

        {summary.length > 0 && (
          <div style={{ display:'flex', gap:16, marginBottom:24 }}>
            {summary.map(s => (
              <div key={s.account_id} style={{ ...card, flex:1 }}>
                <div style={{ fontSize:12, color:'#6b7280' }}>Account Summary</div>
                <div style={{ fontSize:24, fontWeight:'bold', color: s.high_severity > 0 ? '#dc2626' : '#16a34a' }}>
                  {s.total_flags} flags
                </div>
                <div style={{ fontSize:12, color:'#6b7280' }}>{s.high_severity} HIGH · {s.open_flags} open</div>
              </div>
            ))}
          </div>
        )}

        <div style={card}>
          <h3 style={{ margin:'0 0 16px', color:'#1e3a5f' }}>Fraud Flags</h3>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f1f5f9' }}>
                {['Rule Triggered','Severity','Transaction','Detected At','Status','Action'].map(h => (
                  <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:600, color:'#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flags.map(f => (
                <tr key={f.flag_id} style={{ borderBottom:'1px solid #f3f4f6', background: f.status === 'OPEN' ? '#fff7ed' : 'white' }}>
                  <td style={{ padding:'10px 12px', fontWeight:'bold' }}>{f.rule_triggered}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <span style={{ color: sevColor(f.severity), fontWeight:'bold' }}>{f.severity}</span>
                  </td>
                  <td style={{ padding:'10px 12px', fontSize:11, color:'#6b7280' }}>
                    {f.amount ? `₹${parseFloat(f.amount).toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding:'10px 12px', fontSize:11 }}>{new Date(f.created_at).toLocaleString()}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:8, background: f.status==='OPEN' ? '#fef3c7' : '#dcfce7', color: f.status==='OPEN' ? '#92400e' : '#166534' }}>
                      {f.status}
                    </span>
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    {f.status === 'OPEN' && (
                      <button onClick={() => resolve(f.flag_id)}
                        style={{ padding:'4px 8px', fontSize:11, background:'#dcfce7', border:'1px solid #16a34a', borderRadius:4, cursor:'pointer' }}>
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!flags.length && <tr><td colSpan={6} style={{ padding:24, textAlign:'center', color:'#9ca3af' }}>No fraud flags detected</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
const card = { background:'white', border:'1px solid #e5e7eb', borderRadius:10, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' };