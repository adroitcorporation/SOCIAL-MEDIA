import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
export async function seed() {
  if (process.env.NODE_ENV === 'production' || process.env.LOCAL_DEMO !== 'true')
    throw new Error('Sample data can only be seeded with LOCAL_DEMO=true outside production.');
  const people = [
    {
      id: 'demo-aarav',
      name: 'Aarav Mehta',
      college: 'IIT Bombay',
      degree: 'B.Tech · Computer Science',
      city: 'Mumbai',
      skills: ['React', 'TypeScript', 'Product'],
      interests: ['Technology', 'Design', 'Social impact'],
      domains: ['Technology'],
      lookingFor: ['Project partners', 'Hackathon teammates'],
      bio: 'Building thoughtful things for everyday problems. Currently exploring how technology can make campus life a little better.',
    },
    {
      id: 'demo-ananya',
      name: 'Ananya Sharma',
      college: 'IIT Delhi',
      degree: 'B.Tech · Computer Science',
      city: 'Delhi',
      skills: ['React', 'Python', 'Machine Learning'],
      interests: ['Technology', 'Social impact'],
      domains: ['Technology'],
      lookingFor: ['Hackathon teammates'],
      bio: 'Turning coffee into code. Looking for curious people to build something with a little impact.',
    },
    {
      id: 'demo-rohan',
      name: 'Rohan Iyer',
      college: 'BITS Pilani',
      degree: 'B.E. · Electronics',
      city: 'Pilani',
      skills: ['UI/UX', 'Figma', 'Webflow'],
      interests: ['Design', 'Music'],
      domains: ['Design'],
      lookingFor: ['Creative collaborations'],
      bio: 'An engineer with a designer’s heart. Making digital things feel a little more human.',
    },
    {
      id: 'demo-meera',
      name: 'Meera Patel',
      college: 'NID Ahmedabad',
      degree: 'B.Des · Interaction Design',
      city: 'Ahmedabad',
      skills: ['Design thinking', 'Illustration', 'Figma'],
      interests: ['Design', 'Social impact'],
      domains: ['Design'],
      lookingFor: ['Project partners'],
      bio: 'I ask a lot of “what if” questions. Exploring the space between good design and social change.',
    },
    {
      id: 'demo-kabir',
      name: 'Kabir Sethi',
      college: 'VIT Vellore',
      degree: 'B.Tech · Information Technology',
      city: 'Vellore',
      skills: ['Node.js', 'React', 'PostgreSQL'],
      interests: ['Technology', 'Gaming'],
      domains: ['Technology'],
      lookingFor: ['Hackathon teammates'],
      bio: 'Backend builder, weekend game developer. Let’s make something people actually want to use.',
    },
    {
      id: 'demo-isha',
      name: 'Isha Rao',
      college: 'Christ University',
      degree: 'B.A. · Media Studies',
      city: 'Bengaluru',
      skills: ['Storytelling', 'Video editing', 'Marketing'],
      interests: ['Creative', 'Design'],
      domains: ['Creative'],
      lookingFor: ['Creative collaborations'],
      bio: 'Collecting stories and turning them into films. Looking for people who see the world a little differently.',
    },
    {
      id: 'demo-dev',
      name: 'Dev Kapoor',
      college: 'IIT Bombay',
      degree: 'B.Tech · Mechanical',
      city: 'Mumbai',
      skills: ['CAD', 'Robotics', 'Python'],
      interests: ['Technology', 'Sustainability'],
      domains: ['Engineering'],
      lookingFor: ['Competition teams'],
      bio: 'Making things that move. Currently tinkering with low-cost robotics for education.',
    },
    {
      id: 'demo-tara',
      name: 'Tara Nair',
      college: 'Manipal Institute of Technology',
      degree: 'B.Tech · Computer Science',
      city: 'Manipal',
      skills: ['Flutter', 'Firebase', 'UI/UX'],
      interests: ['Technology', 'Design'],
      domains: ['Technology'],
      lookingFor: ['Project partners'],
      bio: 'App developer and compulsive note-taker. I want to build tools that make student life simpler.',
    },
    {
      id: 'demo-zoya',
      name: 'Zoya Khan',
      college: 'Miranda House',
      degree: 'B.A. · Economics',
      city: 'Delhi',
      skills: ['Research', 'Public speaking', 'Data analysis'],
      interests: ['Social impact', 'Research'],
      domains: ['Research'],
      lookingFor: ['Research partners'],
      bio: 'Curious about people, cities, and better systems. Always up for a conversation that changes my mind.',
    },
  ];
  for (const [i, p] of people.entries())
    await db.user.upsert({
      where: { id: p.id },
      update: {},
      create: {
        ...p,
        graduationYear: 2027 + (i % 3),
        onboarded: true,
        emailVerified: true,
        createdAt: new Date(Date.now() - (i + 1) * 86400000),
      },
    });
  for (const [id, target, status, incoming] of [
    ['seed-c1', 'demo-kabir', 'ACCEPTED', false],
    ['seed-c2', 'demo-isha', 'ACCEPTED', true],
    ['seed-c3', 'demo-dev', 'ACCEPTED', false],
    ['seed-c4', 'demo-tara', 'PENDING', true],
  ] as const) {
    await db.connection.upsert({
      where: { id },
      update: {},
      create: {
        id,
        pairKey: ['demo-aarav', target].sort().join(':'),
        requesterId: incoming ? target : 'demo-aarav',
        receiverId: incoming ? 'demo-aarav' : target,
        status,
      },
    });
  }
  const ideas = [
    {
      id: 'seed-idea-1',
      authorId: 'demo-ananya',
      title: 'What if finding a study buddy was actually easy?',
      description:
        'A campus-first platform that matches students by what they’re learning, not just their course. Think focused study rooms, shared goals, and a little accountability. I have a rough prototype and would love a designer and another developer to explore this with me.',
      category: 'Technology',
      skills: ['React', 'UI/UX', 'Python'],
      tags: ['edtech', 'campus'],
    },
    {
      id: 'seed-idea-2',
      authorId: 'demo-meera',
      title: 'Small acts. A more sustainable campus.',
      description:
        'Let’s make sustainable choices feel natural. I’m thinking of a simple campus exchange for books, supplies, and all the things we leave behind at the end of term. Looking for curious designers, developers, and people who care about the little things.',
      category: 'Social impact',
      skills: ['Design thinking', 'Web development'],
      tags: ['sustainability', 'community'],
    },
    {
      id: 'seed-idea-3',
      authorId: 'demo-aarav',
      title: 'A little map of everything happening on campus',
      description:
        'Clubs, pop-up performances, evening games, impromptu workshops — the best things on campus often happen by word of mouth. Let’s build a living map that brings them together. Looking for a designer and a frontend collaborator to build a weekend prototype.',
      category: 'Creative',
      skills: ['React', 'Figma', 'Community'],
      tags: ['campus', 'events'],
    },
  ];
  for (const i of ideas) await db.idea.upsert({ where: { id: i.id }, update: {}, create: i });
  for (const userId of ['demo-rohan', 'demo-meera'])
    await db.ideaResonance.upsert({
      where: { ideaId_userId: { ideaId: 'seed-idea-3', userId } },
      update: {},
      create: { ideaId: 'seed-idea-3', userId },
    });
  for (const userId of ['demo-kabir', 'demo-isha', 'demo-dev'])
    await db.ideaResonance.upsert({
      where: { ideaId_userId: { ideaId: 'seed-idea-1', userId } },
      update: {},
      create: { ideaId: 'seed-idea-1', userId },
    });
  const events = [
    {
      id: 'seed-event-1',
      title: 'Build something at Hack Horizon',
      category: 'Hackathon',
      organizer: 'Student Developers Collective',
      location: 'Bengaluru · In person',
      description:
        'Sample event: 36 hours of building, learning, and a few very good ideas. Bring your curiosity and find a team. This event is fictional and is included only to demonstrate the local app.',
      offset: 7,
    },
    {
      id: 'seed-event-2',
      title: 'The Design Playground',
      category: 'Design',
      organizer: 'Campus Creatives',
      location: 'Online · Across India',
      description:
        'Sample event: an afternoon of creative challenges and thoughtful feedback. Explore visual storytelling alongside students from across India. This is a fictional demonstration event.',
      offset: 12,
    },
    {
      id: 'seed-event-3',
      title: 'Ideas to Impact',
      category: 'Workshop',
      organizer: 'Student Innovation Club',
      location: 'Mumbai · In person',
      description:
        'Sample event: turn a half-formed idea into a testable prototype. Meet collaborators, ask better questions, and build something small. This is a fictional demonstration event.',
      offset: 18,
    },
  ];
  for (const { offset, ...e } of events)
    await db.event.upsert({
      where: { id: e.id },
      update: {},
      create: { ...e, startsAt: new Date(Date.now() + offset * 86400000), url: '' },
    });
  await db.notification.upsert({
    where: { id: 'seed-welcome' },
    update: {},
    create: {
      id: 'seed-welcome',
      userId: 'demo-aarav',
      title: 'Your circle starts here',
      body: 'Find your people, share what’s on your mind, and make something together.',
      href: '/discover',
    },
  });
  console.log('Local sample data is ready. No existing records were overwritten.');
}
seed().finally(() => db.$disconnect());
