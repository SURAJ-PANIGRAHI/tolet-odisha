export const ODISHA_DISTRICTS = [
  'Balasore (ବାଲେଶ୍ୱର)',
  'Bhadrak (ଭଦ୍ରକ)',
  'Mayurbhanj / Baripada (ମୟୂରଭଞ୍ଜ)',
  'Khordha / Bhubaneswar (ଖୋର୍ଦ୍ଧା)',
  'Cuttack (କଟକ)',
  'Puri (ପୁରୀ)',
  'Ganjam / Berhampur (ଗଞ୍ଜାମ)',
  'Sambalpur (ସମ୍ବଲପୁର)',
  'Sundargarh / Rourkela (ସୁନ୍ଦରଗଡ଼)',
  'Angul (ଅନୁଗୋଳ)',
  'Balangir (ବଲାଙ୍ଗୀର)',
  'Bargarh (ବରଗଡ଼)',
  'Dhenkanal (ଢେଙ୍କାନାଳ)',
  'Jajpur (ଯାଜପୁର)',
  'Jharsuguda (ଝାରସୁଗୁଡ଼ା)',
  'Kalahandi / Bhawanipatna (କଳାହାଣ୍ଡି)',
  'Kandhamal / Phulbani (କନ୍ଧମାଳ)',
  'Kendrapara (କେନ୍ଦ୍ରାପଡ଼ା)',
  'Keonjhar (କେନ୍ଦୁଝର)',
  'Koraput / Jeypore (କୋରାପୁଟ)',
  'Malkangiri (ମାଲକାନଗିରି)',
  'Nabarangpur (ନବରଙ୍ଗପୁର)',
  'Nayagarh (ନୟାଗଡ଼)',
  'Nuapada (ନୂଆପଡ଼ା)',
  'Rayagada (ରାୟଗଡ଼ା)',
  'Subarnapur / Sonepur (ସୁବର୍ଣ୍ଣପୁର)',
  'Deogarh (ଦେବଗଡ଼)',
  'Gajapati / Paralakhemundi (ଗଜପତି)',
  'Boudh (ବୌଦ୍ଧ)'
];

export const DISTRICT_LOCALITIES: Record<string, string[]> = {
  'Balasore': [
    'Azimabad',
    'Mallikashpur',
    'Nalamganj',
    'Angargadia',
    'Sahadevkhunta',
    'Station Bazaar',
    'Motiganj',
    'Cinema Chhaka',
    'FM College Road',
    'Remuna',
    'Gopalpur',
    'Sunhat',
    'Sovarampur',
    'OT Road',
    'Phandi Chhaka',
    'Kuruda',
    'Balia',
    'Noonachhati',
    'Soro',
    'Jaleswar',
    'Basta',
    'Nilagiri',
    'Other / ଅନ୍ୟାନ୍ୟ'
  ],
  'Khordha': [
    'Patia',
    'Khandagiri',
    'Jayadev Vihar',
    'Saheed Nagar',
    'Nayapalli',
    'Chandrasekharpur',
    'Acharya Vihar',
    'Old Town',
    'Rasulgarh',
    'KIIT Road',
    'Jatani',
    'Khordha Town',
    'Other / ଅନ୍ୟାନ୍ୟ'
  ],
  'Cuttack': [
    'Badambadi',
    'College Square',
    'Madhupatna',
    'CDA Sector',
    'Ranihat',
    'Chandi Mandir Chhaka',
    'Buxi Bazaar',
    'Mangalabag',
    'Choudwar',
    'Other / ଅନ୍ୟାନ୍ୟ'
  ],
  'Puri': [
    'Grand Road (Bada Danda)',
    'VIP Road',
    'Sea Beach Road',
    'Chandanpur',
    'Konark',
    'Pipili',
    'Other / ଅନ୍ୟାନ୍ୟ'
  ],
  'Bhadrak': [
    'Charampa',
    'Bhadrak Town',
    'Bonth Chhaka',
    'Arnapal',
    'Gelpur',
    'Basudevpur',
    'Chandabali',
    'Other / ଅନ୍ୟାନ୍ୟ'
  ],
  'Mayurbhanj': [
    'Baripada Town',
    'Baghra Road',
    'Takhatpur',
    'Station Road',
    'Rairangpur',
    'Karanjia',
    'Other / ଅନ୍ୟାନ୍ୟ'
  ],
  'Sambalpur': [
    'Budharaja',
    'Dhanupali',
    'Ainthapali',
    'Burla (VSSUT / VIMSAR)',
    'Khetrajpur',
    'Bareipali',
    'Other / ଅନ୍ୟାନ୍ୟ'
  ],
  'Sundargarh': [
    'Rourkela Sector Areas',
    'Civil Township',
    'Koel Nagar',
    'Chhend Colony',
    'Panposh',
    'Uditnagar',
    'Sundargarh Town',
    'Other / ଅନ୍ୟାନ୍ୟ'
  ],
  'Ganjam': [
    'Berhampur Town',
    'Gosaninuagaon',
    'Ankushpur',
    'Courtpeta',
    'Brahmapur Railway Station',
    'Chhatrapur',
    'Other / ଅନ୍ୟାନ୍ୟ'
  ],
  'Angul': [
    'Angul Town',
    'Talcher',
    'Nalco Nagar',
    'Banarpal',
    'Other / ଅନ୍ୟାନ୍ୟ'
  ],
  'Jajpur': [
    'Jajpur Road (Vyasanagar)',
    'Jajpur Town',
    'Kalinga Nagar',
    'Chandikhol',
    'Other / ଅନ୍ୟାନ୍ୟ'
  ]
};

