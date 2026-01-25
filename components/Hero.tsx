
import React, { useState, useEffect } from 'react';
import { ArrowRight, Play, Star, BookOpen, Mic } from 'lucide-react';

const Hero: React.FC = () => {
  const [activeSlide, setActiveSlide] = useState(0);
  
  const slides = [
    {
      title: "Học Tiếng Anh dễ dàng mỗi ngày cùng EngMaster AI",
      subtitle: "Luyện nghe, nói và từ vựng với trợ lý AI thông minh — hoàn hảo cho người mới bắt đầu",
      image: "https://picsum.photos/id/1/1200/800",
      accent: "indigo"
    },
    {
      title: "Vượt qua rào cản ngôn ngữ bằng giao tiếp tự nhiên",
      subtitle: "Hệ thống AI nhận diện giọng nói giúp bạn sửa lỗi phát âm ngay lập tức như người bản xứ",
      image: "https://picsum.photos/id/180/1200/800",
      accent: "emerald"
    },
    {
      title: "Lộ trình cá nhân hóa dựa trên trình độ của bạn",
      subtitle: "Không còn cảm thấy áp lực. Chúng tôi thiết kế bài học phù hợp nhất với tốc độ của riêng bạn",
      image: "https://picsum.photos/id/20/1200/800",
      accent: "amber"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <section className="relative pt-32 pb-20 overflow-hidden min-h-[90vh] flex items-center">
      {/* Dynamic Background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-50 via-white to-blue-50 opacity-70"></div>
      
      {/* Background Shapes */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-emerald-100 rounded-full blur-3xl opacity-20"></div>

      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Content */}
          <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
            <div className="inline-flex items-center gap-2 bg-white border border-indigo-100 px-4 py-2 rounded-full shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-indigo-600 font-semibold text-sm">Nền tảng học AI hiện đại nhất</span>
            </div>
            
            <div className="relative h-[220px] md:h-[180px]">
              {slides.map((slide, index) => (
                <div 
                  key={index}
                  className={`absolute top-0 left-0 w-full transition-all duration-700 ${
                    index === activeSlide ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
                  }`}
                >
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display text-slate-900 leading-[1.1]">
                    {slide.title}
                  </h1>
                </div>
              ))}
            </div>

            <div className="relative h-[60px]">
               {slides.map((slide, index) => (
                <p 
                  key={index}
                  className={`absolute top-0 left-0 w-full text-lg md:text-xl text-slate-600 leading-relaxed transition-all duration-700 ${
                    index === activeSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                  }`}
                >
                  {slide.subtitle}
                </p>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold px-10 py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all hover:-translate-y-1 flex items-center justify-center gap-2">
                Bắt đầu học miễn phí <ArrowRight className="w-5 h-5" />
              </button>
              <button className="bg-white hover:bg-slate-50 text-slate-700 text-lg font-bold px-10 py-4 rounded-2xl border border-slate-200 transition-all flex items-center justify-center gap-2">
                <Play className="w-5 h-5 text-indigo-600" /> Xem demo
              </button>
            </div>

            {/* Ratings */}
            <div className="flex items-center gap-6 pt-6 border-t border-slate-100">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map(i => (
                  <img key={i} src={`https://i.pravatar.cc/150?u=${i}`} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt="User" />
                ))}
              </div>
              <div className="space-y-1">
                <div className="flex text-amber-400">
                  <Star size={16} fill="currentColor" />
                  <Star size={16} fill="currentColor" />
                  <Star size={16} fill="currentColor" />
                  <Star size={16} fill="currentColor" />
                  <Star size={16} fill="currentColor" />
                </div>
                <p className="text-sm text-slate-500 font-medium">Hơn 2,000+ đánh giá 5 sao</p>
              </div>
            </div>
          </div>

          {/* Right Visuals */}
          <div className="relative lg:h-[600px] flex items-center justify-center animate-in fade-in slide-in-from-right-8 duration-700 delay-200">
            <div className="relative w-full max-w-md aspect-square">
              {/* Floating Cards */}
              <div className="absolute top-10 -left-10 z-20 bg-white p-4 rounded-2xl shadow-xl animate-bounce" style={{ animationDuration: '4s' }}>
                 <div className="flex items-center gap-3">
                   <div className="bg-emerald-100 p-2 rounded-lg"><BookOpen className="text-emerald-600 w-5 h-5" /></div>
                   <div>
                     <p className="text-xs text-slate-400 font-bold uppercase">Mục tiêu</p>
                     <p className="font-bold text-slate-800">+20 Từ mới/ngày</p>
                   </div>
                 </div>
              </div>
              
              <div className="absolute bottom-20 -right-8 z-20 bg-white p-4 rounded-2xl shadow-xl animate-bounce" style={{ animationDuration: '3s' }}>
                 <div className="flex items-center gap-3">
                   <div className="bg-indigo-100 p-2 rounded-lg"><Mic className="text-indigo-600 w-5 h-5" /></div>
                   <div>
                     <p className="text-xs text-slate-400 font-bold uppercase">Phát âm</p>
                     <p className="font-bold text-slate-800">Cải thiện 85%</p>
                   </div>
                 </div>
              </div>

              {/* Main Image Slider */}
              <div className="relative w-full h-full overflow-hidden rounded-[3rem] shadow-2xl border-8 border-white">
                {slides.map((slide, index) => (
                  <img 
                    key={index}
                    src={slide.image}
                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ${
                      index === activeSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-110'
                    }`}
                    alt="Learning experience"
                  />
                ))}
              </div>
              
              {/* Circle Graphic */}
              <div className="absolute -inset-10 border-2 border-indigo-100 rounded-full -z-10 animate-spin-slow"></div>
              <div className="absolute inset-0 bg-indigo-600/5 rounded-[3rem] -z-10 transform translate-x-6 translate-y-6"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
