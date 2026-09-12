// Tamil Utility Engine for Address Directory System
// Handles: Transliteration (Tanglish -> Tamil), Tamil Auto-Detection, Tamil Alphabetical Sorting, and Tamil Districts.

export function isTamilText(text) {
  if (!text || typeof text !== 'string') return false;
  return /[\u0B80-\u0BFF]/.test(text);
}

// Map of Tamil Nadu 38 Districts (English & Tamil)
export const RAW_DISTRICTS_DATA = [
  { id: 'Ariyalur', en: 'Ariyalur', ta: 'அரியலூர்' },
  { id: 'Chengalpattu', en: 'Chengalpattu', ta: 'செங்கல்பட்டு' },
  { id: 'Chennai', en: 'Chennai', ta: 'சென்னை' },
  { id: 'Coimbatore', en: 'Coimbatore', ta: 'கோயம்புத்தூர்' },
  { id: 'Cuddalore', en: 'Cuddalore', ta: 'கடலூர்' },
  { id: 'Dharmapuri', en: 'Dharmapuri', ta: 'தர்மபுரி' },
  { id: 'Dindigul', en: 'Dindigul', ta: 'திண்டுக்கல்' },
  { id: 'Erode', en: 'Erode', ta: 'ஈரோடு' },
  { id: 'Kallakurichi', en: 'Kallakurichi', ta: 'கள்ளக்குறிச்சி' },
  { id: 'Kanchipuram', en: 'Kanchipuram', ta: 'காஞ்சீபுரம்' },
  { id: 'Kanyakumari', en: 'Kanyakumari', ta: 'கன்னியாகுமரி' },
  { id: 'Karur', en: 'Karur', ta: 'கரூர்' },
  { id: 'Krishnagiri', en: 'Krishnagiri', ta: 'கிருஷ்ணகிரி' },
  { id: 'Madurai', en: 'Madurai', ta: 'மதுரை' },
  { id: 'Mayiladuthurai', en: 'Mayiladuthurai', ta: 'மயிலாடுதுறை' },
  { id: 'Nagapattinam', en: 'Nagapattinam', ta: 'நாகப்பட்டினம்' },
  { id: 'Namakkal', en: 'Namakkal', ta: 'நாமக்கல்' },
  { id: 'Nilgiris', en: 'Nilgiris', ta: 'நீலகிரி' },
  { id: 'Perambalur', en: 'Perambalur', ta: 'பெரம்பலூர்' },
  { id: 'Pudukkottai', en: 'Pudukkottai', ta: 'புதுக்கோட்டை' },
  { id: 'Ramanathapuram', en: 'Ramanathapuram', ta: 'இராமநாதபுரம்' },
  { id: 'Ranipet', en: 'Ranipet', ta: 'ராணிப்பேட்டை' },
  { id: 'Salem', en: 'Salem', ta: 'சேலம்' },
  { id: 'Sivaganga', en: 'Sivaganga', ta: 'சிவகங்கை' },
  { id: 'Tenkasi', en: 'Tenkasi', ta: 'தென்காசி' },
  { id: 'Thanjavur', en: 'Thanjavur', ta: 'தஞ்சாவூர்' },
  { id: 'Theni', en: 'Theni', ta: 'தேனி' },
  { id: 'Thoothukudi', en: 'Thoothukudi', ta: 'தூத்துக்குடி' },
  { id: 'Tiruchirappalli', en: 'Tiruchirappalli', ta: 'திருச்சிராப்பள்ளி' },
  { id: 'Tirunelveli', en: 'Tirunelveli', ta: 'திருநெல்வேலி' },
  { id: 'Tirupathur', en: 'Tirupathur', ta: 'திருப்பத்தூர்' },
  { id: 'Tiruppur', en: 'Tiruppur', ta: 'திருப்பூர்' },
  { id: 'Tiruvallur', en: 'Tiruvallur', ta: 'திருவள்ளூர்' },
  { id: 'Tiruvannamalai', en: 'Tiruvannamalai', ta: 'திருவண்ணாமலை' },
  { id: 'Tiruvarur', en: 'Tiruvarur', ta: 'திருவாரூர்' },
  { id: 'Vellore', en: 'Vellore', ta: 'வேலூர்' },
  { id: 'Viluppuram', en: 'Viluppuram', ta: 'விழுப்புரம்' },
  { id: 'Virudhunagar', en: 'Virudhunagar', ta: 'விருதுநகர்' }
];

