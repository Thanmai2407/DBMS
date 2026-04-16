import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import client from '../api/client';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

export default function Analytics() {
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState('');
  const [spending, setSpending] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [rolling, setRolling] = useState([]);
  const [percentile, setPercentile] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);

  useEffect(() => {
    client.get('/accounts').then(r => {
      setAccounts(r.data);
      if (r.data.length) setSelected(r.data[0].account_id);
    });
    client.get('/analytics/audit-trail').then(r => setAuditTrail(r.data));
  }, []);

  useEffect(() => {
    if (!selected) return;
    client.get(`/analytics/spending/${selected}`).then(r => setSpending(r.data));
    client.get(`/analytics/forecast/${selected}`).then(r => setForecast(r.data));
    client.get(`/analytics/rolling/${selected}`).then(r => setRolling(r.data));
    client.get(`/analytics/percentile/${selected}`).then(r => setPercentile(r.data));
  }, [selected]);

  return (
    <div style={{ fontFamily:'sans-serif', background:'#f8fafc', minHeight:'100vh' }}>
      <Navbar />
      <div style={{ padding:24, maxWidth:1200, margin:'0 auto' }}>
        <h2 style={{ color:'#1e3a5f' }}>📊 Analytics Dashboard</h2>

        <div style={{ marginBottom:20 }}>
          <label style={{ fontWeight:600, marginRight:10, color:'#374151' }}>Account:</label>
          <select value={selected} onChange={e => setSelected(e.target.value)}
            style={{ padding:'8px 12px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13 }}>
            {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_type} — ₹{parseFloat(a.balance || 0).toFixed(2)}</option>)}
          </select>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
          {/* Spending by category */}
          <div style={card}>
            <h3 style={{ margin:'0 0 12px', color:'#1e3a5f' }}>This Month by Category</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={spending}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize:11 }} />
                <YAxis tick={{ fontSize:11 }} />
                <Tooltip formatter={v => `₹${parseFloat(v).toLocaleString()}`} />
                <Bar dataKey="total_spent" fill="#2563eb" name="Spent" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast */}
          <div style={card}>
            <h3 style={{ margin:'0 0 12px', color:'#1e3a5f' }}>Month-End Forecast</h3>
            <table style={{ width:'100%', fontSize:13, borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f1f5f9' }}>
                  {['Category','Daily Avg','Projected Month','Remaining'].map(h => (
                    <th key={h} style={{ padding:'6px 10px', textAlign:'left', fontWeight:600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {forecast.map(f => (
                  <tr key={f.category} style={{ borderBottom:'1px solid #f3f4f6' }}>
                    <td style={{ padding:'6px 10px' }}>{f.category}</td>
                    <td style={{ padding:'6px 10px' }}>₹{parseFloat(f.daily_avg).toFixed(0)}</td>
                    <td style={{ padding:'6px 10px', color:'#dc2626' }}>₹{parseFloat(f.projected_monthly).toFixed(0)}</td>
                    <td style={{ padding:'6px 10px', color:'#d97706' }}>₹{parseFloat(f.remaining_projected).toFixed(0)}</td>
                  </tr>
                ))}
                {!forecast.length && <tr><td colSpan={4} style={{ padding:12, color:'#9ca3af', textAlign:'center' }}>No forecast data</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Rolling 7-day average */}
          <div style={card}>
            <h3 style={{ margin:'0 0 12px', color:'#1e3a5f' }}>Rolling 7-Day Avg Spend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={rolling}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tickFormatter={v => new Date(v).toLocaleDateString('en-IN', { day:'numeric', month:'short' })} tick={{ fontSize:10 }} />
                <YAxis tick={{ fontSize:10 }} />
                <Tooltip formatter={v => `₹${parseFloat(v).toFixed(0)}`} />
                <Line type="monotone" dataKey="total" stroke="#dc2626" dot={false} name="Daily Spend" strokeWidth={1} />
                <Line type="monotone" dataKey="rolling_7day_avg" stroke="#2563eb" dot={false} name="7-Day Avg" strokeWidth={2} />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Percentile rank */}
          <div style={card}>
            <h3 style={{ margin:'0 0 12px', color:'#1e3a5f' }}>Monthly Spend Percentile Rank</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={percentile}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={v => new Date(v).toLocaleDateString('en-IN', { month:'short', year:'2-digit' })} tick={{ fontSize:10 }} />
                <YAxis domain={[0,100]} tick={{ fontSize:10 }} />
                <Tooltip formatter={(v, n) => n === 'percentile_rank' ? `${v}th percentile` : `₹${parseFloat(v).toFixed(0)}`} />
                <Bar dataKey="percentile_rank" fill="#7c3aed" name="Percentile Rank" />
              </BarChart>
            </ResponsiveContainer>
            <p style={{ fontSize:11, color:'#9ca3af', marginTop:8 }}>Higher = you spent more that month compared to your own history</p>
          </div>
        </div>

        {/* Audit Trail */}
        <div style={card}>
          <h3 style={{ margin:'0 0 16px', color:'#1e3a5f' }}>🔍 Regulatory Audit Trail (Last 90 Days)</h3>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'#f1f5f9' }}>
                {['Entity','Action','Old Value','New Value','Date'].map(h => (
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditTrail.map(a => (
                <tr key={a.log_id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'8px 12px' }}>{a.entity_type}</td>
                  <td style={{ padding:'8px 12px', fontWeight:'bold', color:'#d97706' }}>{a.action}</td>
                  <td style={{ padding:'8px 12px', fontSize:11, color:'#dc2626', fontFamily:'monospace' }}>
                    {a.old_value ? JSON.stringify(a.old_value).substring(0,50) + '...' : '—'}
                  </td>
                  <td style={{ padding:'8px 12px', fontSize:11, color:'#16a34a', fontFamily:'monospace' }}>
                    {a.new_value ? JSON.stringify(a.new_value).substring(0,50) + '...' : '—'}
                  </td>
                  <td style={{ padding:'8px 12px', fontSize:11 }}>{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {!auditTrail.length && <tr><td colSpan={5} style={{ padding:24, textAlign:'center', color:'#9ca3af' }}>No audit events in last 90 days</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
const card = { background:'white', border:'1px solid #e5e7eb', borderRadius:10, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' };