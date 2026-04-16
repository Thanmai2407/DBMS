import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Transfer from './pages/Transfer';
import Reversals from './pages/Reversals';
import Loans from './pages/Loans';
import Vaults from './pages/Vaults';
import Scheduled from './pages/Scheduled';
import Fraud from './pages/Fraud';
import Analytics from './pages/Analytics';

const Private = ({ children }) =>
  localStorage.getItem('token') ? children : <Navigate to="/login" />;

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Private><Dashboard /></Private>} />
        <Route path="/transactions" element={<Private><Transactions /></Private>} />
        <Route path="/transfer" element={<Private><Transfer /></Private>} />
        <Route path="/reversals" element={<Private><Reversals /></Private>} />
        <Route path="/loans" element={<Private><Loans /></Private>} />
        <Route path="/vaults" element={<Private><Vaults /></Private>} />
        <Route path="/scheduled" element={<Private><Scheduled /></Private>} />
        <Route path="/fraud" element={<Private><Fraud /></Private>} />
        <Route path="/analytics" element={<Private><Analytics /></Private>} />
      </Routes>
    </BrowserRouter>
  );
}