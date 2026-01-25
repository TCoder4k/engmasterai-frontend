
import React from 'react';
import { Book } from 'lucide-react';

export const Logo: React.FC = () => {
  return (
    <div className="flex flex-col items-center mb-8 select-none">
      <div className="flex items-center gap-3">
        {/* Biểu tượng tương tự hình ảnh yêu cầu */}
        <div className="relative group">
          {/* Lớp nền trắng bao quanh icon (sticker effect) */}
          <div className="absolute -inset-1.5 bg-white rounded-2xl shadow-sm"></div>
          
          {/* Icon chính: Chat bubble cách điệu */}
          <div className="relative bg-white p-1 rounded-xl">
            <div className="bg-[#38b6ff] p-3 rounded-lg relative overflow-hidden">
              {/* Giả lập hình dạng chat bubble cách điệu */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#38b6ff] rotate-45 transform origin-center"></div>
              <Book className="w-8 h-8 text-white relative z-10" />
            </div>
          </div>
        </div>

        {/* Text logo */}
        <div className="flex flex-col leading-none">
          <span className="text-3xl font-black tracking-tight text-[#38b6ff]">Eng</span>
          <span className="text-3xl font-black tracking-tight text-slate-700 -mt-1">MasterAI</span>
        </div>
      </div>
      
      {/* Một dải trang trí nhỏ bên dưới */}
      <div className="mt-4 w-12 h-1 bg-indigo-100 rounded-full"></div>
    </div>
  );
};