export const CATEGORIES = [
  { id: 'All', label: 'All Listings', labelOdia: 'ସବୁ ବିଜ୍ଞାପନ' },
  { id: 'Boys Mess', label: 'Boys Mess', labelOdia: 'ପୁଅ ମେସ୍' },
  { id: 'Ladies Mess', label: 'Ladies Mess', labelOdia: 'ମହିଳା ମେସ୍' },
  { id: 'Paying Guest (PG)', label: 'Paying Guest (PG)', labelOdia: 'ପେଇଂ ଗେଷ୍ଟ (PG)' },
  { id: 'Boys Hostel', label: 'Boys Hostel', labelOdia: 'ପୁଅ ହଷ୍ଟେଲ' },
  { id: 'Girls Hostel', label: 'Girls Hostel', labelOdia: 'ଝିଅ ହଷ୍ଟେଲ' },
  { id: 'Bachelor Room', label: 'Single / Bachelor Room', labelOdia: 'ବ୍ୟାଚଲର ରୁମ୍' },
  { id: '1 BHK Flat', label: '1 BHK Flat', labelOdia: '୧ ବିଏଚକେ ଫ୍ଲାଟ' },
  { id: '2 BHK Flat', label: '2 BHK Flat', labelOdia: '୨ ବିଏଚକେ ଫ୍ଲାଟ' },
  { id: 'Family House', label: 'Family House', labelOdia: 'ପରିବାର ପାଇଁ ଘର' },
  { id: 'Commercial / Shop', label: 'Commercial', labelOdia: 'ଦୋକାନ / କମର୍ସିଆଲ' },
  { id: 'Tutor / Tuition', label: 'Tuition / Coaching', labelOdia: 'ଟିଉସନ୍ / କୋଚିଂ' }
];

export const POPULAR_AMENITIES = [
  'Air Conditioned',
  'Furnished',
  'Semi-furnished',
  'Unfurnished',
  'Wi-Fi',
  'Drinking Water (RO)',
  'Attached Washroom',
  'Mess Food Available',
  'Bike Parking',
  'Car Parking',
  'Power Backup / Inverter',
  'CCTV / Security Guard',
  '24x7 Water Supply'
];

export const COMMERCIAL_TYPES = ['Office Space', 'Shop / Showroom', 'Bank / ATM Space', 'Warehouse / Godown', 'Other Commercial'] as const;

export const FURNISHING_OPTIONS = ['Furnished', 'Semi-furnished', 'Unfurnished'];
export function toggleAmenitySelection(current: string[], amenity: string): string[] {
  if (current.includes(amenity)) return current.filter(item => item !== amenity);
  const remaining = FURNISHING_OPTIONS.includes(amenity) ? current.filter(item => !FURNISHING_OPTIONS.includes(item)) : current;
  return [...remaining, amenity];
}
