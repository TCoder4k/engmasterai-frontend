import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
  action?: { label: string; onClick: () => void };
}

// Honest "nothing here yet" surface — never a fabricated number or
// invented content, matching the convention already established by
// UserSidebar/ContinueLearningCard's empty states.
const EmptyState: React.FC<EmptyStateProps> = ({ icon, message, action }) => (
  <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-lg dark:shadow-none dark:border dark:border-slate-800 p-12 text-center">
    <div className="mx-auto text-slate-200 dark:text-slate-700 mb-4 flex justify-center" aria-hidden="true">
      {icon || <Inbox size={32} />}
    </div>
    <p className="text-sm font-medium text-slate-400 dark:text-slate-500">{message}</p>
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className="mt-4 text-sm font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg px-2 py-1"
      >
        {action.label}
      </button>
    )}
  </div>
);

export default EmptyState;
