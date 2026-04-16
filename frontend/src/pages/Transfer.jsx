import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import client from '../api/client';
import { v4 as uuidv4 } from 'uuid';

export default function Transfer() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ from_account_id:'', to_account_id:'', amount:'', description:'' });
  const [result, setResult] = useState(null);
  const [depositForm, setDepositForm] = useState({ account_id:'', amount:'', description:'' });

  useEffect(() => {
    client.get('/accounts').then(r => {
      setAccounts(r.data);
      if (r.data.length) {
        setForm(f => ({ ...f, from_account_id: r.data[0].account_id }));
        setDepositForm(f => ({ ...f, account_id: r.data[0].account_id }));
      }
    });
  }, []);

  const doTransfer = async () => {
    try {
      await client.post('/transactions/transfer', form, {
        headers: { 'idempotency-key': uuidv4() }
      });
      setResult({ ok: true, msg: '✅ Transfer successful!' });
    } catch (e) { setResult({ ok: false, msg: e.response?.data?.error }); }
  };

  const doDeposit = async () => {
    try {
      await client.post('/transactions/deposit', depositForm);
      setResult({ ok: true, msg: '✅ Deposit successful!' });
    } catch (e) { setResult({ ok: false, msg: e.response?.data?.error }); }
  };

  return (
    <div style={{ fontFamily:'sans-serif', background:'#f8fafc', minHeight:'100vh' }}>
      <Navbar />
      <div style={{ padding:24, maxWidth:900, margin:'0 auto' }}>
        <h2 style={{ color:'#1e3a5f' }}>Transfers & Deposits</h2>
        {result && (
          <div style={{ padding:12, borderRadius:8, marginBottom:20, background: result.ok ? '#dcfce7' : '#fee2e2', color: result.ok ? '#166534' : '#991b1b' }}>
            {result.msg}
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
          {/* Transfer */}
          <div style={card}>
            <h3 style={{ color:'#1e3a5f', margin:'0 0 16px' }}>💸 Send Money</h3>
            <label style={lbl}>From Account</label>
            <select value={form.from_account_id} onChange={e => setForm({...form, from_account_id:e.target.value})} style={inp}>
              {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_type} — ₹{parseFloat(a.balance).toFixed(2)}</option>)}
            </select>
            <label style={lbl}>To Account ID (UUID)</label>
            <input placeholder="Paste recipient account ID" onChange={e => setForm({...form, to_account_id:e.target.value})} style={inp} />
            <label style={lbl}>Amount (₹)</label>
            <input type="number" placeholder="0.00" onChange={e => setForm({...form, amount:e.target.value})} style={inp} />
            <label style={lbl}>Description (used for auto-categorization)</label>
            <input placeholder="e.g. Zomato dinner, Rent payment" onChange={e => setForm({...form, description:e.target.value})} style={inp} />
            <button onClick={doTransfer} style={btn}>Send Money</button>
          </div>

          {/* Deposit */}
          <div style={card}>
            <h3 style={{ color:'#1e3a5f', margin:'0 0 16px' }}>💰 Deposit Funds</h3>
            <label style={lbl}>Into Account</label>
            <select value={depositForm.account_id} onChange={e => setDepositForm({...depositForm, account_id:e.target.value})} style={inp}>
              {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.account_type}</option>)}
            </select>
            <label style={lbl}>Amount (₹)</label>
            <input type="number" placeholder="0.00" onChange={e => setDepositForm({...depositForm, amount:e.target.value})} style={inp} />
            <label style={lbl}>Description</label>
            <input placeholder="Salary, refund, etc." onChange={e => setDepositForm({...depositForm, description:e.target.value})} style={inp} />
            <button onClick={doDeposit} style={btn}>Deposit</button>
          </div>
        </div>
      </div>
    </div>
  );
}
const card = { background:'white', border:'1px solid #e5e7eb', borderRadius:10, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' };
const inp = { display:'block', width:'100%', marginBottom:12, padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:6, boxSizing:'border-box', fontSize:13 };
const lbl = { fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 };
const btn = { padding:'10px 20px', background:'#1e3a5f', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontSize:14, width:'100%', marginTop:4 };