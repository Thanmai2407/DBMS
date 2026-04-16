import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import client from '../api/client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';

const COLORS = ['#2563eb','#16a34a','#dc2626','#d97706','#7c3aed','#0891b2','#db2777','#059669'];

export default function Dashboard() {
  const [accounts, setAccounts] = useState([]);
  const [spending, setSpending] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [summary, setSummary] = useState([]);
  const cust = JSON.parse(localStorage.getItem('customer') || '{}');

  useEffect(() => {
    client.get('/accounts').then(r => {
      setAccounts(r.data);
      if (r.data.length) {
        const aid = r.data[0].account_id;
        client.get(`/analytics/spending/${aid}`).then(r => setSpending(r.data));
        client.get(`/analytics/budgets/${aid}`).then(r => setBudgets(r.data));
        client.get(`/analytics/summary/${aid}`).then(r => setSummary(r.data));
      }
    });
    client.get('/accounts/notifications').then(r => setNotifs(r.data));
  }, []);

  const unread = notifs.filter(n => !n.is_read).length;

  return (
    <div style={{ fontFamily:'sans-serif', background:'#f8fafc', minHeight:'100vh' }}>
      <Navbar />
      <div style={{ padding:24, maxWidth:1200, margin:'0 auto' }}>
        <h2 style={{ color:'#1e3a5f' }}>Welcome back, {cust.name} 👋</h2>

        {/* Accounts */}
        <div style={{ display:'flex', gap:16, marginBottom:24, flexWrap:'wrap' }}>
          {accounts.map(a => (
            <div key={a.account_id} style={card}>
              <div style={{ fontSize:12, color:'#6b7280', textTransform:'uppercase', letterSpacing:1 }}>{a.account_type}</div>
              <div style={{ fontSize:28, fontWeight:'bold', color:'#1e3a5f', margin:'8px 0' }}>
                ₹{parseFloat(a.balance).toLocaleString('en-IN', { minimumFractionDigits:2 })}
              </div>
              {a.account_type === 'VAULT' && a.vault_unlock_date && (
                <div style={{ fontSize:11, color:'#d97706' }}>🔒 Locked until {new Date(a.vault_unlock_date).toLocaleDateString()}</div>
              )}
              {a.account_type === 'VAULT' && a.vault_target_amount && (
                <div style={{ fontSize:11, color:'#7c3aed' }}>🎯 Goal: ₹{parseFloat(a.vault_target_amount).toLocaleString()}</div>
              )}
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{a.account_id}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:20, marginBottom:24 }}>
          {/* Spending Pie */}
          <div style={card}>
            <h3 style={{ margin:'0 0 12px', color:'#1e3a5f' }}>This Month's Spending</h3>
            {spending.length ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={spending} dataKey="total_spent" nameKey="category" cx="50%" cy="50%" outerRadius={70}>
                    {spending.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => `₹${parseFloat(v).toLocaleString('en-IN')}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p style={{ color:'#9ca3af' }}>No spending data yet</p>}
          </div>

          {/* Budgets */}
          <div style={card}>
            <h3 style={{ margin:'0 0 12px', color:'#1e3a5f' }}>Budget Status</h3>
            {budgets.map(b => (
              <div key={b.category} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                  <span>{b.category}</span>
                  <span style={{ color: b.pct_used >= 100 ? '#dc2626' : '#6b7280' }}>
                    {b.pct_used}%
                  </span>
                </div>
                <div style={{ background:'#e5e7eb', borderRadius:4, height:7, marginTop:3 }}>
                  <div style={{
                    width:`${Math.min(b.pct_used, 100)}%`,
                    background: b.pct_used >= 100 ? '#dc2626' : b.pct_used >= 80 ? '#d97706' : '#16a34a',
                    height:'100%', borderRadius:4, transition:'width 0.3s'
                  }}/>
                </div>
              </div>
            ))}
            {!budgets.length && <p style={{ color:'#9ca3af', fontSize:13 }}>No budgets configured</p>}
          </div>

          {/* Monthly Summary */}
          <div style={card}>
            <h3 style={{ margin:'0 0 12px', color:'#1e3a5f' }}>Monthly Overview</h3>
            {summary.length ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={summary.slice(0,6).reverse()}>
                  <XAxis dataKey="month" tickFormatter={v => new Date(v).toLocaleDateString('en-IN', { month:'short' })} tick={{ fontSize:11 }} />
                  <YAxis tick={{ fontSize:11 }} />
                  <Tooltip formatter={v => `₹${parseFloat(v).toLocaleString()}`} />
                  <Bar dataKey="total_debits" fill="#dc2626" name="Spent" />
                  <Bar dataKey="total_credits" fill="#16a34a" name="Received" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p style={{ color:'#9ca3af' }}>No summary yet</p>}
          </div>
        </div>

        {/* Notifications */}
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ margin:0, color:'#1e3a5f' }}>
              Notifications {unread > 0 && <span style={{ background:'#dc2626', color:'white', borderRadius:10, padding:'2px 8px', fontSize:12 }}>{unread}</span>}
            </h3>
            {unread > 0 && (
              <button onClick={() => client.put('/accounts/notifications/read').then(() => setNotifs(notifs.map(n => ({...n, is_read:true}))))}
                style={{ fontSize:12, padding:'4px 10px', background:'#eff6ff', border:'1px solid #2563eb', borderRadius:4, cursor:'pointer' }}>
                Mark all read
              </button>
            )}
          </div>
          {notifs.slice(0,8).map(n => (
            <div key={n.notification_id} style={{
              padding:'8px 12px', marginBottom:6, borderRadius:6, fontSize:13,
              background: n.is_read ? '#f9fafb' : '#eff6ff',
              borderLeft: `3px solid ${n.is_read ? '#e5e7eb' : '#2563eb'}`
            }}>
              {n.message}
              <span style={{ float:'right', color:'#9ca3af', fontSize:11 }}>
                {new Date(n.created_at).toLocaleString()}
              </span>
            </div>
          ))}
          {!notifs.length && <p style={{ color:'#9ca3af' }}>No notifications</p>}
        </div>
      </div>
    </div>
  );
}

const card = { background:'white', border:'1px solid #e5e7eb', borderRadius:10, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' };