import { PrismaClient } from "@prisma/client";
import { DEFAULT_THEME } from "../src/lib/theme";

const prisma = new PrismaClient();

const SOCIALS = [
  { label: "X", href: "https://x.com/rajkoshik" },
  { label: "GitHub", href: "https://github.com/koshikraj" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/koshikraj/" },
];

// Reverse-chronological — ported verbatim from design/portfolio.jsx
const HIGHLIGHTS = [
  { id: "sage-2026", date: "Apr 2026", year: 2026, title: "Built Sage on Solana", tag: "work", body: "A personal AI co-signer for Solana wallets, built on Squads Protocol and submitted to the Colosseum Frontier hackathon. Live on Solana mainnet from day one — no testnet hand-wringing.", linkLabel: "heysage.me", linkHref: "https://heysage.me", photos: 2 },
  { id: "zhentan-2026", date: "Feb 2026", year: 2026, title: "Built Zhentan — BNB Hackathon winner", tag: "milestone", body: "Won top project at the BNB OpenClaw Hackathon out of 600 builders. The community spun up a $ZHENTAN token within hours; it hit a $250k market cap and crossed 150 users in week one. Felt good.", linkLabel: "zhentan.me", linkHref: "https://zhentan.me", photos: 4 },
  { id: "devconnect-2025", date: "Nov 2025", year: 2025, title: "Presented agentic payments at Devconnect Argentina", tag: "talk", body: "Nominated by the EF ERC-4337 team to present an agentic payments vision — x402 on smart accounts with delegated access. Buenos Aires in November is a kind of magic.", linkLabel: "see the post", linkHref: "https://x.com/brewitmoney/status/1991485944474517821", photos: 4 },
  { id: "brewit-2025", date: "Apr 2025", year: 2025, title: "Launched Brewit", tag: "work", body: "Led the team to build agentic crypto account infrastructure for individuals and teams, powered by Safe. Claude desktop integration, ~5k users, $1.5M in volume, $200k AUM. Still my favourite thing we've shipped.", linkLabel: null, linkHref: null, photos: 4 },
  { id: "ethindia-2024", date: "Nov 2024", year: 2024, title: "Finalist at ETHIndia 2024", tag: "side_quest", body: "Two sleepless nights in Bengaluru, one stubborn idea, a very good team. Made it to the final stage.", linkLabel: null, linkHref: null, photos: 2 },
  { id: "aahub-devcon-2024", date: "Nov 2024", year: 2024, title: "Smart account delegation at AA Hub Devcon", tag: "talk", body: "Demoed delegated access for automation on ERC-4337 smart accounts in front of Vitalik Buterin at AA Hub Devcon Bangkok. Tried not to think about who was in the room.", linkLabel: "see the post", linkHref: "https://x.com/brewitmoney/status/1988212787525607823", photos: 2 },
  { id: "obra-grant-2024", date: "Feb 2024", year: 2024, title: "Received the OBRA Grant from Safe", tag: "milestone", body: "A grant from Safe to build developer tools for the Module Marketplace on Safe smart accounts. The kind of support that changes a year.", linkLabel: null, linkHref: null, photos: 1 },
  { id: "ethindia-2023", date: "Nov 2023", year: 2023, title: "Finalist at ETHIndia 2023", tag: "side_quest", body: "Year one of many. The hallway was the best part.", linkLabel: null, linkHref: null, photos: 2 },
  { id: "zenguard-marketplace-2023", date: "Jun 2023", year: 2023, title: "ZenGuard — the Safe Module Marketplace", tag: "work", body: "Kept building ZenGuard as a module marketplace for Safe smart accounts. A second grant from Safe followed.", linkLabel: null, linkHref: null, photos: 1 },
  { id: "zenguard-2023", date: "Apr 2023", year: 2023, title: "Built ZenGuard — won the AA hackathon", tag: "milestone", body: "Built ZenGuard and won the Account Abstraction hackathon — a modular authorization layer and marketplace for Safe smart-account plugins. The thread that pulled the next two years.", linkLabel: null, linkHref: null, photos: 2 },
  { id: "safient-2021", date: "Mar 2021", year: 2021, title: "Built Safient", tag: "work", body: "Co-founded Consenso Labs and built Safient — a non-custodial way to recover and inherit crypto assets using MPC. Passionate team, real problem, the early days of smart-wallet UX.", linkLabel: null, linkHref: null, photos: 2 },
  { id: "consenso-2019", date: "Jan 2019", year: 2019, title: "Founded Consenso Labs", tag: "milestone", body: "Started a Web3 research and development lab focused on blockchain infrastructure and smart-account tooling. Mostly: a quiet bet that this would matter.", linkLabel: null, linkHref: null, photos: 1 },
  { id: "amity-2019", date: "2019 — 2020", year: 2019, title: "Blockchain Faculty — Amity Online", tag: "side_quest", body: "Part-time faculty for the PGD-BTM blockchain programme at Amity Online. Teaching the thing while learning the thing.", linkLabel: null, linkHref: null, photos: 1 },
  { id: "book-2019", date: "2018 — 2019", year: 2018, title: "Authored “Foundations of Blockchain”", tag: "writing", body: "One of the earliest developer books in crypto, published by Packt. A year of writing discipline after quitting a full-time job to chase this.", linkLabel: null, linkHref: null, photos: 1 },
  { id: "cowrks-2017", date: "2016 — 2017", year: 2017, title: "Senior Developer — CoWrks", tag: "work", body: "Full-stack developer with managerial responsibilities. Led design and build of an internal network-enhancement project.", linkLabel: null, linkHref: null, photos: 1 },
  { id: "rsa-fte-2016", date: "Jul 2016", year: 2016, title: "Software Engineer — RSA Security", tag: "work", body: "Worked on RSA's flagship network and log analytics tool, Security Analytics. Deployment and operations strategy during active development.", linkLabel: null, linkHref: null, photos: 1 },
  { id: "rsa-intern-2015", date: "Jul 2015", year: 2015, title: "Intern — RSA Security", tag: "work", body: "First professional experience in information security at one of the most respected names in the field.", linkLabel: null, linkHref: null, photos: 1 },
  { id: "mtech-2014", date: "2014 — 2016", year: 2014, title: "MTech — Computer & Information Systems Security", tag: "milestone", body: "Master of Technology from Manipal Institute of Technology, specialising in Information Assurance and Systems Security. The foundation of everything built since.", linkLabel: null, linkHref: null, photos: 1 },
];

async function main() {
  await prisma.profile.deleteMany();

  const profile = await prisma.profile.create({
    data: {
      username: "koshik",
      name: "Koshik Raj",
      bio: "Deep into crypto since 2018, with a background in information security.\nAlways a builder at heart — full of caffeine.",
      status: "Building Sage — a co-pilot for every crypto move",
      location: "Bengaluru, India",
      about: [
        "I have been building in crypto since 2018. Before that, I spent years inside information security — first as an intern, then a software engineer at RSA — which is where I learned to love hard problems and paranoid systems thinking.",
        "In 2019 I founded Consenso Labs, a small R&D lab for blockchain infrastructure and smart-account tooling. Since then I have shipped Safient, ZenGuard, Brewit, Zhentan, and most recently Sage — a personal AI co-signer for Solana wallets, live on mainnet from day one.",
        "Along the way: a developer book with Packt, two grants from Safe, two ETHIndia finals, talks at Devcon and Devconnect, and one really loud hackathon win at BNB OpenClaw.",
        "If you are working on smart accounts, agentic crypto, or the uncomfortable middle ground between AI and on-chain identity — say hi.",
      ].join("\n\n"),
      avatarUrl: null,
      socials: JSON.stringify(SOCIALS),
      theme: JSON.stringify(DEFAULT_THEME),
    },
  });

  const MON: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  const seedDateOn = (date: string, year: number) => {
    const m = date.match(/^([A-Z][a-z]{2})\s+(\d{4})$/); // "Apr 2026"
    const mo = m ? MON[m[1]] : 1;
    const y = m ? Number(m[2]) : year;
    return `${y}-${String(mo).padStart(2, "0")}-01`;
  };

  for (let i = 0; i < HIGHLIGHTS.length; i++) {
    const h = HIGHLIGHTS[i];
    await prisma.event.create({
      data: {
        id: h.id,
        profileId: profile.id,
        dateOn: seedDateOn(h.date, h.year),
        title: h.title,
        tags: [h.tag],
        featured: true,
        body: h.body,
        linkLabel: h.linkLabel,
        linkHref: h.linkHref,
        position: i,
        media: {
          create: Array.from({ length: h.photos }, (_, p) => ({
            kind: "image",
            url: null, // empty placeholder slots until real uploads land
            position: p,
          })),
        },
      },
    });
  }

  console.log(`Seeded profile "${profile.username}" with ${HIGHLIGHTS.length} highlights.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
