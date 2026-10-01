export const AREA_MAPPING = {
  // Add your area mappings here. 
  // Keys should be lowercase for easier matching.
  // Format: "area name": { district: "DistrictName", pincode: "123456" }
  "anna nagar": { district: "Chennai", pincode: "600040" },
  "t nagar": { district: "Chennai", pincode: "600017" },
  "surandai": { district: "Tenkasi", pincode: "627859" },
  "kadayanallur": { district: "Tenkasi", pincode: "627751" },
  "sankarankovil": { district: "Tenkasi", pincode: "627756" },
  "puliyangudi": { district: "Tenkasi", pincode: "627855" },
  "kovilpatti": { district: "Thoothukudi", pincode: "628501" },
  "tirunelveli town": { district: "Tirunelveli", pincode: "627006" },
  "palayamkottai": { district: "Tirunelveli", pincode: "627002" },
  "melapalayam": { district: "Tirunelveli", pincode: "627005" }
};

/**
 * Looks up the district and pincode based on area name.
 * @param {string} areaName - The name of the area
 * @returns {{district: string, pincode: string} | null} - The mapped district and pincode or null if not found
 */
export function getAreaDetails(areaName) {
  if (!areaName) return null;
  const normalizedArea = areaName.trim().toLowerCase();
  
  // Exact match
  if (AREA_MAPPING[normalizedArea]) {
    return AREA_MAPPING[normalizedArea];
  }

  // Partial match fallback
  for (const [key, value] of Object.entries(AREA_MAPPING)) {
    if (normalizedArea.includes(key) || key.includes(normalizedArea)) {
      return value;
    }
  }

  return null;
}
