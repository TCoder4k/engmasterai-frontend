
import React from 'react';
import { Course } from '../../types';

interface CourseCardProps {
  course: Course;
}

const TYPE_LABELS: Record<Course['type'], string> = {
  GRAMMAR: 'Ngữ pháp',
  VOCABULARY: 'Từ vựng',
  LISTENING: 'Nghe',
};

const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  return (
    <div className="bg-white rounded-[24px] shadow-lg p-8 flex flex-col items-center text-center h-full group transition-all duration-300 hover:border-indigo-100 border border-transparent relative">
      <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mb-4">
        {TYPE_LABELS[course.type]}
      </span>

      <h3 className="text-[18px] font-extrabold text-slate-900 mb-8 leading-tight group-hover:text-indigo-500 transition-colors">
        {course.title}
      </h3>

      <div className="relative mb-8">
        <div className="w-32 h-32 rounded-full border-4 border-slate-50 group-hover:border-indigo-50 overflow-hidden p-1 bg-white transition-all duration-300">
          {course.thumbnail ? (
            <img
              src={course.thumbnail}
              alt={course.title}
              className="w-full h-full object-cover rounded-full grayscale-[0.2] group-hover:grayscale-0 transition-all"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-slate-100" />
          )}
        </div>
      </div>

      <p className="text-slate-500 text-[14px] leading-relaxed mb-10 px-2 h-14 overflow-hidden font-medium">
        {course.description}
      </p>

      <div className="w-full mt-auto">
        <button className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-[15px] rounded-2xl transition-all shadow-md shadow-indigo-100 active:scale-95">
          Bắt đầu học
        </button>
      </div>
    </div>
  );
};

export default CourseCard;
