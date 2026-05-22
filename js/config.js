/* ============================================================
   SPACE LAUNCH — configuration & static reference data
   Coverage: every U.S. launch — Florida's Space Coast is the
   featured home base; other spaceports get their own pages.
   ============================================================ */
window.SL = {
  cfg: {
    /* The Space Devs — Launch Library 2 (free, no key) */
    ll2:      'https://ll.thespacedevs.com/2.2.0',
    ll2Limit: 100,            /* upcoming launches fetched, then filtered to USA */

    /* Spaceflight News API v4 (free, no key) */
    news:     'https://api.spaceflightnewsapi.net/v4/articles',

    /* WhereTheISS.at — live orbital position (free, no key) */
    issApi:        'https://api.wheretheiss.at/v1/satellites',
    issNorad:      25544,     /* International Space Station */
    tiangongNorad: 48274,     /* Tianhe core module          */

    /* Open-Meteo — live weather (free, no key); coords = Cape Canaveral */
    weather:    'https://api.open-meteo.com/v1/forecast',
    weatherLat: 28.49,
    weatherLon: -80.57,

    /* Optional reminder backend (Netlify Function) */
    reminderFn: '/.netlify/functions/subscribe',

    /* localStorage cache lifetimes (minutes) */
    ttl: { launches: 30, news: 30, stations: 180, weather: 20 }
  },

  /* shared runtime state, filled by the modules */
  state: { launches: [], recent: [], all: [], news: [], weather: null, stationsLive: {} },

  /* ----------------------------------------------------------
     U.S. launch sites. `match` holds lowercase substrings tested
     against the launch pad's location name. The first site whose
     match hits wins; any U.S. launch that matches nothing falls
     through to `other`. `space-coast` is the featured site.
     ---------------------------------------------------------- */
  sites: [
    {
      key: 'space-coast', featured: true, icon: '🌴',
      name: 'The Space Coast', short: 'Space Coast',
      place: 'Cape Canaveral & Kennedy Space Center · Florida',
      region: 'Florida',
      match: ['cape canaveral', 'kennedy space'],
      blurb: 'The busiest spaceport on Earth. SpaceX, ULA, Blue Origin and NASA all fly ' +
             'from this stretch of Florida\'s Atlantic coast — often several times a week.',
      viewing: 'Titusville\'s Space View Park and Sand Point Park, Playalinda Beach in ' +
               'Canaveral National Seashore, Jetty Park in Cape Canaveral, and the Max ' +
               'Brewer Bridge. Most spots are about an hour\'s drive from Orlando.'
    },
    {
      key: 'vandenberg', icon: '🌅',
      name: 'Vandenberg Space Force Base', short: 'Vandenberg',
      place: 'Vandenberg SFB · California',
      region: 'California',
      match: ['vandenberg'],
      blurb: 'America\'s West Coast spaceport. Vandenberg\'s rockets head south over the ' +
             'Pacific into polar and sun-synchronous orbits used by weather, ' +
             'reconnaissance and Earth-observation satellites.',
      viewing: 'Hawk\'s Nest along Highway 1, Harris Grade Road, and the city of Lompoc ' +
               'give wide views. Surf Beach is the closest spot when it is open.'
    },
    {
      key: 'starbase', icon: '🤠',
      name: 'SpaceX Starbase', short: 'Starbase',
      place: 'Boca Chica · Texas',
      region: 'Texas',
      match: ['starbase', 'boca chica'],
      blurb: 'SpaceX\'s Starship home base at the southern tip of Texas, on the Gulf of ' +
             'Mexico — the test and launch site for the largest rocket ever built.',
      viewing: 'Isla Blanca Park on South Padre Island is the favorite public spot, with ' +
               'Boca Chica Beach and Highway 4 closer in when they are not closed for ops.'
    },
    {
      key: 'wallops', icon: '🦀',
      name: 'Wallops Flight Facility', short: 'Wallops',
      place: 'Mid-Atlantic Regional Spaceport · Virginia',
      region: 'Virginia',
      match: ['wallops', 'mid-atlantic'],
      blurb: 'NASA\'s spaceport on Virginia\'s Eastern Shore — home to cargo runs to the ' +
             'ISS aboard Antares and a growing roster of small-rocket launches.',
      viewing: 'The NASA Wallops Visitor Center hosts public viewing, and Assateague ' +
               'Island and Chincoteague offer open sightlines up the coast.'
    },
    {
      key: 'pacific-spaceport', icon: '❄️',
      name: 'Pacific Spaceport Complex', short: 'Pacific Spaceport',
      place: 'Kodiak Island · Alaska',
      region: 'Alaska',
      match: ['pacific spaceport', 'kodiak'],
      blurb: 'A remote complex on Kodiak Island, Alaska, built for small rockets flying ' +
             'straight into polar orbit over open ocean.',
      viewing: 'Narrow Cape and the Pasagshak State Recreation Site on Kodiak Island ' +
               'offer the closest public vantage points.'
    },
    {
      key: 'other', icon: '🛰️',
      name: 'Other U.S. Spaceports', short: 'Other U.S. Sites',
      place: 'Across the United States',
      region: 'United States',
      match: [],
      blurb: 'Newer and smaller U.S. launch sites — Spaceport America in New Mexico, ' +
             'Mojave in California, and emerging commercial spaceports — that host ' +
             'occasional launches and rocket tests.',
      viewing: null
    }
  ],

  /* ----------------------------------------------------------
     Curated space-station reference data (stable physical specs).
     Live status / crew / position are layered on from the APIs.
     ---------------------------------------------------------- */
  stations: [
    {
      key: 'iss', norad: 25544, ll2id: 4,
      name: 'International Space Station',
      tag: 'Low Earth Orbit · Crewed since 2000',
      operator: 'NASA · Roscosmos · ESA · JAXA · CSA',
      desc: 'The largest structure humans have ever placed in space — a football-field-sized laboratory orbiting roughly 250 miles above Earth, continuously crewed for over two decades.',
      stats: [
        { v: '7',        k: 'Crew capacity' },
        { v: '~408 km',  k: 'Avg altitude' },
        { v: '~93 min',  k: 'Orbital period' },
        { v: '16 / day', k: 'Orbits of Earth' }
      ],
      specs: [
        ['Mass',                '≈ 450,000 kg'],
        ['Length (truss)',      '109 m'],
        ['Solar array span',    '73 m'],
        ['Pressurized volume',  '916 m³'],
        ['Habitable volume',    '388 m³'],
        ['Pressurized modules', '16'],
        ['Orbital speed',       '27,600 km/h (7.66 km/s)'],
        ['Electrical power',    '8 solar arrays · ≈ 120 kW'],
        ['First module',        'Zarya — 20 Nov 1998'],
        ['Continuously crewed', 'Since 2 Nov 2000']
      ],
      facts: [
        'Travels at roughly 17,500 mph — fast enough to circle the entire planet every 93 minutes.',
        'Astronauts aboard see 16 sunrises and 16 sunsets every single day.',
        'It is the third-brightest object in the night sky and is visible from your backyard with the naked eye.',
        'It has been continuously occupied by humans for more than 25 years — the longest unbroken human presence in space.',
        'More than 280 people from over 20 countries have visited the station.'
      ]
    },
    {
      key: 'tiangong', norad: 48274, ll2id: 18,
      name: 'Tiangong Space Station',
      tag: 'Low Earth Orbit · Completed 2022',
      operator: 'China Manned Space Agency (CMSA)',
      desc: 'China’s modular space station — "Heavenly Palace" — assembled in orbit and now permanently crewed by rotating Shenzhou missions.',
      stats: [
        { v: '3',        k: 'Crew capacity' },
        { v: '~390 km',  k: 'Avg altitude' },
        { v: '~92 min',  k: 'Orbital period' },
        { v: '3',        k: 'Core modules' }
      ],
      specs: [
        ['Mass',               '≈ 100,000 kg (planned)'],
        ['Length',             '≈ 55 m'],
        ['Modules',            'Tianhe · Wentian · Mengtian'],
        ['Orbital speed',      '≈ 27,600 km/h'],
        ['Crew capacity',      '3 (up to 6 in handover)'],
        ['First module',       'Tianhe — 29 Apr 2021'],
        ['Assembly completed', 'Nov 2022'],
        ['Design lifetime',    'At least 10–15 years']
      ],
      facts: [
        'Tiangong means "Heavenly Palace" — China’s first permanent, long-term space station.',
        'It is roughly one-fifth the mass of the International Space Station.',
        'Assembled from three modules launched and docked over 19 months.',
        'Crews rotate aboard Shenzhou spacecraft, typically on six-month tours.',
        'It carries a robotic arm and external mounts for hundreds of science experiments.'
      ]
    }
  ]
};
