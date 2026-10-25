export interface Link {
  id: string;
  name: string;
  handle: string;
  url: string;
  /** Image the particles gather into. Replace the files in public/images. */
  image: string;
}

// Replace the handles and URLs with your own.
export const NAME = 'Youssef';

export const LINKS: Link[] = [
  { id: 'discord', name: 'Discord', handle: '#ysf8220', url: 'https://discord.com/users/1093249207793627207', image: 'images/discord.svg' },
  { id: 'facebook', name: 'Facebook', handle: 'Med Youssef', url: 'https://www.facebook.com/med.youssef.768955', image: 'images/facebook.svg' },
  { id: 'instagram', name: 'Instagram', handle: '@__yusoo__', url: 'https://www.instagram.com/___yusoo___/', image: 'images/instagram.svg' },
  { id: 'linkedin', name: 'LinkedIn', handle: 'Med youssef Boudhir', url: 'https://www.linkedin.com/in/med-youssef-boudhir-322459353', image: 'images/linkedin.svg' },
];
