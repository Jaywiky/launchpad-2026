SET search_path TO launchpad;

INSERT INTO food_banks (name, address, latitude, longitude) VALUES 
('Ladywood Food Bank', 'St Johns Church, Ladywood, Birmingham', 52.477200, -1.923100);

INSERT INTO toilets (name, address, latitude, longitude) VALUES 
('Ladywood Leisure Centre Toilets', 'Ladywood Middleway, Birmingham', 52.478500, -1.927500);

INSERT INTO digital_spaces (name, address, latitude, longitude) VALUES 
('Floating Front Room', 'Port Loop, Ladywood, Birmingham', 52.479500, -1.931800);

INSERT INTO recycling_plants (name, address, latitude, longitude) VALUES 
('Tyseley Household Recycling Centre', 'James Road, Tyseley, Birmingham', 52.455000, -1.840000);

INSERT INTO green_spaces (name, address, latitude, longitude) VALUES 
('Edgbaston Reservoir', 'Reservoir Road, Ladywood, Birmingham', 52.473500, -1.935200);

INSERT INTO libraries (name, address, latitude, longitude) VALUES 
('Spring Hill Library', 'Spring Hill, Birmingham', 52.484200, -1.916800);

INSERT INTO ui_translations (language_code, translation_key, translated_text) VALUES 
('en', 'nav_home', 'Home'),
('en', 'nav_map', 'Resource Map'),
('en', 'btn_search', 'Search'),
('ur', 'nav_home', 'ہوم'),
('ur', 'nav_map', 'وسائل کا نقشہ'),
('ur', 'btn_search', 'تلاش کریں'),
('pl', 'nav_home', 'Strona Główna'),
('pl', 'nav_map', 'Mapa Zasobów'),
('pl', 'btn_search', 'Szukaj');

INSERT INTO content_translations (resource_id, resource_type, language_code, translated_description) VALUES 
(1, 'food_banks', 'ur', 'مقامی کمیونٹی کے لیے مفت خوراک کی فراہمی'), 
(1, 'food_banks', 'pl', 'Darmowe wsparcie żywnościowe dla lokalnej społeczności'), 
(1, 'toilets', 'ur', 'عوامی بیت الخلاء اور بچے کی تبدیلی کی سہولیات'), 
(1, 'toilets', 'pl', 'Toalety publiczne i przewijaki dla dzieci'), 
(1, 'digital_spaces', 'ur', 'مفت وائی فائی، چائے اور ڈیجیٹل مدد'),
(1, 'digital_spaces', 'pl', 'Darmowe Wi-Fi, herbata i wsparcie cyfrowe'),
(1, 'recycling_plants', 'ur', 'گھریلو فضلہ اور ری سائیکلنگ ڈراپ آف'),
(1, 'recycling_plants', 'pl', 'Punkt zbiórki odpadów domowych i surowców wtórnych'),
(1, 'green_spaces', 'ur', 'پیدل چلنے اور فطرت کے لیے کھلا سبز علاقہ'),
(1, 'green_spaces', 'pl', 'Otwarty teren zielony do spacerów i kontaktu z naturą'),
(1, 'libraries', 'ur', 'عوامی لائبریری اور مطالعہ کی جگہ'),
(1, 'libraries', 'pl', 'Biblioteka publiczna i przestrzeń do nauki');