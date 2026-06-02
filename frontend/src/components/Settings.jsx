import { useTranslation } from 'react-i18next';
import i18n from '../i18n'; 
export default function Settings({ onClose }) {
  const { t } = useTranslation();

  const currentLang = i18n.language || 'en';
  const isSelected = (langCode) => currentLang.startsWith(langCode);

  const changeLanguage = (lng) => {
    console.log(`[Settings] Core engine language swap triggered: ${lng}`);

    i18n.changeLanguage(lng)
      .then(() => {
        console.log(`[Settings] Engine successfully changed active language to: ${i18n.language}`);
      })
      .catch((err) => {
        console.error(`[Settings] Core engine failed to switch languages:`, err);
      });

    if (lng === 'ur') {
      document.body.dir = 'rtl';
    } else {
      document.body.dir = 'ltr';
    }
  };

  return (
    <div className="h-screen w-full bg-[#111111] text-white p-6 overflow-y-auto">
      <div className="flex items-center mb-8">
        <button
          onClick={() => {
            console.log('[Settings] Returning back to main map layer view.');
            onClose();
          }}
          className="bg-[#333333] hover:bg-[#444444] text-white px-4 py-2 rounded-lg mr-4 ml-4 transition-colors"
        >
          {t('back')}
        </button>
        <h1 className="text-2xl font-bold">{t('settings')}</h1>
      </div>

      <div className="space-y-6">
        <div className="bg-[#222222] p-4 rounded-xl border border-[#333333]">
          <h2 className="text-lg font-semibold mb-2">{t('language_pref')}</h2>
          <p className="text-sm text-gray-400 mb-4">{t('choose_lang')}</p>

          <div className="flex gap-2">
            <button
              onClick={() => changeLanguage('en')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${isSelected('en') ? 'bg-[#e2f0d9] text-green-900' : 'bg-[#333333] text-gray-400'
                }`}
            >
              English
            </button>
            <button
              onClick={() => changeLanguage('pl')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${isSelected('pl') ? 'bg-[#e2f0d9] text-green-900' : 'bg-[#333333] text-gray-400'
                }`}
            >
              Polski
            </button>
            <button
              onClick={() => changeLanguage('ur')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${isSelected('ur') ? 'bg-[#e2f0d9] text-green-900' : 'bg-[#333333] text-gray-400'
                }`}
            >
              اردو
            </button>
          </div>
        </div>

        <div className="bg-[#222222] p-4 rounded-xl border border-[#333333]">
          <h2 className="text-lg font-semibold mb-2">Toggle P2P</h2>
          <p className="text-sm text-gray-400">Toggle the ability to download data from Bluetooth.</p>
          <button className="mt-4 bg-red-900/30 text-red-400 border border-red-900/50 px-4 py-2 rounded-lg text-sm font-medium">
            Toggle P2P
          </button>
        </div>
      </div>
    </div>
  );
}