// Sort Districts by Tamil Alphabetical Order (அ - ன)
const taCollator = new Intl.Collator('ta', { sensitivity: 'base', numeric: true });

export const SORTED_TAMIL_DISTRICTS = [...RAW_DISTRICTS_DATA].sort((a, b) =>
  taCollator.compare(a.ta, b.ta)
);

// Dictionary for common Tanglish words & names
const DIRECT_DICTIONARY = {
  'mu': 'மு',
  'mul': 'முல்',
  'murali': 'முரளி',
  'kumar': 'குமார்',
  'kumaran': 'குமாரன்',
  'raj': 'ராஜ்',
  'rajan': 'ராஜன்',
  'rajesh': 'ராஜேஷ்',
  'suresh': 'சுரேஷ்',
  'ramesh': 'ரமேஷ்',
  'ganesh': 'கணேஷ்',
  'dinesh': 'தனேஷ்',
  'karthik': 'கார்த்திக்',
  'vijay': 'விஜய்',
  'vikram': 'விக்ரம்',
  'anand': 'ஆனந்த்',
  'aarav': 'ஆரவ்',
  'aditi': 'அதிதி',
  'deepak': 'தீபக்',
  'lakshmi': 'லக்ஷ்மி',
  'meena': 'மீனா',
  'sanjay': 'சஞ்சய்',
  'pria': 'ப்ரியா',
  'priya': 'ப்ரியா',
  'se': 'செ',
  'selvam': 'செல்வம்',
  'selvi': 'செல்வி',
  'chennai': 'சென்னை',
  'kovai': 'கோவை',
  'coimbatore': 'கோயம்புத்தூர்',
  'madurai': 'மதுரை',
  'trichy': 'திருச்சி',
  'tiruchirappalli': 'திருச்சிராப்பள்ளி',
  'salem': 'சேலம்',
  'erode': 'ஈரோடு',
  'tirunelveli': 'திருநெல்வேலி',
  'thanjavur': 'தஞ்சாவூர்',
  'vellore': 'வேலூர்',
  'tuticorin': 'தூத்துக்குடி',
  'thoothukudi': 'தூத்துக்குடி',
  'kanchipuram': 'காஞ்சீபுரம்',
  'kanyakumari': 'கன்னியாகுமரி',
  'karur': 'கரூர்',
  'namakkal': 'நாமக்கல்',
  'dharapuram': 'தாராபுரம்',
  'pollachi': 'பொள்ளாச்சி',
  'nagar': 'நகர்',
  'street': 'தெரு',
  'salai': 'சாலை',
  'road': 'ரோடு'
};

