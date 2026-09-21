import { getDb, serializeDoc, escapeRegex, jsonResponse, handleCorsPreflight } from './db.js';

function normalizeName(str) {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/\s*\.\s*/g, '.') // collapse whitespace around initials: "S. Ram" -> "s.ram"
    .replace(/\s+/g, ' ');     // collapse multiple spaces into one
}

function areNamesCompatible(nameA, nameB) {
  const a = normalizeName(nameA);
  const b = normalizeName(nameB);
  if (!a || !b) return true;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const wordsA = a.split(/[\s\.]+/).filter(w => w.length > 2);
  const wordsB = b.split(/[\s\.]+/).filter(w => w.length > 2);
  return wordsA.some(w => b.includes(w)) || wordsB.some(w => a.includes(w));
}

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') return handleCorsPreflight();
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    let payload = {};
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON request body' });
    }

    const { db } = await getDb();
    const collection = db.collection('addresses');

    // BATCH MODE SUPPORT
    if (payload.items && Array.isArray(payload.items)) {
      const duplicates = [];
      const batchSize = 100;
      const items = payload.items;

      for (let i = 0; i < items.length; i += batchSize) {
        const chunk = items.slice(i, i + batchSize);
        const chunkConditions = [];

        for (const item of chunk) {
          const uId = (item.u_id || '').trim();
          const name = (item.name || '').trim();
          const phone = (item.phone || '').trim();
          const pincode = (item.pincode || '').trim();
          const addressLine1 = (item.address_line_1 || '').trim();
          const district = (item.district || '').trim();

          if (!name && !phone && !uId) continue;

          const conds = [];
          if (uId) {
            conds.push({ u_id: { $regex: new RegExp(`^${escapeRegex(uId)}$`, 'i') } });
          }
          if (phone && phone.length >= 10) {
            conds.push({ phone });
          }
          if (name) {
            conds.push({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } });
            if (name.includes('.')) {
              const dotFlexible = escapeRegex(name).replace(/\\\.\s*/g, '\\.\\s*');
              conds.push({ name: { $regex: new RegExp(`^${dotFlexible}$`, 'i') } });
            }
          }
          if (name && uId) {
            conds.push({ 
              name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
              u_id: { $regex: new RegExp(`^${escapeRegex(uId)}$`, 'i') } 
            });
          }
          if (name && phone) {
            conds.push({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }, phone });
          }
          if (name && pincode) {
            conds.push({
              name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
              pincode
            });
          }
          if (name && addressLine1) {
            conds.push({
              name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
              address_line_1: { $regex: new RegExp(escapeRegex(addressLine1), 'i') }
            });
          }
          if (name && district) {
            conds.push({
              name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
              district: { $regex: new RegExp(`^${escapeRegex(district)}$`, 'i') }
            });
          }

          if (conds.length > 0) {
            chunkConditions.push({ $or: conds });
          }
        }

        if (chunkConditions.length > 0) {
          const matches = await collection.find({ $or: chunkConditions }).toArray();
          if (matches.length > 0) {
            for (const item of chunk) {
              const uId = (item.u_id || '').trim().toLowerCase();
              const name = (item.name || '').trim();
              const normName = normalizeName(name);
              const phone = (item.phone || '').trim();
              const pincode = (item.pincode || '').trim();
              const addr = (item.address_line_1 || '').trim().toLowerCase();
              const itemDistrict = (item.district || '').trim().toLowerCase();

              let matchReason = '';
              const matchedExisting = matches.find(match => {
                const matchName = (match.name || '').trim();
                const normMatchName = normalizeName(matchName);
                const matchPhone = (match.phone || '').trim();
                const matchUid = (match.u_id || '').trim().toLowerCase();
                const matchPin = (match.pincode || '').trim();
                const matchAddr = (match.address_line_1 || '').trim().toLowerCase();
                const matchDistrict = (match.district || '').trim().toLowerCase();

                // If two records have different districts, do NOT consider as duplicate!
                if (itemDistrict && matchDistrict && itemDistrict !== matchDistrict) {
                  return false;
                }

                // 1. Same 10-digit Phone Number is always a confirmed duplicate
                if (phone && matchPhone && phone.length >= 10 && phone === matchPhone) {
                  matchReason = `Same Phone Number: ${phone}`;
                  return true;
                }

                // 2. Name-based duplicate checks
                const isExactNameMatch = normName && normMatchName && normName === normMatchName;
                if (isExactNameMatch) {
                  if (uId && matchUid && uId === matchUid) {
                    matchReason = `Same Name & Unique ID: ${match.u_id || item.u_id}`;
                    return true;
                  }
                  if (phone && matchPhone && phone === matchPhone) {
                    matchReason = `Same Name & Phone: ${phone}`;
                    return true;
                  }
                  if (pincode && matchPin && pincode === matchPin) {
                    matchReason = `Same Name & Pincode: ${pincode}`;
                    return true;
                  }
                  if (addr && matchAddr && (addr === matchAddr || addr.includes(matchAddr) || matchAddr.includes(addr))) {
                    matchReason = `Same Name & Address Line`;
                    return true;
                  }
                  // Same name in the same district
                  if (itemDistrict && matchDistrict && itemDistrict === matchDistrict) {
                    matchReason = `Same Contact Name in ${item.district}`;
                    return true;
                  }
                  // Same name with no conflicting details
                  if (!phone && !matchPhone) {
                    matchReason = `Same Contact Name: ${match.name}`;
                    return true;
                  }
                }

                // 3. Same U.ID with compatible name (initials / partial overlap)
                if (uId && matchUid && uId === matchUid) {
                  if (areNamesCompatible(name, matchName)) {
                    matchReason = `Same Unique ID: ${match.u_id || item.u_id}`;
                    return true;
                  }
                }

                return false;
              });

              if (matchedExisting) {
                duplicates.push({
                  importedItem: item,
                  existingAddress: serializeDoc(matchedExisting),
                  matchReason: matchReason || 'Duplicate record in database'
                });
              }
            }
          }
        }
      }

      return jsonResponse(200, { duplicates });
    }

    // SINGLE ITEM MODE (Legacy)
    const uId = (payload.u_id || '').trim();
    const name = (payload.name || '').trim();
    const phone = (payload.phone || '').trim();
    const pincode = (payload.pincode || '').trim();
    const addressLine1 = (payload.address_line_1 || '').trim();
    const district = (payload.district || '').trim();

    if (!name && !phone && !uId) {
      return jsonResponse(200, { duplicateFound: false });
    }

    const queryConditions = [];

    if (uId) {
      queryConditions.push({ u_id: { $regex: new RegExp(`^${escapeRegex(uId)}$`, 'i') } });
    }

    if (phone && phone.length >= 10) {
      queryConditions.push({ phone });
    }

    if (name) {
      queryConditions.push({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } });
      if (name.includes('.')) {
        const dotFlexible = escapeRegex(name).replace(/\\\.\s*/g, '\\.\\s*');
        queryConditions.push({ name: { $regex: new RegExp(`^${dotFlexible}$`, 'i') } });
      }
    }

    if (name && uId) {
      queryConditions.push({
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        u_id: { $regex: new RegExp(`^${escapeRegex(uId)}$`, 'i') }
      });
    }

    if (name && phone) {
      queryConditions.push({
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        phone
      });
    }

    if (name && pincode) {
      queryConditions.push({
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        pincode
      });
    }

    if (queryConditions.length > 0) {
      const match = await collection.findOne({ $or: queryConditions });
      if (match) {
        const itemDistrict = district.toLowerCase();
        const matchDistrict = (match.district || '').trim().toLowerCase();

        // If two same names in different districts, don't mention for duplicate
        if (itemDistrict && matchDistrict && itemDistrict !== matchDistrict) {
          return jsonResponse(200, { duplicateFound: false });
        }

        const matchPhone = (match.phone || '').trim();
        const matchUid = (match.u_id || '').trim().toLowerCase();
        const matchName = (match.name || '').trim();

        const isPhoneDup = Boolean(phone && matchPhone && phone.length >= 10 && phone === matchPhone);
        const isNameDup = Boolean(name && matchName && normalizeName(name) === normalizeName(matchName));
        const isUidDup = Boolean(uId && matchUid && uId.toLowerCase() === matchUid && areNamesCompatible(name, matchName));

        if (!isPhoneDup && !isNameDup && !isUidDup) {
          return jsonResponse(200, { duplicateFound: false });
        }

        return jsonResponse(200, {
          duplicateFound: true,
          existingAddress: serializeDoc(match)
        });
      }
    }

    return jsonResponse(200, { duplicateFound: false });
  } catch (err) {
    console.error('Error in check_duplicate handler:', err);
    return jsonResponse(500, { error: err.message || 'Internal Server Error' });
  }
}
