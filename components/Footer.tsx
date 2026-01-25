
import React from 'react';
import { Sparkles, Facebook, Instagram, Youtube, Twitter } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-100 pt-20 pb-10">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 group">
              <div className="bg-indigo-600 p-2 rounded-xl">
                <Sparkles className="text-white w-5 h-5" />
              </div>
              <span className="text-2xl font-bold font-display tracking-tight text-slate-900">
                EngMaster<span className="text-indigo-600">AI</span>
              </span>
            </div>
            <p className="text-slate-500 leading-relaxed">
              Giải pháp học tiếng Anh hiện đại giúp người Việt chinh phục ngôn ngữ dễ dàng và hiệu quả hơn với công nghệ AI hàng đầu.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-all"><Facebook size={20} /></a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-all"><Instagram size={20} /></a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-all"><Youtube size={20} /></a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-all"><Twitter size={20} /></a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-bold text-slate-900 mb-6 uppercase text-sm tracking-widest">Sản phẩm</h4>
            <ul className="space-y-4 text-slate-500 font-medium">
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Luyện phát âm</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Kiểm tra ngữ pháp</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Từ điển thông minh</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Thi thử IELTS/TOEIC</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-bold text-slate-900 mb-6 uppercase text-sm tracking-widest">Hỗ trợ</h4>
            <ul className="space-y-4 text-slate-500 font-medium">
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Trung tâm trợ giúp</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Câu hỏi thường gặp</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Liên hệ chúng tôi</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Cộng đồng người học</a></li>
            </ul>
          </div>

          {/* App Store */}
          <div className="space-y-6">
            <h4 className="font-bold text-slate-900 mb-6 uppercase text-sm tracking-widest">Tải ứng dụng</h4>
            <p className="text-slate-500 text-sm">Học mọi lúc mọi nơi trên điện thoại của bạn.</p>
            <div className="space-y-3">
              <button className="w-full bg-slate-900 text-white p-3 rounded-xl flex items-center gap-3 hover:bg-indigo-600 transition-colors">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Apple_logo_black.svg/1200px-Apple_logo_black.svg.png" className="w-5 h-5 invert" alt="Apple" />
                <div className="text-left">
                  <p className="text-[10px] opacity-70 leading-none">Download on the</p>
                  <p className="font-bold text-sm leading-none">App Store</p>
                </div>
              </button>
              <button className="w-full bg-slate-900 text-white p-3 rounded-xl flex items-center gap-3 hover:bg-indigo-600 transition-colors">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Google_Play_Store_badge_EN.svg/2560px-Google_Play_Store_badge_EN.svg.png" className="h-6" alt="Play Store" />
              </button>
            </div>
          </div>
        </div>

        <div className="pt-10 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400 text-sm font-medium">
          <p>© 2024 EngMasterAI. Tất cả quyền được bảo lưu.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-indigo-600">Điều khoản</a>
            <a href="#" className="hover:text-indigo-600">Bảo mật</a>
            <a href="#" className="hover:text-indigo-600">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
