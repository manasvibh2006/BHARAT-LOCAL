import { getPgPool } from './connection';
import fs from 'fs';
import path from 'path';

async function seed() {
  console.log('🌱 Starting Bharat Local Database Seeder...');
  const pool = getPgPool();
  if (!pool) {
    console.error('Cannot seed: PostgreSQL pool could not be initialized.');
    process.exit(1);
  }

  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL.');

    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    console.log('Executing schema.sql DDL & indexes...');
    await client.query(schemaSql);

    console.log('Inserting Categories...');
    await client.query(`
      INSERT INTO categories (id, name_en, name_hi, icon) VALUES
      ('announcements', 'Announcements & Alerts', 'घोषणाएँ और अलर्ट', '📢'),
      ('services', 'Local Services & Utilities', 'स्थानीय सेवाएँ और सुविधाएँ', '🛠️'),
      ('emergency', 'Emergency & Urgent Aid', 'आपातकालीन सहायता', '🚨'),
      ('help_wanted', 'Help Wanted & Jobs', 'सहायता / रोज़गार', '💼'),
      ('buy_sell', 'Buy, Sell & Rent', 'खरीद, बिक्री और किराया', '🏷️'),
      ('events', 'Community Events & Gatherings', 'सामुदायिक कार्यक्रम', '🎪'),
      ('lost_found', 'Lost & Found', 'खोया-पाया', '🔍')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log('Inserting Seed Users & Demo Personas...');
    await client.query(`
      INSERT INTO users (id, phone, name, role, preferred_language, state, city, locality, pincode) VALUES
      ('11111111-1111-4111-8111-111111111111', '+919999999999', 'Dr. Ramesh Sharma (District Admin)', 'admin', 'hi', 'Rajasthan', 'Jaipur', 'C-Scheme', '302001'),
      ('22222222-2222-4222-8222-222222222222', '+918888888888', 'Priya Sundaram (Community Lead)', 'moderator', 'ta', 'Tamil Nadu', 'Chennai', 'Mylapore', '600004'),
      ('33333333-3333-4333-8333-333333333333', '+919876543210', 'Anand Kumar', 'user', 'kn', 'Karnataka', 'Bengaluru', 'Indiranagar', '560038'),
      ('44444444-4444-4444-8444-444444444444', '+919812345678', 'Sunita Meena', 'user', 'hi', 'Rajasthan', 'Jaipur', 'Malviya Nagar', '302017')
      ON CONFLICT (phone) DO NOTHING;
    `);

    console.log('Inserting Multilingual Hyperlocal Posts...');
    await client.query(`
      INSERT INTO posts (author_id, category_id, title, content, language, state, city, locality, pincode, contact_info, status) VALUES
      (
        '11111111-1111-4111-8111-111111111111',
        'announcements',
        'जल आपूर्ति रखरखाव सूचना - वैशाली नगर एवं सी-स्कीम',
        'कल सुबह 8:00 से दोपहर 2:00 बजे तक पाइपलाइन मरम्मत के कारण पानी की आपूर्ति बाधित रहेगी। कृपया पर्याप्त पानी का भंडारण करें। आपातकालीन टैंकर के लिए वार्ड हेल्पलाइन पर संपर्क करें।',
        'hi',
        'Rajasthan',
        'Jaipur',
        'C-Scheme',
        '302001',
        '0141-2223344 (नगर निगम हेल्पडेस्क)',
        'active'
      ),
      (
        '33333333-3333-4333-8333-333333333333',
        'services',
        'Affordable Kannada & English Spoken Tutoring for High School Students',
        'Experienced retired teacher offering weekend math and language coaching in Indiranagar 12th Main. Batches start this Saturday. Nominal fees for local residents.',
        'en',
        'Karnataka',
        'Bengaluru',
        'Indiranagar',
        '560038',
        '+919876543210 (WhatsApp)',
        'active'
      ),
      (
        '22222222-2222-4222-8222-222222222222',
        'events',
        'இலவச மருத்துவ முகாம் மற்றும் கண் பரிசோதனை - மயிலாப்பூர்',
        'இந்த ஞாயிற்றுக்கிழமை காலை 9 மணி முதல் மாலை 3 மணி வரை மயிலாப்பூர் சமூகக் கூடத்தில் பொது மருத்துவ முகாம் நடைபெறுகிறது. இரத்த அழுத்தம், சர்க்கரை மற்றும் கண் பரிசோதனை இலவசம்.',
        'ta',
        'Tamil Nadu',
        'Chennai',
        'Mylapore',
        '600004',
        '044-24987654 (ரெட்கிராஸ் மையம்)',
        'active'
      ),
      (
        '44444444-4444-4444-8444-444444444444',
        'help_wanted',
        'रिक्शा व ऑटो चालक भाईयों के लिए स्थानीय सहकारी समूह भर्ती',
        'मालवीय नगर मेट्रो स्टेशन के पास हमारे स्थानीय सहयोग समूह में 5 ईमानदार ड्राइवरों की आवश्यकता है। लचीले घंटे और उचित दैनिक पारिश्रमिक।',
        'hi',
        'Rajasthan',
        'Jaipur',
        'Malviya Nagar',
        '302017',
        '+919812345678',
        'active'
      )
      ON CONFLICT DO NOTHING;
    `);

    client.release();
    console.log('✅ Seeding complete! Database ready for production.');
    process.exit(0);
  } catch (err: any) {
    console.error('Seeding error:', err.message);
    process.exit(1);
  }
}

seed();
