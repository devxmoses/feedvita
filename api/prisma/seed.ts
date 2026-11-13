import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Segment } from '../generated/prisma/enums';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SPECIES: { name: string; slug: string; segment: Segment; isApproved: boolean }[] = [
    { name: 'Dog',     slug: 'dog',     segment: Segment.PET, isApproved: true },
    { name: 'Cat',     slug: 'cat',     segment: Segment.PET, isApproved: true  },
    { name: 'Bird',    slug: 'bird',    segment: Segment.POULTRY, isApproved: true  },
    { name: 'Chicken', slug: 'chicken', segment: Segment.POULTRY, isApproved: true  },
    { name: 'Fish',    slug: 'fish',    segment: Segment.AQUACULTURE, isApproved: true  },
    { name: 'Rabbit',  slug: 'rabbit',  segment: Segment.LIVESTOCK, isApproved: true  },
    { name: 'Cattle',  slug: 'cattle',  segment: Segment.LIVESTOCK, isApproved: true  },
    { name: 'Goat',    slug: 'goat',    segment: Segment.LIVESTOCK, isApproved: true  },
    { name: 'Sheep',   slug: 'sheep',   segment: Segment.LIVESTOCK, isApproved: true  },
    { name: 'Pig',     slug: 'pig',     segment: Segment.LIVESTOCK, isApproved: true  },
    { name: 'Horse',   slug: 'horse',   segment: Segment.LIVESTOCK, isApproved: true  },
    { name: 'Horse',   slug: 'camel',   segment: Segment.LIVESTOCK, isApproved: true  },
    { name: 'Horse',   slug: 'donkey',   segment: Segment.LIVESTOCK, isApproved: true  },
];

async function main() {
    for (const species of SPECIES) {
        // upsert, not create: the seed has to be safe to run twice
        await prisma.species.upsert({
            where: { slug: species.slug },
            update: { name: species.name, segment: species.segment },
            create: {...species, isApproved: true },
        });
    }

    console.log(`seeded ${SPECIES.length} species`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
