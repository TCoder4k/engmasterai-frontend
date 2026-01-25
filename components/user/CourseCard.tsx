
import React from 'react';
import { Course } from './constants';

interface CourseCardProps {
  course: Course;
}

const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  return (
    <div className="bg-white rounded-[24px] shadow-lg p-8 flex flex-col items-center text-center h-full group transition-all duration-300 hover:border-indigo-100 border border-transparent relative">
      <h3 className="text-[18px] font-extrabold text-slate-900 mb-8 leading-tight group-hover:text-indigo-500 transition-colors">
        {course.title}
      </h3>

      <div className="relative mb-8">
        <div className="w-32 h-32 rounded-full border-4 border-slate-50 group-hover:border-indigo-50 overflow-hidden p-1 bg-white transition-all duration-300">
          <img 
            src={course.thumbnail} 
            alt={course.title} 
            className="w-full h-full object-cover rounded-full grayscale-[0.2] group-hover:grayscale-0 transition-all"
          />
        </div>
      </div>

      <p className="text-slate-500 text-[14px] leading-relaxed mb-10 px-2 h-14 overflow-hidden font-medium">
        {course.description}
      </p>

      <div className="w-full mt-auto space-y-6">
        {/* Modern Progress Bar */}
        <div className="relative w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 transition-all duration-700 ease-in-out" 
            style={{ width: `${course.progress}%` }}
          />
        </div>
        
        <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
          <span>Tiến độ</span>
          <span className="text-indigo-500">{course.completedLessons} / {course.totalLessons} Bài</span>
        </div>

        <button className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-[15px] rounded-2xl transition-all shadow-md shadow-indigo-100 active:scale-95">
          Tiếp tục học
        </button>
      </div>
    </div>
  );
};

export default CourseCard;
