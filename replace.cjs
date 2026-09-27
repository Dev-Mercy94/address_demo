const fs = require('fs');
const path = require('path');

const srcDir = 'd:/my project/address/src';

const filesToUpdate = [
  'utils/pdfExportHelper.js',
  'styles/index.css',
  'pages/ImportPage.jsx',
  'pages/ExportPage.jsx',
  'pages/AddressesPage.jsx',
  'pages/AddAddressPage.jsx',
  'hooks/useAddresses.js',
  'components/FilterBar.jsx',
  'components/AddressTable.jsx',
  'components/AddressDetailsModal.jsx'
];

filesToUpdate.forEach(f => {
  const filePath = path.join(srcDir, f);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  content = content.replace(/'NORMAL'/g, "'CONTRIBUTOR'");
  content = content.replace(/"NORMAL"/g, '"CONTRIBUTOR"');
  content = content.replace(/>NORMAL</g, '>CONTRIBUTOR<');
  content = content.replace(/>📋 NORMAL/g, '>📋 CONTRIBUTOR');
  content = content.replace(/VIP → NORMAL/g, 'VIP → CONTRIBUTOR');
  content = content.replace(/NORMAL → VIP/g, 'CONTRIBUTOR → VIP');
  content = content.replace(/groupCounts\?\.NORMAL/g, 'groupCounts?.CONTRIBUTOR');
  content = content.replace(/NORMAL: 0/g, 'CONTRIBUTOR: 0');
  content = content.replace(/badge-group-normal/g, 'badge-group-contributor');
  content = content.replace(/row-group-normal/g, 'row-group-contributor');
  content = content.replace(/summary-card-normal/g, 'summary-card-contributor');
  content = content.replace(/NORMAL:/g, 'CONTRIBUTOR:');
  
  fs.writeFileSync(filePath, content, 'utf8');
});
console.log('Done');
