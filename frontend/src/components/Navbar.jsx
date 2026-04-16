import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const logout = () => { localStorage.clear(); navigate('/login'); };
  const links = [
    ['/', '🏠 Home'],
    ['/transactions', '📋 Transactions'],
    ['/transfer', '💸 Transfer'],
    ['/reversals', '↩️ Reversals'],
    ['/loans', '🏦 Loans'],
    ['/vaults', '🔒 Vaults'],
    ['/scheduled', '⏰ Scheduled'],
    ['/fraud', '🚨 Fraud'],
    ['/analytics', '📊 Analytics'],
  ];
  return (
    <nav style={{ background:'#1e3a5f', padding:'10px 24px', display:'flex', alignItems:'center', flexWrap:'wrap', gap:8 }}>
      <span style={{ color:'white', fontWeight:'bold', marginRight:16, fontSize:18 }}>🏦 NeoBank</span>
      {links.map(([to, label]) => (
        <Link key={to} to={to} style={{ color:'#93c5fd', textDecoration:'none', fontSize:13, padding:'4px 8px', borderRadius:4 }}>
          {label}
        </Link>
      ))}
      <button onClick={logout} style={{ marginLeft:'auto', padding:'6px 14px', background:'#dc2626', color:'white', border:'none', borderRadius:4, cursor:'pointer', fontSize:13 }}>
        Logout
      </button>
    </nav>
  );
}