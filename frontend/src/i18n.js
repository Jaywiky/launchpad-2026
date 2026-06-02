import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "starting_up": "Starting up…",
      "settings": "Settings",
      "back": "← Back",
      "language_pref": "Language Preferences",
      "choose_lang": "Choose your preferred app language.",
      "offline_data": "Offline Data",
      "clear_data": "Clear Local Data",
      "clear_desc": "Clear cached local data to free up space.",
      "ladywood_resources": "Ladywood Resources",
      "all": "All Categories",
      "food_bank": "Food Banks",
      "toilet": "Public Toilets",
      "recycling": "Recycling Points",
      "library": "Libraries",
      "green_space": "Green Spaces",
      "loading_local_data": "Loading local data...",
      "no_resources_found": "No resources found.",
      "waiting_to_sync": "Waiting to sync with nearby peers over Bluetooth..."
    }
  },
  pl: {
    translation: {
      "starting_up": "Uruchamianie…",
      "settings": "Ustawienia",
      "back": "← Wstecz",
      "language_pref": "Preferencje językowe",
      "choose_lang": "Wybierz preferowany język aplikacji.",
      "offline_data": "Dane offline",
      "clear_data": "Wyczyść dane lokalne",
      "clear_desc": "Wyczyść pamięć podręczną danych, aby zwolnić miejsce.",
      "ladywood_resources": "Zasoby Ladywood",
      "all": "Wszystko",
      "food_bank": "Banki żywności",
      "toilet": "Toalety publiczne",
      "recycling": "Punkty recyklingu",
      "library": "Biblioteki",
      "green_space": "Zielone przestrzenie",
      "loading_local_data": "Ładowanie danych lokalnych...",
      "no_resources_found": "Nie znaleziono zasobów.",
      "waiting_to_sync": "Oczekiwanie na synchronizację z pobliskimi urządzeniami..."
    }
  },
  ur: {
    translation: {
      "starting_up": "شروع ہو رہا ہے...",
      "settings": "ترتیبات",
      "back": "واپس →",
      "language_pref": "زبان کی ترجیحات",
      "choose_lang": "اپنی پسندیدہ ایپ کی زبان منتخب کریں۔",
      "offline_data": "آف لائن ڈیٹا",
      "clear_data": "لوکل ڈیٹا صاف کریں۔",
      "clear_desc": "جگہ خالی کرنے کے لیے محفوظ کردہ لوکل ڈیٹا کو صاف کریں۔",
      "ladywood_resources": "لیڈی ووڈ وسائل",
      "all": "تمام زمرے",
      "food_bank": "فوڈ بینک",
      "toilet": "عوامی بیت الخلا",
      "recycling": "ری سائیکلنگ پوائنٹس",
      "library": "لائبریریاں",
      "green_space": "سبزہ زار",
      "loading_local_data": "لوکل ڈیٹا لوڈ ہو رہا ہے...",
      "no_resources_found": "کوئی وسائل نہیں ملے۔",
      "waiting_to_sync": "بلوٹوتھ کے ذریعے قریبی آلات کے ساتھ مطابقت پذیری کا انتظار ہے..."
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', 
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;