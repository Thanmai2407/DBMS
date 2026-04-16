import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function Login() {
  const [form, setForm] = useState({ name:'', email:'', phone:'', password:'' });
  const [isReg, setIsReg] = useState(false);
  const [err, setErr] = useState('');
  const nav = useNavigate();

  const submit = async () => {
    setErr('');
    try {
      const { data } = await client.post(isReg ? '/auth/register' : '/auth/login', form);
      localStorage.setItem('token', data.token);
      localStorage.setItem('customer', JSON.stringify(data.customer));
      nav('/');
    } catch (e) { setErr(e.response?.data?.error || 'Error'); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'white', padding:32, borderRadius:12, width:380, boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign:'center', marginBottom:24, color:'#1e3a5f' }}>🏦 NeoBank {isReg ? 'Register' : 'Login'}</h2>
        {isReg && <>
          <input placeholder="Full Name" onChange={e => setForm({...form, name:e.target.value})} style={inp} />
          <input placeholder="Phone" onChange={e => setForm({...form, phone:e.target.value})} style={inp} />
        </>}
        <input placeholder="Email" onChange={e => setForm({...form, email:e.target.value})} style={inp} />
        <input type="password" placeholder="Password" onChange={e => setForm({...form, password:e.target.value})} style={inp} />
        {err && <p style={{ color:'red', fontSize:13 }}>{err}</p>}
        <button onClick={submit} style={btn}>{isReg ? 'Register' : 'Login'}</button>
        <p style={{ textAlign:'center', cursor:'pointer', color:'#2563eb', fontSize:13, marginTop:12 }}
           onClick={() => setIsReg(!isReg)}>
          {isReg ? 'Already registered? Login' : "New user? Register"}
        </p>
      </div>
    </div>
  );
}
const inp = { display:'block', width:'100%', marginBottom:12, padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, boxSizing:'border-box', fontSize:14 };
const btn = { width:'100%', padding:12, background:'#1e3a5f', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontSize:15, fontWeight:'bold' };