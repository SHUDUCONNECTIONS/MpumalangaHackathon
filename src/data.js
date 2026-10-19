// Channels every user gets. Team chat is added per user (see getChats).
const channels = [
  { id: 'general', name: 'General (All Hackers)', photo: 'p9', tab: 'all' },
  { id: 'mentors', name: 'Mentors', photo: 'p3', tab: 'mentors' },
  { id: 'judges', name: 'Judges', photo: 'p4', tab: 'mentors' },
];

export function getChats(user) {
  const teamChat = user?.team
    ? [{ id: `team:${user.team}`, name: user.team, photo: 'p8', tab: 'team' }]
    : [];
  return [...channels.slice(0, 1), ...teamChat, ...channels.slice(1)];
}

// Challenge briefs from the event design.
export const challenges = [
  { id: 1, title: 'Smart Tourism Discovery', body: 'Build an AI-powered platform that recommends attractions, activities and itineraries based on visitor interests, budgets and location.', img: '/images/c1.jpg' },
  { id: 2, title: 'Township & Community Tourism', body: 'Help visitors discover local guides, cultural experiences, artisans and small tourism businesses.', img: '/images/c2.jpg' },
  { id: 3, title: 'Accessible Tourism for Everyone', body: 'Create accessible tourism information and trip-planning tools for Deaf visitors, people with visual impairments and people with mobility disabilities.', img: '/images/c3.jpg' },
  { id: 4, title: 'Tourist Safety & Smart Travel', body: 'Develop a tool for verified safety information, emergency contacts, route information and alerts.', img: '/images/c4.jpg' },
];

// NOTE: sample content - replace times, venues and links with the real event details.
export const programme = {
  'Oct 16': [
    ['08:00', 'Registration & breakfast', 'Main foyer'],
    ['09:00', 'Opening ceremony & challenge briefing', 'Main hall'],
    ['10:00', 'Team formation & hacking begins', 'Hack floor'],
    ['13:00', 'Lunch', 'Dining area'],
    ['15:00', 'Mentor round 1', 'Hack floor'],
    ['18:00', 'Dinner', 'Dining area'],
  ],
  'Oct 17': [
    ['08:00', 'Breakfast', 'Dining area'],
    ['10:00', 'Mentor round 2', 'Hack floor'],
    ['13:00', 'Lunch', 'Dining area'],
    ['16:00', 'Pitch coaching', 'Main hall'],
    ['18:00', 'Dinner', 'Dining area'],
  ],
  'Oct 18': [
    ['08:00', 'Breakfast', 'Dining area'],
    ['10:00', 'Code freeze & final submissions', 'Hack floor'],
    ['11:00', 'Judging & pitches', 'Main hall'],
    ['15:00', 'Awards & closing ceremony', 'Main hall'],
  ],
}; // [time, title, location]
export const days = [
  ['Oct 16', 'Thu'],
  ['Oct 17', 'Fri'],
  ['Oct 18', 'Sat'],
];
export const faqs = [
  ['Who can take part?', 'Any registered hacker. Teams are formed on the first morning if you do not have one yet.'],
  ['How do I submit my project?', 'Go to Home > Submit Project, fill in the details and add your demo and repository links. You can resubmit until code freeze.'],
  ['When is code freeze?', 'The organisers control the countdown on the Home screen. It applies to all teams.'],
  ['How do I get help?', 'Open Team Chat > Mentors to message the mentors, or ask an organiser on the hack floor.'],
  ['How will projects be judged?', 'Judges score impact, innovation, technical quality and the pitch against your chosen challenge.'],
]; // [question, answer]
export const resources = [
  { title: 'Mpumalanga Tourism Authority', sub: 'Official tourism information', url: 'https://www.mpumalanga.com' },
  { title: 'SANParks', sub: 'Kruger National Park info', url: 'https://www.sanparks.org' },
  { title: 'OpenStreetMap', sub: 'Free map data for routes and places', url: 'https://www.openstreetmap.org' },
  { title: 'Web Content Accessibility Guidelines', sub: 'Design guide for challenge 3', url: 'https://www.w3.org/WAI/standards-guidelines/wcag/' },
]; // { title, sub, url }
