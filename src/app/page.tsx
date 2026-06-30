import MenuClient from '@/components/MenuClient';
import { prisma } from '@/lib/db';

// Forçar renderização dinâmica para sempre obter o menu e status mais recentes do banco
export const revalidate = 0;

export default async function Home() {
  // Buscar produtos ativos do banco de dados
  const products = await prisma.product.findMany({
    where: {
      active: true,
    },
    orderBy: [
      { category: 'asc' },
      { name: 'asc' },
    ],
  });

  // Serializar campos Decimal para String para evitar erros de serialização no Client Component
  const serializedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price.toString(),
    promotionalPrice: p.promotionalPrice ? p.promotionalPrice.toString() : null,
    imageUrl: p.imageUrl,
    category: p.category,
  }));

  return <MenuClient initialProducts={serializedProducts} />;
}
