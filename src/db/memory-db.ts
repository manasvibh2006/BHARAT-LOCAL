import { randomUUID } from 'crypto';
import { User, Category, Post, PostReport, ModerationAction, Notification, OtpRecord } from './schema';
import { POST_CATEGORIES } from '../config/constants';

function generateId(): string {
  return randomUUID();
}

export class MemoryDatabase {
  users: Map<string, User> = new Map();
  categories: Map<string, Category> = new Map();
  posts: Map<string, Post> = new Map();
  reports: Map<string, PostReport> = new Map();
  moderationActions: ModerationAction[] = [];
  notifications: Map<string, Notification> = new Map();
  otpRecords: Map<string, OtpRecord> = new Map();

  constructor() {
    this.initDefaultCategories();
    this.seedInitialData();
  }

  private initDefaultCategories() {
    for (const cat of POST_CATEGORIES) {
      this.categories.set(cat.id, {
        id: cat.id,
        name_en: cat.name_en,
        name_hi: cat.name_hi,
        translations: {
          ta: cat.id === 'announcements' ? 'அறிவிப்புகள்' : cat.name_en,
          te: cat.id === 'announcements' ? 'ప్రకటనలు' : cat.name_en,
          mr: cat.id === 'announcements' ? 'घोषणा' : cat.name_en
        },
        icon: cat.icon,
        is_active: true,
        created_at: new Date().toISOString()
      });
    }
  }

