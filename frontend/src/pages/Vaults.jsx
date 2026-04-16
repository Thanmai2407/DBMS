import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import client from '../api/client';

export default function Vaults() {
  const [vaults, setVaults] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ vault_type:'TIME_LOCK', unlock_date:'', target_amount:'', penalty_pct:'' });

  useEffect(() => {
    client.get('/vaults/my-vaults').then(r => setVaults(r.data));
    client.get('/accounts').then(r => setAccounts(r.data));
  }, []);

  const create = async () => {
    try {
      await client.post('/vaults/create', form);
      client.get('/vaults/my-vaults').then(r => setVaults(r.data));
      alert('Vault created!');
    } catch (e) { alert(e.response?.data?.error); }
  };

  const vaultTypeInfo = {
    TIME_LOCK: 'Locked until a specific date. Cannot withdraw early (or penalty applies).',
    GOAL: 'Locked until target amount is reached.',
    PENALTY: 'Can withdraw early but a % penalty is deducted.',
  };

  return (
    <div style={{ fontFamily:'sans-serif', background:'#f8fafc', minHeight:'100vh' }}>
      <Navbar />
      <div style={{ padding:24, maxWidth:900, margin:'0 auto' }}>
        <h2 style={{ color:'#1e3a5f' }}>🔒 Vault Accounts</h2>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
          <div style={card}>
            <h3 style={{ margin:'0 0 16px', color:'#1e3a5f' }}>Create New Vault</h3>
            <label style={lbl}>Vault Type</label>
            <select value={form.vault_type} onChange={e => setForm({...form, vault_type:e.target.value})} style={inp}>
              <option value="TIME_LOCK">⏰ Time-Lock Vault</option>
              <option value="GOAL">🎯 Goal Vault</option>
              <option value="PENALTY">⚠️ Early-Withdrawal Penalty Vault</option>
            </select>
            <p style={{ fontSize:12, color:'#6b7280', margin:'-4px 0 12px' }}>{vaultTypeInfo[form.vault_type]}</p>
            {(form.vault_type === 'TIME_LOCK' || form.vault_type === 'PENALTY') && (
              <>
                <label style={lbl}>Unlock Date</label>
                <input type="date" onChange={e => setForm({...form, unlock_date:e.target.value})} style={inp} />
              </>
            )}
            {form.vault_type === 'GOAL' && (
              <>
                <label style={lbl}>Target Amount (₹)</label>
                <input type="number" placeholder="50000" onChange={e => setForm({...form, target_amount:e.target.value})} style={inp} />
              </>
            )}
            {form.vault_type === 'PENALTY' && (
              <>
                <label style={lbl}>Early Withdrawal Penalty (%)</label>
                <input type="number" placeholder="2" onChange={e => setForm({...form, penalty_pct:e.target.value})} style={inp} />
              </>
            )}
            <button onClick={create} style={btn}>Create Vault</button>
          </div>

          <div style={card}>
            <h3 style={{ margin:'0 0 16px', color:'#1e3a5f' }}>My Vaults</h3>
            {vaults.map(v => {
              const locked = v.vault_unlock_date && new Date() < new Date(v.vault_unlock_date);
              const goalLocked = v.vault_target_amount && parseFloat(v.balance) < parseFloat(v.vault_target_amount);
              return (
                <div key={v.account_id} style={{ border:`1px solid ${locked || goalLocked ? '#fde68a' : '#d1fae5'}`, borderRadius:8, padding:14, marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <strong style={{ color:'#1e3a5f' }}>₹{parseFloat(v.balance).toLocaleString('en-IN', { minimumFractionDigits:2 })}</strong>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:8, background: locked || goalLocked ? '#fef3c7' : '#dcfce7', color: locked || goalLocked ? '#92400e' : '#166534' }}>
                      {locked || goalLocked ? '🔒 LOCKED' : '🔓 UNLOCKED'}
                    </span>
                  </div>
                  {v.vault_unlock_date && <div style={{ fontSize:12, color:'#6b7280', marginTop:4 }}>📅 Unlock: {new Date(v.vault_unlock_date).toLocaleDateString()}</div>}
                  {v.vault_target_amount && <div style={{ fontSize:12, color:'#7c3aed', marginTop:4 }}>🎯 Goal: ₹{parseFloat(v.vault_target_amount).toLocaleString()} ({((parseFloat(v.balance)/parseFloat(v.vault_target_amount))*100).toFixed(0)}%)</div>}
                  {v.vault_penalty_pct > 0 && <div style={{ fontSize:12, color:'#dc2626', marginTop:4 }}>⚠️ Early penalty: {v.vault_penalty_pct}%</div>}
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>ID: {v.account_id.substring(0,16)}...</div>
                </div>
              );
            })}
            {!vaults.length && <p style={{ color:'#9ca3af' }}>No vaults created yet</p>}
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