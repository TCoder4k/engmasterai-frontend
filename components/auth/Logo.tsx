
import React from 'react';
import { Logo as BrandLogo } from '../shared/Logo';

export const Logo: React.FC = () => {
  return (
    <div className="flex flex-col items-center mb-8 select-none">
      <BrandLogo size="lg" withTagline />

      {/* Một dải trang trí nhỏ bên dưới */}
      <div className="mt-4 w-12 h-1 bg-blue-100 rounded-full"></div>
    </div>
  );
};