  public seedInitialData() {
    // 1. Admin Persona
    const adminId = '11111111-1111-4111-8111-111111111111';
    this.users.set(adminId, {
      id: adminId,
      phone: '+919999999999',
      name: 'Dr. Ramesh Sharma (District Admin)',
      role: 'admin',
      preferred_language: 'hi',
      state: 'Rajasthan',
      city: 'Jaipur',
      locality: 'C-Scheme',
      pincode: '302001',
      latitude: 26.9124,
      longitude: 75.7873,
      is_banned: false,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      updated_at: new Date().toISOString()
    });

    // 2. Moderator Persona
    const modId = '22222222-2222-4222-8222-222222222222';
    this.users.set(modId, {
      id: modId,
      phone: '+918888888888',
      name: 'Priya Sundaram (Community Lead)',
      role: 'moderator',
      preferred_language: 'ta',
      state: 'Tamil Nadu',
      city: 'Chennai',
      locality: 'Mylapore',
      pincode: '600004',
      latitude: 13.0339,
      longitude: 80.2694,
      is_banned: false,
      created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
      updated_at: new Date().toISOString()
    });

    // 3. Regular Citizen Persona (Bengaluru)
    const citizenId1 = '33333333-3333-4333-8333-333333333333';
    this.users.set(citizenId1, {
      id: citizenId1,
      phone: '+919876543210',
      name: 'Anand Kumar',
      role: 'user',
      preferred_language: 'kn',
      state: 'Karnataka',
      city: 'Bengaluru',
      locality: 'Indiranagar',
      pincode: '560038',
      latitude: 12.9784,
      longitude: 77.6408,
      is_banned: false,
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      updated_at: new Date().toISOString()
    });

    // 4. Regular Citizen Persona (Jaipur)
    const citizenId2 = '44444444-4444-4444-8444-444444444444';
    this.users.set(citizenId2, {
      id: citizenId2,
      phone: '+919812345678',
      name: 'Sunita Meena',
      role: 'user',
      preferred_language: 'hi',
      state: 'Rajasthan',
      city: 'Jaipur',
      locality: 'Malviya Nagar',
      pincode: '302017',
      latitude: 26.8525,
      longitude: 75.8237,
      is_banned: false,
      created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      updated_at: new Date().toISOString()
    });

    // Realistic Multilingual Community Posts across Indian Cities
    const samplePosts: Omit<Post, 'id' | 'view_count' | 'report_count' | 'created_at' | 'updated_at'>[] = [
      {
        author_id: adminId,
        category_id: 'announcements',
        title: 'जल आपूर्ति रखरखाव सूचना - वैशाली नगर एवं सी-स्कीम',
        content: 'कल सुबह 8:00 से दोपहर 2:00 बजे तक पाइपलाइन मरम्मत के कारण पानी की आपूर्ति बाधित रहेगी। कृपया पर्याप्त पानी का भंडारण करें। आपातकालीन टैंकर के लिए वार्ड हेल्पलाइन पर संपर्क करें।',
        language: 'hi',
        state: 'Rajasthan',
        city: 'Jaipur',
        locality: 'C-Scheme',
        pincode: '302001',
        latitude: 26.9124,
        longitude: 75.7873,
        contact_info: '0141-2223344 (नगर निगम हेल्पडेस्क)',
        status: 'active'
      },
      {
        author_id: citizenId1,
        category_id: 'services',
        title: 'Affordable Kannada & English Spoken Tutoring for High School Students',
        content: 'Experienced retired teacher offering weekend math and language coaching in Indiranagar 12th Main. Batches start this Saturday. Nominal fees for local residents.',
        language: 'en',
        state: 'Karnataka',
        city: 'Bengaluru',
        locality: 'Indiranagar',
        pincode: '560038',
        latitude: 12.9784,
        longitude: 77.6408,
        contact_info: '+919876543210 (WhatsApp)',
        status: 'active'
      },
      {
        author_id: modId,
        category_id: 'events',
        title: 'இலவச மருத்துவ முகாம் மற்றும் கண் பரிசோதனை - மயிலாப்பூர்',
        content: 'இந்த ஞாயிற்றுக்கிழமை காலை 9 மணி முதல் மாலை 3 மணி வரை மயிலாப்பூர் சமூகக் கூடத்தில் பொது மருத்துவ முகாம் நடைபெறுகிறது. இரத்த அழுத்தம், சர்க்கரை மற்றும் கண் பரிசோதனை இலவசம்.',
        language: 'ta',
        state: 'Tamil Nadu',
        city: 'Chennai',
        locality: 'Mylapore',
        pincode: '600004',
        latitude: 13.0339,
        longitude: 80.2694,
        contact_info: '044-24987654 (ரெட்கிராஸ் மையம்)',
        status: 'active'
      },
      {
        author_id: citizenId2,
        category_id: 'help_wanted',
        title: 'रिक्शा व ऑटो चालक भाईयों के लिए स्थानीय सहकारी समूह भर्ती',
        content: 'मालवीय नगर मेट्रो स्टेशन के पास हमारे स्थानीय सहयोग समूह में 5 ईमानदार ड्राइवरों की आवश्यकता है। लचीले घंटे और उचित दैनिक पारिश्रमिक।',
        language: 'hi',
        state: 'Rajasthan',
        city: 'Jaipur',
        locality: 'Malviya Nagar',
        pincode: '302017',
        latitude: 26.8525,
        longitude: 75.8237,
        contact_info: '+919812345678',
        status: 'active'
      },
      {
        author_id: citizenId1,
        category_id: 'emergency',
        title: 'Emergency Blood Requirement (O+ve) at Manipal Hospital Old Airport Rd',
        content: 'Urgent requirement of 2 units of O Positive blood for surgery patient. Any willing donor kindly reach out immediately or report to the blood bank.',
        language: 'en',
        state: 'Karnataka',
        city: 'Bengaluru',
        locality: 'Old Airport Road',
        pincode: '560017',
        latitude: 12.9592,
        longitude: 77.6534,
        contact_info: '+919876543210 / Hospital Desk',
        status: 'active'
      },
      {
        author_id: citizenId2,
        category_id: 'lost_found',
        title: 'खोया पर्स मिला: गौरव टावर के पास (काले रंग का लेदर पर्स)',
        content: 'कल शाम जीटी मॉल के प्रवेश द्वार पर एक काला पर्स मिला है जिसमें कुछ आईडी कार्ड और दस्तावेज हैं। सही पहचान बताकर इसे प्राप्त करें।',
        language: 'hi',
        state: 'Rajasthan',
        city: 'Jaipur',
        locality: 'Malviya Nagar',
        pincode: '302017',
        latitude: 26.8525,
        longitude: 75.8237,
        contact_info: '+919812345678',
        status: 'active'
      },
      {
        author_id: citizenId1,
        category_id: 'buy_sell',
        title: 'Organic Cow Ghee & Cold Pressed Oils from Local Doddaballapur Farm',
        content: 'Fresh batch delivered every Tuesday to Indiranagar, Koramangala & Whitefield. 100% pure A2 milk ghee crafted through traditional bilona method.',
        language: 'en',
        state: 'Karnataka',
        city: 'Bengaluru',
        locality: 'Indiranagar',
        pincode: '560038',
        latitude: 12.9784,
        longitude: 77.6408,
        contact_info: '+919876543210',
        status: 'active'
      }
    ];

    let offsetMinutes = 500;
    for (const postData of samplePosts) {
      const postId = generateId();
      const author = this.users.get(postData.author_id);
      const category = this.categories.get(postData.category_id);

      this.posts.set(postId, {
        id: postId,
        ...postData,
        author_name: author?.name || 'Local Resident',
        author_phone: author?.phone,
        category_name: category?.name_en || postData.category_id,
        report_count: 0,
        view_count: Math.floor(Math.random() * 45) + 5,
        created_at: new Date(Date.now() - offsetMinutes * 60000).toISOString(),
        updated_at: new Date(Date.now() - offsetMinutes * 60000).toISOString()
      });
      offsetMinutes -= 60;
    }

    // Seed one reported post for moderation testing
    const flaggedPostId = generateId();
    this.posts.set(flaggedPostId, {
      id: flaggedPostId,
      author_id: citizenId2,
      author_name: 'Sunita Meena',
      author_phone: '+919812345678',
      category_id: 'services',
      category_name: 'Local Services & Utilities',
      title: 'Suspicious quick loan advertisement without verification',
      content: 'Get 50,000 instant cash without Aadhaar or PAN card. Click link or transfer processing fee.',
      language: 'en',
      state: 'Rajasthan',
      city: 'Jaipur',
      locality: 'Malviya Nagar',
      pincode: '302017',
      latitude: 26.8525,
      longitude: 75.8237,
      contact_info: 'unknown-telegram',
      status: 'flagged',
      report_count: 2,
      view_count: 12,
      created_at: new Date(Date.now() - 120 * 60000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 60000).toISOString()
    });

    const reportId = generateId();
    this.reports.set(reportId, {
      id: reportId,
      post_id: flaggedPostId,
      reporter_id: citizenId1,
      reporter_name: 'Anand Kumar',
      reason: 'fraud',
      details: 'This post is promoting an illegal loan scam asking for advance processing fees.',
      status: 'pending',
      created_at: new Date(Date.now() - 30 * 60000).toISOString(),
      post_title: 'Suspicious quick loan advertisement without verification'
    });
  }
}

export const memoryDb = new MemoryDatabase();
