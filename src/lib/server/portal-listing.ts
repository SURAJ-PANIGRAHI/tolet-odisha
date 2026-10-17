import {
  CATEGORIES,
  COMMERCIAL_TYPES,
  ODISHA_DISTRICTS,
  POPULAR_AMENITIES,
  FURNISHING_OPTIONS,
} from "@/data/odisha";
import { indianPhone } from "./evolution";
export function validatePortalListing(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid listing.");
  const row = {...value} as Record<string, unknown>;
  if (row.price_on_request !== undefined && typeof row.price_on_request !== 'boolean') throw new Error('Check the price on request option.');
  if (row.rent_monthly == null || row.rent_monthly === '') row.price_on_request=true;
  if (row.price_on_request === true) {row.rent_monthly=0;row.rent_negotiable=false;}
  for (const key of ["title", "district", "locality", "contact_name"])
    if (
      typeof row[key] !== "string" ||
      !String(row[key]).trim() ||
      String(row[key]).length > 200
    )
      throw new Error("Complete the required listing fields.");
  if (row.category !== "Commercial / Shop") row.area_sqft=null;
  if (Array.isArray(row.amenities)) row.amenities=[...new Set(row.amenities.map(value=>value==='Mess Food Available'?'Hygienic Food':value==='Drinking Water (RO)'?'Drinking Water (RO/Aquaguard)':value))];
  const phone =
    typeof row.contact_phone === "string"
      ? indianPhone(row.contact_phone)
      : null;
  const whatsapp = row.whatsapp_number == null ? phone : typeof row.whatsapp_number === "string" ? indianPhone(row.whatsapp_number) : null;
  if (row.rent_negotiable !== undefined && typeof row.rent_negotiable !== "boolean") throw new Error("Check the negotiable rent option.");
  if (
    !phone || !whatsapp ||
    !CATEGORIES.some((c) => c.id !== "All" && c.id === row.category) ||
    !ODISHA_DISTRICTS.some((d) => d.split(" ")[0] === row.district) ||
    !["Owner", "Broker", "Third Party"].includes(String(row.advertiser_type))
  )
    throw new Error(
      "Enter valid call and WhatsApp numbers and check your category, district and advertiser type.",
    );
  if (
    !Number.isInteger(row.rent_monthly) ||
    Number(row.rent_monthly) < 0 ||
    Number(row.rent_monthly) > 10000000 ||
    !Number.isInteger(row.deposit) ||
    Number(row.deposit) < 0 ||
    Number(row.deposit) > 10000000
  )
    throw new Error("Enter valid whole rupee amounts.");
  if (
    row.area_sqft != null &&
    (!Number.isInteger(row.area_sqft) ||
      Number(row.area_sqft) <= 0 ||
      Number(row.area_sqft) > 10000000)
  )
    throw new Error("Check the optional floor area.");
  if (
    row.category === "Commercial / Shop"
      ? !COMMERCIAL_TYPES.includes(
          row.commercial_type as (typeof COMMERCIAL_TYPES)[number],
        )
      : row.commercial_type != null
  )
    throw new Error("Check the commercial property type.");
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/listings/`;
  if (
    !Array.isArray(row.images) ||
    row.images.length > 10 ||
    row.images.some(
      (url) =>
        typeof url !== "string" || !url.startsWith(prefix) || url.length > 1000,
    ) ||
    !Array.isArray(row.amenities) ||
    row.amenities.some((a) => !POPULAR_AMENITIES.includes(a)) ||
    row.amenities.length > POPULAR_AMENITIES.length ||
    row.amenities.filter(a => FURNISHING_OPTIONS.includes(a)).length > 1 ||
    String(row.description || "").length > 5000 ||
    String(row.landmark || "").length > 200
  )
    throw new Error("Check your photos, description and amenities.");
  // Whitelist editable fields. Never accept ownership, badges, moderation or expiry.
  return Object.fromEntries(
    [
      "title",
      "description",
      "category",
      "commercial_type",
      "advertiser_type",
      "area_sqft",
      "rent_monthly",
      "deposit",
      "district",
      "locality",
      "landmark",
      "contact_name",
      "amenities",
      "images",
    ]
      .map((key) => [key, row[key]])
      .concat([
        ["contact_phone", phone.slice(3)],
        ["whatsapp_number", whatsapp.slice(3)],
        ["rent_negotiable", row.rent_negotiable === true],
        ["price_on_request", row.price_on_request === true],
      ]),
  );
}
