import { taxonomy } from '@/shared/recommendations/taxonomy';

export const degrees = ['B.Tech', 'B.E.', 'BCA', 'MCA', 'BBA', 'MBA', 'M.Tech', 'M.E.', 'PhD'];

export const graduationYears = Array.from({ length: 21 }, (_, index) => 2020 + index);
export const cities = [
  'Ahmedabad',
  'Bengaluru',
  'Bhopal',
  'Bhubaneswar',
  'Chandigarh',
  'Chennai',
  'Coimbatore',
  'Delhi',
  'Gurugram',
  'Guwahati',
  'Hyderabad',
  'Indore',
  'Jaipur',
  'Kochi',
  'Kolkata',
  'Lucknow',
  'Mumbai',
  'Nagpur',
  'Noida',
  'Patna',
  'Pune',
  'Surat',
  'Thiruvananthapuram',
  'Vadodara',
  'Visakhapatnam',
];
export const profileListOptions = {
  skills: taxonomy.skills.map(v=>v.label),
  interests: taxonomy.interests.map(v=>v.label),
  domains: [
    'Web Development',
    'App Development',
    'AI/ML',
    'Design',
    'FinTech',
    'EdTech',
    'HealthTech',
    'Social Impact',
    'E-commerce',
  ],
  lookingFor: taxonomy.lookingFor.map(v=>v.label),
};
