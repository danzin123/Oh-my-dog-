const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando semeação do banco de dados...');

  // Limpar dados existentes
  await prisma.product.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.neighborhood.deleteMany();

  // Inserir Produtos
  const products = [
    {
      name: 'Oh My Dog Simples',
      description: 'Pão de brioche, 1 salsicha artesanal, maionese temperada, ketchup, mostarda, vinagrete caseiro e batata palha.',
      price: 15.90,
      promotionalPrice: null,
      imageUrl: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&w=600&q=80',
      category: 'HOTDOG',
      active: true,
    },
    {
      name: 'Oh My Dog Duplo',
      description: 'Pão de brioche, 2 salsichas artesanais, maionese temperada, muito queijo cheddar derretido, vinagrete e batata palha.',
      price: 21.90,
      promotionalPrice: 19.90, // Em promoção!
      imageUrl: 'https://images.unsplash.com/photo-1627059318426-472b777625da?auto=format&fit=crop&w=600&q=80',
      category: 'HOTDOG',
      active: true,
    },
    {
      name: 'Oh My Bacon Dog',
      description: 'Pão de brioche, 1 salsicha artesanal envolta em bacon crocante, maionese defumada, queijo prato derretido e cebola caramelizada.',
      price: 25.90,
      promotionalPrice: null,
      imageUrl: 'https://images.unsplash.com/photo-1541214113241-21578d2d9b62?auto=format&fit=crop&w=600&q=80',
      category: 'HOTDOG',
      active: true,
    },
    {
      name: 'Oh My Cheese Dog',
      description: 'Pão de brioche, 1 salsicha artesanal, muito creme de gorgonzola, muçarela gratinada no maçarico e batata palha.',
      price: 23.90,
      promotionalPrice: null,
      imageUrl: 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=600&q=80',
      category: 'HOTDOG',
      active: true,
    },
    {
      name: 'Coca-Cola Lata',
      description: 'Refrigerante Coca-Cola original 350ml bem gelado.',
      price: 6.00,
      promotionalPrice: null,
      imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
      category: 'DRINK',
      active: true,
    },
    {
      name: 'Guaraná Antarctica',
      description: 'Refrigerante Guaraná Antarctica 350ml bem gelado.',
      price: 6.00,
      promotionalPrice: null,
      imageUrl: 'https://images.unsplash.com/photo-1626082896492-766af4fc6595?auto=format&fit=crop&w=600&q=80',
      category: 'DRINK',
      active: true,
    },
    {
      name: 'Água Mineral',
      description: 'Garrafa de água mineral sem gás 500ml.',
      price: 4.00,
      promotionalPrice: null,
      imageUrl: 'https://images.unsplash.com/photo-1608885898957-a599fb16ec8d?auto=format&fit=crop&w=600&q=80',
      category: 'DRINK',
      active: true,
    },
  ];

  for (const product of products) {
    await prisma.product.create({
      data: product,
    });
  }

  // Inserir Cupons
  await prisma.coupon.create({
    data: {
      code: 'DOG10',
      discountType: 'PERCENTAGE',
      value: 10.00,
      minOrderValue: 20.00,
      active: true,
    },
  });

  await prisma.coupon.create({
    data: {
      code: 'BEMVINDO5',
      discountType: 'FIXED',
      value: 5.00,
      minOrderValue: 15.00,
      active: true,
    },
  });

  // Inserir Bairros iniciais de Bragança Paulista
  const neighborhoods = [
    { name: 'Centro', deliveryFee: 5.00, active: true },
    { name: 'Jardim Paulista', deliveryFee: 6.00, active: true },
    { name: 'Lago do Taboão', deliveryFee: 6.00, active: true },
    { name: 'Hípica Jaguari', deliveryFee: 8.00, active: true },
    { name: 'Jardim Santa Rita', deliveryFee: 7.50, active: true },
  ];

  for (const nh of neighborhoods) {
    await prisma.neighborhood.create({
      data: nh,
    });
  }

  console.log('Semeação concluída com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro na semeação:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
