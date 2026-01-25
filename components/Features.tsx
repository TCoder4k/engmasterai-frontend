
import React from 'react';
import { Bot, Zap, Target, MessageCircle, Heart, Smartphone } from 'lucide-react';

const Features: React.FC = () => {
  const features = [
    {
      icon: <Bot className="w-8 h-8 text-indigo-600" />,
      title: "Trợ lý AI 24/7",
      description: "Có người đồng hành luyện nói mọi lúc, mọi nơi mà không sợ bị phán xét.",
      color: "bg-indigo-50"
    },
    {
      icon: <Zap className="w-8 h-8 text-emerald-600" />,
      title: "Phản hồi tức thì",
      description: "Nhận xét chi tiết về ngữ pháp và phát âm ngay sau khi bạn nói hoặc viết.",
      color: "bg-emerald-50"
    },
    {
      icon: <Target className="w-8 h-8 text-amber-600" />,
      title: "Lộ trình riêng biệt",
      description: "Thuật toán AI tự động điều chỉnh bài tập theo điểm mạnh và điểm yếu của bạn.",
      color: "bg-amber-50"
    },
    {
      icon: <MessageCircle className="w-8 h-8 text-blue-600" />,
      title: "Hội thoại thực tế",
      description: "Hàng trăm tình huống giao tiếp từ đời thường đến công việc văn phòng.",
      color: "bg-blue-50"
    },
    {
      icon: <Heart className="w-8 h-8 text-pink-600" />,
      title: "Học mà chơi",
      description: "Tích hợp Gamification giúp bạn duy trì thói quen học tập mỗi ngày.",
      color: "bg-pink-50"
    },
    {
      icon: <Smartphone className="w-8 h-8 text-purple-600" />,
      title: "Học trên mọi thiết bị",
      description: "Đồng bộ tiến độ trên máy tính, điện thoại và máy tính bảng dễ dàng.",
      color: "bg-purple-50"
    }
  ];

  return (
    <section id="path" className="py-24 bg-slate-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-indigo-600 font-bold tracking-widest uppercase text-sm">Vì sao nên chọn chúng tôi?</h2>
          <h3 className="text-3xl md:text-4xl font-bold font-display text-slate-900">
            Học thông minh hơn, không phải mệt mỏi hơn
          </h3>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg leading-relaxed">
            EngMasterAI kết hợp công nghệ trí tuệ nhân tạo tiên tiến nhất để mang lại trải nghiệm học tập tự nhiên và hiệu quả.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <div 
              key={idx} 
              className="group bg-white p-8 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-2 border border-slate-100"
            >
              <div className={`${feature.color} w-16 h-16 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
                {feature.icon}
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors">
                {feature.title}
              </h4>
              <p className="text-slate-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
