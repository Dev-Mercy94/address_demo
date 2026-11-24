// Demo Seeder for AddressHub Demo Application
import { INITIAL_SAMPLE_ADDRESSES } from '../netlify/functions/sample_data.js';

console.log('--- AddressHub Demo Seeder ---');
console.log(`Pre-loaded ${INITIAL_SAMPLE_ADDRESSES.length} demo address records across multiple Tamil Nadu districts.`);
console.log('Sample addresses include: Tenkasi, Tirunelveli, Chennai, Coimbatore, Madurai, Tiruchirappalli, Salem, etc.');
console.log('Default Admin Login: username="admin", password="admin123"');
console.log('Demo database is self-contained and ready for deployment without MongoDB Atlas.');
