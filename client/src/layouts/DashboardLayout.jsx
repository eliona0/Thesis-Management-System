import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'

export default function DashboardLayout() {
  return (
    <div className="dashboard-shell">
      <Navbar />
      <div className="dashboard-body">
        <Sidebar />
        <main className="main-content"><Outlet /></main>
      </div>
    </div>
  )
}
