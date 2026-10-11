export interface LocalSponsor {
  id: string;
  district: string; // e.g. 'Balasore', 'Angul', 'Khordha', 'All'
  businessName: string;
  tagline: string;
  description: string;
  badgeText: string;
  contactPhone: string;
  whatsappNumber: string;
  actionText: string;
}

export const LOCAL_SPONSORS: Record<string, LocalSponsor[]> = {
  Balasore: [
    {
      id: 'balasore-tiffin-1',
      district: 'Balasore',
      businessName: 'Maa Tarini Student Tiffin & Mess Service',
      tagline: 'Special Monthly Meals & Delivery near FM College & Nalamganj',
      description: 'Hygienic home-cooked veg & non-veg thali delivered directly to your room or hostel at student-friendly prices.',
      badgeText: 'Food & Tiffin • Balasore',
      contactPhone: '9437159484',
      whatsappNumber: '9437159484',
      actionText: 'Order / Contact'
    },
    {
      id: 'balasore-movers-1',
      district: 'Balasore',
      businessName: 'Balasore Express Packers & Room Shifting',
      tagline: 'Safe & Affordable Room Shifting & Furniture Transport',
      description: 'Easy shifting for students and families across Balasore town, Sahadevkhunta, Angargadia & Remuna.',
      badgeText: 'Movers & Transport • Balasore',
      contactPhone: '9437159484',
      whatsappNumber: '9437159484',
      actionText: 'Get Quote'
    }
  ],
  Angul: [
    {
      id: 'angul-tiffin-1',
      district: 'Angul',
      businessName: 'Angul Royal Meals & Tiffin Service',
      tagline: 'Home-Style Meals for Students & Working Professionals in Angul Town',
      description: 'Fresh lunch & dinner delivery across Angul town and Nalco Nagar at affordable monthly rates.',
      badgeText: 'Tiffin Service • Angul',
      contactPhone: '9437159484',
      whatsappNumber: '9437159484',
      actionText: 'Order Food'
    }
  ]
};
