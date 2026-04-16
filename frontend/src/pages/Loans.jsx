import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import client from '../api/client';

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [form, setForm] = useState({ account_id:'', principal:'', annual_rate:'', tenure_months:'' });

  useEffect(() => {
    client.get('/loans/my-loans').then(r => setLoans(r.data));
    client.get('/accounts').then(r => { setAccounts(r.data); if(r.data.length) setForm(f => ({...f, account_id: r.data[0].account_id})); });
  }, []);

  const apply = async () => {
    try {
      const { data } = await client.post('/loans/disburse', form);
      setLoans([...loans, data.loan]);
      setSchedule(data.schedule);
      setSelectedLoan(data.loan.loan_id);
      alert('Loan disbursed successfully!');
    } catch (e) { alert(e.response?.data?.error); }
  };

  const viewSchedule = async (loanId) => {
    const { data } = await client.get(`/loans/schedule/${loanId}`);
    setSchedule(data); setSelectedLoan(loanId);
  };

  const payEMI = async (loanId, accountId) => {
    try {
      await client.post('/loans/pay-emi', { loan_id: loanId, account_id: accountId });
      alert('EMI paid!');
      client.get('/loans/my-loans').then(r => setLoans(r.data));
      viewSchedule(loanId);
    } catch (e) { alert(e.response?.data?.error); }
  };

  return (
    <div style={{ fontFamily:'sans-serif', background:'#f8fafc', minHeight:'100vh' }}>
      <Navbar />
      <div style={{ padding:24, maxWidth:1100, margin:'0 auto' }}>
        <h2 style={{ color:'#1e3a5f' }}>🏦 Loan Management</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:24 }}>
          <div>
            <div style={card}>
              <h3 style={{ margin:'0 0 16px', color:'#1e3a5f' }}>Apply for Loan</h3>
              <label style={lbl}>Account</label>
              <select onChange={e => setForm({...form, account_id:e.target.value})} style={inp}>
                {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_type}</option>)}
              </select>
              <label style={lbl}>Principal (₹)</label>
              <input type="number" placeholder="100000" onChange={e => setForm({...form, principal:e.target.value})} style={inp} />
              <label style={lbl}>Annual Interest Rate (%)</label>
              <input type="number" placeholder="12" onChange={e => setForm({...form, annual_rate:e.target.value})} style={inp} />
              <label style={lbl}>Tenure (Months)</label>
              <input type="number" placeholder="24" onChange={e => setForm({...form, tenure_months:e.target.value})} style={inp} />
              <button onClick={apply} style={btn}>Apply & Disburse</button>
            </div>

            <div style={{ ...card, marginTop:20 }}>
              <h3 style={{ margin:'0 0 12px', color:'#1e3a5f' }}>Active Loans</h3>
              {loans.map(l => (
                <div key={l.loan_id} style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:12, marginBottom:10 }}>
                  <div style={{ fontSize:13 }}>
                    <strong>₹{parseFloat(l.principal).toLocaleString()}</strong> @ {l.interest_rate}%
                  </div>
                  <div style={{ fontSize:12, color:'#6b7280', margin:'4px 0' }}>
                    EMI: ₹{parseFloat(l.emi_amount).toFixed(2)} | Outstanding: ₹{parseFloat(l.outstanding_principal).toLocaleString()}
                  </div>
                  <div style={{ fontSize:12, color:'#6b7280' }}>
                    Interest paid: ₹{parseFloat(l.total_interest_paid).toFixed(2)}
                  </div>
                  <div style={{ display:'flex', gap:6, marginTop:8 }}>
                    <button onClick={() => viewSchedule(l.loan_id)} style={{ padding:'4px 10px', fontSize:11, background:'#eff6ff', border:'1px solid #2563eb', borderRadius:4, cursor:'pointer' }}>
                      View Schedule
                    </button>
                    <button onClick={() => payEMI(l.loan_id, l.account_id)} style={{ padding:'4px 10px', fontSize:11, background:'#dcfce7', border:'1px solid #16a34a', borderRadius:4, cursor:'pointer' }}>
                      Pay EMI
                    </button>
                  </div>
                </div>
              ))}
              {!loans.length && <p style={{ color:'#9ca3af', fontSize:13 }}>No active loans</p>}
            </div>
          </div>

          {schedule.length > 0 && (
            <div style={card}>
              <h3 style={{ margin:'0 0 16px', color:'#1e3a5f' }}>Amortization Schedule</h3>
              <div style={{ overflowY:'auto', maxHeight:600 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'#f1f5f9', position:'sticky', top:0 }}>
                      {['#','Due Date','EMI','Principal','Interest','Remaining','Status'].map(h => (
                        <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontWeight:600, color:'#374151' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map(s => (
                      <tr key={s.emi_number} style={{ borderBottom:'1px solid #f3f4f6', background: s.status==='PAID' ? '#f0fdf4' : 'white' }}>
                        <td style={td}>{s.emi_number}</td>
                        <td style={td}>{new Date(s.due_date).toLocaleDateString('en-IN')}</td>
                        <td style={td}>₹{parseFloat(s.emi_amount).toFixed(0)}</td>
                        <td style={{ ...td, color:'#16a34a' }}>₹{parseFloat(s.principal_component).toFixed(0)}</td>
                        <td style={{ ...td, color:'#dc2626' }}>₹{parseFloat(s.interest_component).toFixed(0)}</td>
                        <td style={td}>₹{parseFloat(s.remaining_principal).toFixed(0)}</td>
                        <td style={td}>
                          <span style={{ fontSize:10, padding:'2px 6px', borderRadius:8, background: s.status==='PAID' ? '#dcfce7' : '#fef3c7', color: s.status==='PAID' ? '#166534' : '#92400e' }}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
const card = { background:'white', border:'1px solid #e5e7eb', borderRadius:10, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' };
const inp = { display:'block', width:'100%', marginBottom:10, padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:6, boxSizing:'border-box', fontSize:13 };
const lbl = { fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 };
const btn = { padding:'10px 16px', background:'#1e3a5f', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontSize:13, width:'100%' };
const td = { padding:'8px 10px' };