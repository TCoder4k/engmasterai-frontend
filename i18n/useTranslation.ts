import { useLanguageContext } from './LanguageProvider';

// The single access point components use for localized text:
//   const { t, language, setLanguage } = useTranslation();
export const useTranslation = useLanguageContext;
