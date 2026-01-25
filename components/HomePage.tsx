
import React from 'react';
import Navbar from './Navbar';
import Hero from './Hero';
import Features from './Features';
import AIDemo from './AIDemo';
import Footer from './Footer';

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col selection:bg-indigo-100 selection:text-indigo-600">
      <Navbar />
      <main className="flex-grow">
        <Hero />
        <Features />
        <section id="practice" className="py-20 bg-white">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold font-display text-indigo-900 mb-4">
                Thử nghiệm công cụ kiểm tra
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto text-lg">
                Viết một câu tiếng Anh bất kỳ, chúng tôi sẽ giúp bạn sửa lỗi và học cách diễn đạt tự nhiên nhất.
              </p>
            </div>
            <AIDemo />
          </div>
        </section>
        
        {/* Social Proof */}
        <section className="py-20 bg-slate-50 border-t border-slate-100">
           <div className="container mx-auto px-4 text-center">
             <p className="text-slate-400 font-medium tracking-widest uppercase text-sm mb-8">Hơn 10,000+ học viên đã tin dùng</p>
             <div className="flex flex-wrap justify-center items-center gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
               <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/2560px-Google_2015_logo.svg.png" alt="Partner" className="h-8" />
               <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Facebook_logo_%282019%29.svg/2560px-Facebook_logo_%282019%29.svg.png" alt="Partner" className="h-8" />
               <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Logo_of_YouTube_%282015-2017%29.svg/2560px-Logo_of_YouTube_%282015-2017%29.svg.png" alt="Partner" className="h-8" />
               <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Slack_icon_2019.svg/2048px-Slack_icon_2019.svg.png" alt="Partner" className="h-8" />
             </div>
           </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default HomePage;
