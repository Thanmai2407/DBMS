import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import client from '../api/client';

export default function Scheduled() {
  const [schedules, setSchedules] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ account_id:'', recipient_account_id:'', amount:'', frequency:'MONTHLY', next_execution:'', label:'' });

  useEffect(() => {
    client.get('/scheduled/my-schedules').then(r => setSchedules(r.data));
    client.get('/accounts').then(r => { setAccounts(r.data); if(r.data.length) setForm(f => ({...f, account_id:r.data[0].account_id})); });
  }, []);

  const create = async () => {
    try {
      await client.post('/scheduled/create', form);
      client.get('/scheduled/my-schedules').then(r => setSchedules(r.data));
      alert('Scheduled payment created!');
    } catch (e) { alert(e.response?.data?.error); }
  };

  const cancel = async (id) => {
    await client.put(`/scheduled/cancel/${id}`);
    setSchedules(schedules.map(s => s.schedule_id === id ? {...s, status:'CANCELLED'} : s));
  };

  const statusColor = s => ({ ACTIVE:'#16a34a', COMPLETED:'#2563eb', CANCELLED:'#dc2626' }[s] || '#6b7280');

  return (
    <div style={{ fontFamily:'sans-serif', background:'#f8fafc', minHeight:'100vh' }}>
      <Navbar />
      <div style={{ padding:24, maxWidth:1000, margin:'0 auto' }}>
        <h2 style={{ color:'#1e3a5f' }}>⏰ Scheduled Transactions</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr', gap:24 }}>
          <div style={card}>
            <h3 style={{ margin:'0 0 16px', color:'#1e3a5f' }}>Create Schedule</h3>
            <label style={lbl}>From Account</label>
            <select onChange={e => setForm({...form, account_id:e.target.value})} style={inp}>
              {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_type}</option>)}
            </select>
            <label style={lbl}>Recipient Account ID</label>
            <input placeholder="UUID of recipient" onChange={e => setForm({...form, recipient_account_id:e.target.value})} style={inp} />
            <label style={lbl}>Amount (₹)</label>
            <input type="number" onChange={e => setForm({...form, amount:e.target.value})} style={inp} />
            <label style={lbl}>Frequency</label>
            <select onChange={e => setForm({...form, frequency:e.target.value})} style={inp}>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
            <label style={lbl}>First Execution Date</label>
            <input type="datetime-local" onChange={e => setForm({...form, next_execution:e.target.value})} style={inp} />
            <label style={lbl}>Label</label>
            <input placeholder="e.g. Monthly Rent, SIP Investment" onChange={e => setForm({...form, label:e.target.value})} style={inp} />
            <button onClick={create} style={btn}>Create Schedule</button>
          </div>

          <div style={card}>
            <h3 style={{ margin:'0 0 16px', color:'#1e3a5f' }}>Active Schedules</h3>
            {schedules.map(s => (
              <div key={s.schedule_id} style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:12, marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <strong style={{ color:'#1e3a5f' }}>{s.label || s.schedule_type}</strong>
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:8, background:'#f3f4f6', color: statusColor(s.status) }}>
                    {s.status}
                  </span>
                </div>
                <div style={{ fontSize:12, color:'#6b7280', margin:'6px 0' }}>
                  ₹{parseFloat(s.amount).toFixed(2)} · {s.frequency}
                </div>
                <div style={{ fontSize:12, color:'#6b7280' }}>
                  Next: {s.next_execution ? new Date(s.next_execution).toLocaleString() : '—'}
                </div>
                {s.status === 'ACTIVE' && (
                  <button onClick={() => cancel(s.schedule_id)}
                    style={{ marginTop:8, padding:'4px 10px', fontSize:11, background:'#fee2e2', border:'1px solid #dc2626', borderRadius:4, cursor:'pointer' }}>
                    Cancel
                  </button>
                )}
              </div>
            ))}
            {!schedules.length && <p style={{ color:'#9ca3af' }}>No scheduled payments</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
const card = { background:'white', border:'1px solid #e5e7eb', borderRadius:10, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' };
const inp = { display:'block', width:'100%', marginBottom:10, padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:6, boxSizing:'border-box', fontSize:13 };
const lbl = { fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 };
const btn = { padding:'10px 16px', background:'#1e3a5f', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontSize:13, width:'100%' };