// Phonetic Tanglish to Tamil Unicode Transliteration Engine
export function transliterateToTamil(input) {
  if (!input || typeof input !== 'string') return '';
  const cleanInput = input.trim();
  if (isTamilText(cleanInput)) return cleanInput;

  const lower = cleanInput.toLowerCase();

  // Check direct dictionary first
  if (DIRECT_DICTIONARY[lower]) {
    return DIRECT_DICTIONARY[lower];
  }

  // Phonetic multi-character rules
  let str = lower;

  // Words or prefixes matching common Tanglish patterns
  str = str.replace(/murali/g, 'முரளி');
  str = str.replace(/kumar/g, 'குமார்');
  str = str.replace(/chennai/g, 'சென்னை');
  str = str.replace(/kovai/g, 'கோவை');
  str = str.replace(/coimbatore/g, 'கோயம்புத்தூர்');
  str = str.replace(/madurai/g, 'மதுரை');

  if (isTamilText(str)) return str;

  // Consonant + Vowel rules
  const vowelsMap = [
    { en: 'aa', ta: 'ஆ', sign: 'ா' },
    { en: 'ai', ta: 'ஐ', sign: 'ை' },
    { en: 'au', ta: 'ஔ', sign: 'ௌ' },
    { en: 'ee', ta: 'ஏ', sign: 'ே' },
    { en: 'oo', ta: 'ஓ', sign: 'ோ' },
    { en: 'uu', ta: 'ஊ', sign: 'ூ' },
    { en: 'ii', ta: 'ஈ', sign: 'ீ' },
    { en: 'a', ta: 'அ', sign: '' },
    { en: 'i', ta: 'இ', sign: 'ி' },
    { en: 'u', ta: 'உ', sign: 'ு' },
    { en: 'e', ta: 'எ', sign: 'ெ' },
    { en: 'o', ta: 'ஒ', sign: 'ொ' }
  ];

  const consonantsMap = [
    { en: 'nth', ta: 'ந்' },
    { en: 'nh', ta: 'ந்' },
    { en: 'th', ta: 'த்' },
    { en: 'dh', ta: 'த்' },
    { en: 'ch', ta: 'ச்' },
    { en: 'sh', ta: 'ஷ்' },
    { en: 'zh', ta: 'ழ்' },
    { en: 'ng', ta: 'ங்' },
    { en: 'nj', ta: 'ஞ்' },
    { en: 'ny', ta: 'ஞ்' },
    { en: 'k', ta: 'க்' },
    { en: 'g', ta: 'க்' },
    { en: 's', ta: 'ச்' },
    { en: 't', ta: 'ட்' },
    { en: 'd', ta: 'ட்' },
    { en: 'p', ta: 'ப்' },
    { en: 'b', ta: 'ப்' },
    { en: 'm', ta: 'ம்' },
    { en: 'y', ta: 'ய்' },
    { en: 'r', ta: 'ர்' },
    { en: 'l', ta: 'ல்' },
    { en: 'v', ta: 'வ்' },
    { en: 'w', ta: 'வ்' },
    { en: 'z', ta: 'ழ்' },
    { en: 'n', ta: 'ன்' },
    { en: 'j', ta: 'ஜ்' },
    { en: 'h', ta: 'ஹ்' }
  ];

  // Base consonant lookup (without pulli dot)
  const baseConsonant = {
    'க்': 'க', 'ங்': 'ங', 'ச்': 'ச', 'ஞ்': 'ஞ', 'ட்': 'ட', 'ண்': 'ண',
    'த்': 'த', 'ந்': 'ந', 'ப்': 'ப', 'ம்': 'ம', 'ய்': 'ய', 'ர்': 'ர',
    'ல்': 'ல', 'வ்': 'வ', 'ழ்': 'ழ', 'ள்': 'ள', 'ற்': 'ற', 'ன்': 'ன',
    'ஜ்': 'ஜ', 'ஷ்': 'ஷ', 'ஸ்': 'ஸ', 'ஹ்': 'ஹ'
  };

  let result = '';
  let i = 0;

  while (i < str.length) {
    let matchedConsonant = null;
    let matchedLen = 0;

    for (const c of consonantsMap) {
      if (str.startsWith(c.en, i)) {
        matchedConsonant = c;
        matchedLen = c.en.length;
        break;
      }
    }

    if (matchedConsonant) {
      i += matchedLen;
      let matchedVowel = null;
      let vowelLen = 0;

      for (const v of vowelsMap) {
        if (str.startsWith(v.en, i)) {
          matchedVowel = v;
          vowelLen = v.en.length;
          break;
        }
      }

      if (matchedVowel) {
        i += vowelLen;
        const base = baseConsonant[matchedConsonant.ta] || matchedConsonant.ta;
        result += base + matchedVowel.sign;
      } else {
        result += matchedConsonant.ta;
      }
    } else {
      let matchedVowel = null;
      let vowelLen = 0;

      for (const v of vowelsMap) {
        if (str.startsWith(v.en, i)) {
          matchedVowel = v;
          vowelLen = v.en.length;
          break;
        }
      }

      if (matchedVowel) {
        i += vowelLen;
        result += matchedVowel.ta;
      } else {
        result += str[i];
        i++;
      }
    }
  }

  return result;
}

// Tamil Alphabet Character Headers (அ - ன)
export const TAMIL_ALPHABET_HEADERS = [
  'ALL',
  'அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ',
  'க', 'ங', 'ச', 'ஞ', 'ட', 'ண', 'த', 'ந', 'ப', 'ம', 'ய', 'ர', 'ல', 'வ', 'ழ', 'ள', 'ற', 'ன'
];

export function compareTamilStrings(a, b) {
  return taCollator.compare(a || '', b || '');
}

export function sortTamilRecords(records, key = 'name', reverse = false) {
  if (!records || !Array.isArray(records)) return [];
  const sorted = [...records].sort((x, y) => {
    const valA = x[key] || '';
    const valB = y[key] || '';
    return compareTamilStrings(valA, valB);
  });
  return reverse ? sorted.reverse() : sorted;
}
