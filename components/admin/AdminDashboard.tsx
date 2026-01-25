
import React from 'react';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { STATS, RECENT_LEARNERS, POPULAR_COURSES } from './constants';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  BookOpen, 
  Gamepad2,
  Clock,
  MoreVertical,
  Filter,
  Download,
  Calendar,
  ChevronRight,
  BrainCircuit
} from 'lucide-react';

const AdminDashboard: React.FC = () => {
  return (
    <div className="min-h-screen flex bg-[#fbfcfd]">
      <AdminSidebar />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader />
        
        <main className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Main Hero Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-indigo-600 font-bold text-xs uppercase tracking-widest">
                <BrainCircuit size={14} />
                <span>Analytics Core</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Thống kê vận hành EngMaster</h1>
              <p className="text-sm text-slate-500 font-medium">Theo dõi dữ liệu học tập, sự tăng trưởng cấp độ và hiệu suất nội dung.</p>
            </div>
            
            <div className="flex items-center space-x-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
              <div className="px-4 py-2 border-r border-slate-100 flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Hôm nay</span>
                <span className="text-sm font-black text-slate-800">15 Oct, 2024</span>
              </div>
              <button className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all">
                <Download size={16} />
                <span>Báo cáo tuần</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STATS.map((stat, idx) => (
              <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-2xl transition-colors ${
                    stat.icon === 'users' ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white' :
                    stat.icon === 'level' ? 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white' :
                    stat.icon === 'clock' ? 'bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white' :
                    'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'
                  }`}>
                    {stat.icon === 'users' && <Users size={22} />}
                    {stat.icon === 'level' && <Gamepad2 size={22} />}
                    {stat.icon === 'clock' && <Clock size={22} />}
                    {stat.icon === 'award' && <BrainCircuit size={22} />}
                  </div>
                  <div className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${stat.trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {stat.trend === 'up' ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
                    {stat.change}%
                  </div>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{stat.value}</h3>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Learning Analytics & User List */}
            <div className="xl:col-span-2 space-y-8">
              
              {/* Fake Analytics Chart Area */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Phân tích học tập định kỳ</h3>
                    <p className="text-xs text-slate-400 font-medium">Thời gian học trung bình 7 ngày qua</p>
                  </div>
                  <div className="flex bg-slate-50 p-1 rounded-xl">
                    <button className="px-3 py-1 text-[10px] font-bold text-indigo-600 bg-white rounded-lg shadow-sm">Tuần</button>
                    <button className="px-3 py-1 text-[10px] font-bold text-slate-400">Tháng</button>
                  </div>
                </div>
                
                <div className="h-48 w-full flex items-end justify-between space-x-2 px-2">
                  {[45, 60, 30, 80, 55, 90, 75].map((val, i) => (
                    <div key={i} className="flex-1 group relative flex flex-col items-center">
                      <div className="absolute -top-8 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        {val}m
                      </div>
                      <div 
                        className="w-full bg-indigo-50 group-hover:bg-indigo-600 rounded-t-xl transition-all duration-500" 
                        style={{ height: `${val}%` }}
                      ></div>
                      <span className="text-[10px] font-bold text-slate-400 mt-3 uppercase">T{i+2}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* User Management */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">Học viên mới hoạt động</h3>
                  <div className="flex space-x-2">
                    <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg"><Filter size={16} /></button>
                    <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">Xem danh sách</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Học viên & Cấp độ</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Tiến độ tuần</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trạng thái</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {RECENT_LEARNERS.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <img src={user.avatar} className="w-10 h-10 rounded-2xl object-cover bg-slate-100 border border-slate-100" alt="" />
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-[9px] font-black rounded-lg flex items-center justify-center border-2 border-white shadow-sm">
                                  {user.currentLevel}
                                </div>
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900">{user.name}</p>
                                <p className="text-[11px] text-slate-400">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center">
                              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.random() * 100}%` }}></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                              user.status === 'Hoạt động' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            }`}>
                              {user.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                              <MoreVertical size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sidebar Tools & Course Performance */}
            <div className="space-y-8">
              {/* Level System Distribution */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <h3 className="font-bold text-slate-900 mb-6 flex items-center">
                  <Gamepad2 size={18} className="mr-2 text-indigo-600" />
                  Phân bố Cấp độ
                </h3>
                <div className="space-y-5">
                  {[
                    { label: "Sơ cấp (Lv 1-10)", count: "6,240", percent: 35, color: "bg-blue-400" },
                    { label: "Trung cấp (Lv 11-30)", count: "8,900", percent: 48, color: "bg-indigo-500" },
                    { label: "Cao cấp (Lv 31+)", count: "3,105", percent: 17, color: "bg-purple-600" }
                  ].map((tier, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-500">{tier.label}</span>
                        <span className="text-slate-900">{tier.count} hv</span>
                      </div>
                      <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                        <div className={`h-full ${tier.color} rounded-full`} style={{ width: `${tier.percent}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="w-full mt-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold hover:bg-indigo-600 transition-all flex items-center justify-center group">
                  Điều chỉnh Rank & Reward
                  <ChevronRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Course Performance */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <h3 className="font-bold text-slate-900 mb-6">Khóa học triển khai tốt nhất</h3>
                <div className="space-y-4">
                  {POPULAR_COURSES.map((course) => (
                    <div key={course.id} className="flex items-center space-x-3 p-3 hover:bg-indigo-50 rounded-2xl transition-all cursor-pointer border border-transparent hover:border-indigo-100">
                      <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                        <BookOpen size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{course.title}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{course.students} học viên</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-indigo-600">{course.price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calendar / Schedule Summary */}
              <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200">
                <div className="flex items-center justify-between mb-4">
                  <Calendar size={20} />
                  <span className="text-[10px] font-black bg-white/20 px-2 py-1 rounded-lg">UPCOMING</span>
                </div>
                <h4 className="font-bold text-sm mb-2">Buổi Seminar Coaching</h4>
                <p className="text-xs text-indigo-100 mb-6 opacity-80">Ngày mai, 10:00 AM - Với chuyên gia Sarah Miller</p>
                <div className="flex -space-x-2">
                  {[1,2,3,4].map(i => (
                    <img key={i} src={`https://picsum.photos/seed/face${i}/50/50`} className="w-7 h-7 rounded-full border-2 border-indigo-600" alt="" />
                  ))}
                  <div className="w-7 h-7 rounded-full bg-indigo-400 border-2 border-indigo-600 flex items-center justify-center text-[8px] font-bold">
                    +120
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
