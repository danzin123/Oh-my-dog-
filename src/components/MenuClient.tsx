'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Minus, X, Trash2, CheckCircle2, Ticket, QrCode, CreditCard, ChevronRight, MessageSquare, AlertCircle, MapPin } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useRouter } from 'next/navigation';

interface Product {
  id: string;
  name: string;
  description: string;
  price: string; // Decimal is returned as string from Prisma
  promotionalPrice: string | null;
  imageUrl: string | null;
  category: string;
}

interface Coupon {
  code: string;
  discountType: string;
  value: string;
  minOrderValue: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
  notes: string;
}

interface MenuClientProps {
  initialProducts: Product[];
}

export default function MenuClient({ initialProducts }: MenuClientProps) {
  const router = useRouter();
  const [products] = useState<Product[]>(initialProducts);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [checkoutStep, setCheckoutStep] = useState<'DETAILS' | 'PAYMENT' | 'SUCCESS'>('DETAILS');
  
  // Delivery states
  const [deliveryType, setDeliveryType] = useState<'DELIVERY' | 'WITHDRAWAL'>('WITHDRAWAL');
  const [neighborhoods, setNeighborhoods] = useState<Array<{ id: string; name: string; deliveryFee: string }>>([]);
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressReference, setAddressReference] = useState('');
  const [addressCep, setAddressCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);

  // Fetch neighborhoods on mount (retained for database fallbacks reference if needed)
  useEffect(() => {
    fetch('/api/neighborhoods')
      .then(res => res.json())
      .then(data => setNeighborhoods(data.neighborhoods || []))
      .catch(err => console.error('Erro ao buscar bairros:', err));
  }, []);

  // Fetch delivery fee dynamically as user types address details
  useEffect(() => {
    if (deliveryType === 'DELIVERY' && addressStreet.trim() && addressNeighborhood.trim()) {
      const controller = new AbortController();
      const delayDebounce = setTimeout(() => {
        fetch(`/api/delivery-fee?street=${encodeURIComponent(addressStreet)}&number=${encodeURIComponent(addressNumber)}&neighborhood=${encodeURIComponent(addressNeighborhood)}`, { signal: controller.signal })
          .then(res => res.json())
          .then(data => {
            setDeliveryFee(data.fee || 0);
          })
          .catch(err => {
            if (err.name !== 'AbortError') console.error('Erro ao buscar taxa de entrega:', err);
          });
      }, 600); // Debounce de 600ms

      return () => {
        clearTimeout(delayDebounce);
        controller.abort();
      };
    } else {
      setDeliveryFee(0);
    }
  }, [deliveryType, addressStreet, addressNumber, addressNeighborhood]);

  const handleCepLookup = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setCepLoading(true);
    setCepError('');
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      
      if (data.erro) {
        setCepError('CEP não encontrado.');
        return;
      }

      const city = data.localidade?.toLowerCase() || '';
      if (!city.includes('bragança paulista') && !city.includes('braganca paulista')) {
        setCepError('Desculpe, o Oh my Dog atende apenas em Bragança Paulista.');
        return;
      }

      setAddressStreet(data.logradouro || '');

      setAddressNeighborhood(data.bairro || '');
    } catch {
      setCepError('Erro ao consultar CEP. Preencha manualmente.');
    } finally {
      setCepLoading(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);
    
    let formatted = val;
    if (val.length > 5) {
      formatted = `${val.slice(0, 5)}-${val.slice(5)}`;
    }
    setAddressCep(formatted);

    if (val.length === 8) {
      handleCepLookup(val);
    }
  };

  // Checkout/Payment states
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [pixCopyPaste, setPixCopyPaste] = useState<string | null>(null);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState('');

  // Cart helper functions
  const addToCart = (product: Product, notes = '') => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id && item.notes === notes);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id && item.notes === notes
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, notes }];
    });
    // Visual feedback
    const toast = document.getElementById('toast-feedback');
    if (toast) {
      toast.classList.remove('translate-y-20', 'opacity-0');
      setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
      }, 2000);
    }
  };

  const updateQuantity = (productId: string, notes: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId && item.notes === notes) {
            const nextQty = item.quantity + delta;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string, notes: string) => {
    setCart((prev) => prev.filter((item) => !(item.product.id === productId && item.notes === notes)));
  };

  // Calc prices
  const getProductPrice = (product: Product) => {
    return parseFloat(product.promotionalPrice || product.price);
  };

  const subtotal = cart.reduce((acc, item) => acc + getProductPrice(item.product) * item.quantity, 0);

  const discount = appliedCoupon
    ? appliedCoupon.discountType === 'PERCENTAGE'
      ? subtotal * (parseFloat(appliedCoupon.value) / 100)
      : parseFloat(appliedCoupon.value)
    : 0;

  const total = Math.max(0, subtotal - discount + (deliveryType === 'DELIVERY' ? deliveryFee : 0));

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError('');
    try {
      const res = await fetch(`/api/coupons/validate?code=${couponCode.toUpperCase()}&subtotal=${subtotal}`);
      const data = await res.json();
      if (res.ok) {
        setAppliedCoupon(data.coupon);
        setCouponCode('');
      } else {
        setCouponError(data.message || 'Cupom inválido');
      }
    } catch {
      setCouponError('Erro ao validar cupom');
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  // Checkout handler
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim()) return;

    setLoading(true);
    setPaymentError('');

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          clientPhone,
          paymentMethod,
          couponCode: appliedCoupon?.code || null,
          deliveryType,
          addressNeighborhood: deliveryType === 'DELIVERY' ? addressNeighborhood : null,
          addressStreet: deliveryType === 'DELIVERY' ? addressStreet : null,
          addressNumber: deliveryType === 'DELIVERY' ? addressNumber : null,
          addressReference: deliveryType === 'DELIVERY' ? addressReference : null,
          items: cart.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            notes: item.notes
          }))
        })
      });

      const data = await response.json();

      if (response.ok) {
        setOrderId(data.orderId);
        if (paymentMethod === 'PIX') {
          setPixCopyPaste(data.pixCopyPaste);
          setPixQrCode(data.pixQrCode);
          setCheckoutStep('PAYMENT');
        } else {
          // Em um app de produção com cartão de crédito, integraríamos com o iFrame/checkout da Stone.
          // Aqui simulamos uma autorização imediata por simplicidade.
          setCheckoutStep('SUCCESS');
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
          setCart([]);
        }
      } else {
        setPaymentError(data.message || 'Erro ao processar checkout');
      }
    } catch {
      setPaymentError('Falha na comunicação com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Poll for payment status
  useEffect(() => {
    if (checkoutStep !== 'PAYMENT' || !orderId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`);
        const data = await res.json();

        if (data.status === 'PAID') {
          clearInterval(interval);
          setCheckoutStep('SUCCESS');
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
          setCart([]);
          setAppliedCoupon(null);
        }
      } catch (err) {
        console.error('Erro ao verificar status do pagamento:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [checkoutStep, orderId]);

  const categories = [
    { id: 'ALL', label: 'Todos' },
    { id: 'HOTDOG', label: 'Hot Dogs' },
    { id: 'DRINK', label: 'Bebidas' }
  ];

  const filteredProducts = products.filter(
    (p) => activeCategory === 'ALL' || p.category === activeCategory
  );

  return (
    <div className="min-h-screen pb-24 bg-background text-foreground">
      {/* Toast Feedback */}
      <div 
        id="toast-feedback"
        className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-success text-white px-6 py-3 rounded-full shadow-lg font-medium transition-all duration-300 translate-y-20 opacity-0 z-50 flex items-center gap-2"
      >
        <CheckCircle2 size={18} />
        Item adicionado ao carrinho!
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-card-border">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              id="header-logo"
              src="/logo.png" 
              alt="Logo Oh my Dog!" 
              className="w-12 h-12 object-contain rounded-lg shadow-lg"
              onError={(e) => {
                // Esconde a imagem se o arquivo não existir e mostra o fallback de texto/emoji
                e.currentTarget.style.display = 'none';
                const fallback = document.getElementById('header-logo-fallback');
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
            
            <div id="header-logo-fallback" className="flex items-center gap-2 hidden">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold text-lg text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                🌭
              </div>
            </div>

            <div>
              <h1 className="font-extrabold text-xl tracking-tight text-white">
                Oh my <span className="text-primary font-black">Dog!</span>
              </h1>
              <p className="text-[10px] text-muted tracking-wide uppercase font-semibold">Os melhores hotdogs da região</p>
            </div>
          </div>
          
          <button 
            onClick={() => setIsCartOpen(true)}
            className="relative p-2.5 rounded-full bg-card-bg border border-card-border hover:border-primary transition-all duration-300"
          >
            <ShoppingBag size={20} className="text-stone-100" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[11px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Banner / Hero */}
      <section className="max-w-5xl mx-auto px-4 mt-6">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-primary/30 to-accent/20 p-8 border border-card-border flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="z-10 text-center md:text-left">
            <span className="bg-primary/20 text-primary border border-primary/30 px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">Promoção Especial</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-4 tracking-tight leading-tight">
              Sabor Gigante, <br />Preço que cabe no bolso.
            </h2>
            <p className="text-muted mt-2 text-sm max-w-md">Queijo derretido, salsicha artesanal e pão de brioche assado na hora. Peça já o seu!</p>
          </div>
          <div className="relative w-48 h-32 md:w-64 md:h-44 flex items-center justify-center text-8xl md:text-9xl drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] select-none animate-bounce duration-1000">
            🌭
          </div>
          {/* Decorative glow elements */}
          <div className="absolute top-0 right-1/4 w-32 h-32 bg-primary/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-10 w-32 h-32 bg-accent/20 rounded-full blur-3xl"></div>
        </div>
      </section>

      {/* Categorias */}
      <section className="max-w-5xl mx-auto px-4 mt-8">
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-5 py-2.5 rounded-full font-bold text-sm tracking-wide transition-all duration-300 cursor-pointer whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-primary text-white shadow-[0_4px_12px_rgba(239,68,68,0.3)]'
                  : 'bg-card-bg text-stone-300 border border-card-border hover:bg-stone-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Lista de Produtos */}
      <main className="max-w-5xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredProducts.map((product) => {
            const hasPromo = product.promotionalPrice !== null;
            return (
              <div 
                key={product.id}
                className="bg-card-bg border border-card-border rounded-xl p-4 flex gap-4 hover:border-stone-700 transition-all duration-300 group shadow-lg"
              >
                <div className="relative w-28 h-28 flex-shrink-0 bg-stone-900 rounded-lg overflow-hidden border border-card-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={product.imageUrl || '/placeholder.png'} 
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {hasPromo && (
                    <span className="absolute top-1.5 left-1.5 bg-primary text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow">
                      PROMO
                    </span>
                  )}
                </div>
                
                <div className="flex flex-col justify-between flex-grow">
                  <div>
                    <h3 className="font-extrabold text-base text-stone-100 group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-xs text-muted mt-1 line-clamp-2">
                      {product.description}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-baseline gap-1.5">
                      {hasPromo ? (
                        <>
                          <span className="text-lg font-black text-white">
                            R$ {parseFloat(product.promotionalPrice!).toFixed(2)}
                          </span>
                          <span className="text-xs text-muted line-through">
                            R$ {parseFloat(product.price).toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="text-lg font-black text-white">
                          R$ {parseFloat(product.price).toFixed(2)}
                        </span>
                      )}
                    </div>
                    
                    <button
                      onClick={() => addToCart(product)}
                      className="p-1.5 rounded-full bg-primary hover:bg-primary-hover text-white transition-all cursor-pointer shadow-[0_2px_8px_rgba(239,68,68,0.2)] hover:scale-105"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Carrinho de Compras (Drawer lateral) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setIsCartOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-card-bg border-l border-card-border flex flex-col justify-between shadow-2xl">
              
              {/* Carrinho Header */}
              <div className="p-4 border-b border-card-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={20} className="text-primary" />
                  <h3 className="font-extrabold text-lg text-white">Seu Carrinho</h3>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 rounded-full bg-stone-900 border border-card-border hover:border-primary text-stone-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Itens do Carrinho */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <ShoppingBag size={48} className="text-stone-700 animate-bounce" />
                    <p className="font-bold text-stone-400 mt-4">Carrinho vazio</p>
                    <p className="text-xs text-muted mt-1">Adicione alguns hotdogs deliciosos para começar!</p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div 
                      key={`${item.product.id}-${idx}`}
                      className="bg-stone-950 border border-card-border rounded-xl p-3.5 flex gap-3 shadow-inner"
                    >
                      <div className="w-16 h-16 bg-stone-900 rounded-lg overflow-hidden flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={item.product.imageUrl || '/placeholder.png'} 
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      <div className="flex-grow flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-sm text-stone-200">{item.product.name}</h4>
                            <button 
                              onClick={() => removeFromCart(item.product.id, item.notes)}
                              className="text-stone-500 hover:text-primary transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          
                          {/* Notas */}
                          <div className="mt-1 flex items-center gap-1">
                            <MessageSquare size={10} className="text-muted" />
                            <input 
                              type="text" 
                              placeholder="Adicionar observação (ex: sem vinagrete)..." 
                              value={item.notes}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCart(prev => prev.map((c, i) => i === idx ? { ...c, notes: val } : c));
                              }}
                              className="text-[11px] bg-transparent border-b border-transparent focus:border-stone-700 focus:outline-none text-stone-300 w-full placeholder-stone-600"
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs font-bold text-white">
                            R$ {(getProductPrice(item.product) * item.quantity).toFixed(2)}
                          </span>
                          
                          <div className="flex items-center bg-stone-900 border border-card-border rounded-lg p-0.5">
                            <button
                              onClick={() => updateQuantity(item.product.id, item.notes, -1)}
                              className="p-1 text-stone-400 hover:text-white"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="px-2.5 text-xs font-black text-stone-200">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product.id, item.notes, 1)}
                              className="p-1 text-stone-400 hover:text-white"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Total e Checkout */}
              {cart.length > 0 && (
                <div className="p-4 border-t border-card-border bg-stone-950 space-y-4">
                  {/* Cupom */}
                  <div className="flex gap-2">
                    {appliedCoupon ? (
                      <div className="w-full flex items-center justify-between bg-success/15 border border-success/30 px-3.5 py-2.5 rounded-xl text-success text-xs font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Ticket size={14} />
                          <span>Cupom {appliedCoupon.code} aplicado (-R$ {discount.toFixed(2)})</span>
                        </div>
                        <button onClick={removeCoupon} className="hover:text-red-400">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          placeholder="Cupom de Desconto"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          className="bg-card-bg border border-card-border text-stone-200 rounded-xl px-3.5 py-2.5 text-xs flex-grow focus:outline-none focus:border-stone-600 uppercase"
                        />
                        <button
                          onClick={applyCoupon}
                          className="bg-stone-900 hover:bg-stone-850 border border-card-border text-stone-200 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Aplicar
                        </button>
                      </>
                    )}
                  </div>
                  {couponError && <p className="text-red-500 text-[10px] font-bold px-1">{couponError}</p>}

                  {/* Resumos */}
                  <div className="space-y-1.5 text-xs text-stone-400">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>R$ {subtotal.toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-success">
                        <span>Desconto</span>
                        <span>- R$ {discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-black text-white pt-1.5 border-t border-card-border">
                      <span>Total Geral</span>
                      <span className="text-primary text-lg">R$ {total.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      setIsCheckoutOpen(true);
                      setCheckoutStep('DETAILS');
                    }}
                    className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-[0_4px_15px_rgba(239,68,68,0.4)] flex items-center justify-center gap-1.5 cursor-pointer uppercase text-sm"
                  >
                    <span>Finalizar Pedido</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card-bg border border-card-border rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-between">
            {/* Modal Header */}
            <div className="p-4 border-b border-card-border flex items-center justify-between">
              <h3 className="font-extrabold text-base text-white">Finalização do Pedido</h3>
              {checkoutStep !== 'SUCCESS' && (
                <button
                  onClick={() => setIsCheckoutOpen(false)}
                  className="p-1 rounded-full hover:bg-stone-850 text-stone-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Modal Content */}
            <div className="p-5 max-h-[80vh] overflow-y-auto">
              
              {checkoutStep === 'DETAILS' && (
                <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-300">Seu Nome *</label>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Ex: João Silva"
                      className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-stone-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-300">WhatsApp / Telefone *</label>
                    <input
                       type="tel"
                       required
                       value={clientPhone}
                       onChange={(e) => setClientPhone(e.target.value)}
                       placeholder="Ex: (11) 99999-9999"
                       className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-stone-600"
                    />
                  </div>

                  {/* Opção de Entrega / Retirada */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-300">Como prefere receber? *</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setDeliveryType('WITHDRAWAL')}
                        className={`flex items-center justify-center py-2.5 border rounded-xl font-bold gap-1.5 transition-all cursor-pointer text-xs ${
                          deliveryType === 'WITHDRAWAL'
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-stone-950 border-card-border text-stone-400 hover:text-white'
                        }`}
                      >
                        <span>Retirar no Balcão</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeliveryType('DELIVERY')}
                        className={`flex items-center justify-center py-2.5 border rounded-xl font-bold gap-1.5 transition-all cursor-pointer text-xs ${
                          deliveryType === 'DELIVERY'
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-stone-950 border-card-border text-stone-400 hover:text-white'
                        }`}
                      >
                        <span>Receber em Casa (Entrega)</span>
                      </button>
                    </div>
                  </div>

                  {/* Campos de Endereço (se for entrega) */}
                  {deliveryType === 'DELIVERY' && (
                    <div className="space-y-3 p-3 bg-stone-950 border border-card-border rounded-xl animate-fadeIn">
                      {/* Busca por CEP */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-stone-300">CEP</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={addressCep}
                            onChange={handleCepChange}
                            placeholder="Ex: 12900-000 (Busca Automática)"
                            className="w-full bg-stone-900 border border-card-border text-stone-100 rounded-xl p-3 text-xs focus:outline-none focus:border-stone-600 pl-10"
                          />
                          {cepLoading ? (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                          )}
                        </div>
                        {cepError && <p className="text-red-500 text-[10px] font-bold px-1">{cepError}</p>}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-stone-300">Bairro (Bragança Paulista) *</label>
                        <input
                          type="text"
                          required={deliveryType === 'DELIVERY'}
                          value={addressNeighborhood}
                          onChange={(e) => setAddressNeighborhood(e.target.value)}
                          placeholder="Ex: Jardim Paulista"
                          className="w-full bg-stone-900 border border-card-border text-stone-100 rounded-xl p-3 text-xs focus:outline-none focus:border-stone-600"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5 col-span-2">
                          <label className="text-[11px] font-bold text-stone-300">Rua / Logradouro *</label>
                          <input
                            type="text"
                            required={deliveryType === 'DELIVERY'}
                            value={addressStreet}
                            onChange={(e) => setAddressStreet(e.target.value)}
                            placeholder="Ex: Av. Antônio Pires"
                            className="w-full bg-stone-900 border border-card-border text-stone-100 rounded-xl p-3 text-xs focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-stone-300">Número *</label>
                          <input
                            type="text"
                            required={deliveryType === 'DELIVERY'}
                            value={addressNumber}
                            onChange={(e) => setAddressNumber(e.target.value)}
                            placeholder="123"
                            className="w-full bg-stone-900 border border-card-border text-stone-100 rounded-xl p-3 text-xs focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-stone-300">Ponto de Referência / Complemento</label>
                        <input
                          type="text"
                          value={addressReference}
                          onChange={(e) => setAddressReference(e.target.value)}
                          placeholder="Ex: Apto 12, Próximo ao mercado X"
                          className="w-full bg-stone-900 border border-card-border text-stone-100 rounded-xl p-3 text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-300">Forma de Pagamento</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('PIX')}
                        className={`flex flex-col items-center justify-center py-4 border rounded-xl font-semibold gap-2 transition-all cursor-pointer ${
                          paymentMethod === 'PIX'
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-stone-950 border-card-border text-stone-400 hover:text-white hover:border-stone-700'
                        }`}
                      >
                        <QrCode size={20} />
                        <span className="text-xs">PIX (Rápido)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('CREDIT_CARD')}
                        className={`flex flex-col items-center justify-center py-4 border rounded-xl font-semibold gap-2 transition-all cursor-pointer ${
                          paymentMethod === 'CREDIT_CARD'
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-stone-950 border-card-border text-stone-400 hover:text-white hover:border-stone-700'
                        }`}
                      >
                        <CreditCard size={20} />
                        <span className="text-xs">Cartão de Crédito</span>
                      </button>
                    </div>
                  </div>

                  {/* Resumo do Checkout */}
                  <div className="bg-stone-950 border border-card-border p-3.5 rounded-xl space-y-1.5 text-xs text-stone-400">
                    <div className="flex justify-between">
                      <span>Itens do Pedido:</span>
                      <span className="text-stone-200">R$ {subtotal.toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-success">
                        <span>Desconto:</span>
                        <span>- R$ {discount.toFixed(2)}</span>
                      </div>
                    )}
                    {deliveryType === 'DELIVERY' && deliveryFee > 0 && (
                      <div className="flex justify-between text-accent">
                        <span>Taxa de Entrega:</span>
                        <span>+ R$ {deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-card-border">
                      <span>Total a Pagar:</span>
                      <span className="text-primary text-base">R$ {total.toFixed(2)}</span>
                    </div>
                  </div>

                  {paymentError && (
                    <div className="bg-red-950/30 border border-red-500/30 text-red-400 rounded-xl p-3 text-xs flex gap-2 items-center">
                      <AlertCircle size={16} className="flex-shrink-0" />
                      <span>{paymentError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-primary hover:bg-primary-hover disabled:bg-stone-800 disabled:text-stone-600 text-white rounded-xl font-bold transition-all shadow-[0_4px_12px_rgba(239,68,68,0.3)] cursor-pointer text-sm uppercase flex items-center justify-center gap-2 mt-6"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span>Gerar Pagamento</span>
                    )}
                  </button>
                </form>
              )}

              {checkoutStep === 'PAYMENT' && (
                <div className="flex flex-col items-center text-center space-y-5">
                  <div className="bg-success/15 border border-success/30 text-success text-xs font-semibold px-4 py-2 rounded-full inline-flex items-center gap-1.5 animate-pulse">
                    <div className="w-2 h-2 bg-success rounded-full"></div>
                    Aguardando Confirmação do Pagamento...
                  </div>

                  <p className="text-xs text-stone-300 max-w-xs">
                    Pague escaneando o QR Code abaixo ou copiando o código do Pix. O pedido começará a ser preparado assim que for confirmado.
                  </p>

                  {/* QR Code */}
                  <div className="bg-white p-4 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.08)] border border-stone-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={pixQrCode || '/placeholder-qr.png'} 
                      alt="Pix QR Code" 
                      className="w-48 h-48 object-contain"
                    />
                  </div>

                  {/* Copia e Cola */}
                  <div className="w-full space-y-2">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Código Copia e Cola</label>
                    <div className="flex bg-stone-950 border border-card-border rounded-xl p-1 items-center justify-between">
                      <input
                        type="text"
                        readOnly
                        value={pixCopyPaste || ''}
                        className="text-[10px] bg-transparent border-none text-stone-300 p-2 focus:outline-none select-all w-full truncate font-mono"
                      />
                      <button
                        onClick={() => {
                          if (pixCopyPaste) {
                            navigator.clipboard.writeText(pixCopyPaste);
                            alert('Código Pix copiado para a área de transferência!');
                          }
                        }}
                        className="bg-stone-900 text-stone-200 border border-card-border font-bold text-xs px-3.5 py-2 rounded-lg cursor-pointer hover:bg-stone-800 transition-all flex-shrink-0"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>

                  <div className="w-full pt-4 border-t border-card-border flex justify-between text-xs font-semibold text-stone-400">
                    <span>Pedido ID</span>
                    <span className="font-mono text-stone-200">{orderId?.slice(-6).toUpperCase()}</span>
                  </div>
                </div>
              )}

              {checkoutStep === 'SUCCESS' && (
                <div className="flex flex-col items-center text-center py-6 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-success/20 border border-success/40 text-success flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                    <CheckCircle2 size={40} />
                  </div>

                  <h4 className="text-xl font-black text-white">
                    Oh my God! Pedido Confirmado!
                  </h4>
                  
                  <p className="text-xs text-muted max-w-xs">
                    O pagamento foi recebido com sucesso e seu pedido já foi impresso na cozinha. É só aguardar!
                  </p>

                  <div className="bg-stone-950 border border-card-border rounded-xl p-4 w-full text-left text-xs space-y-1.5 text-stone-400">
                    <div className="flex justify-between">
                      <span>Identificador do Pedido:</span>
                      <span className="font-mono text-stone-100">#{orderId?.slice(-6).toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cliente:</span>
                      <span className="text-stone-100">{clientName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status do Preparo:</span>
                      <span className="text-accent font-bold">Na Chapa 🌭</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (orderId) {
                        router.push(`/order/${orderId}`);
                        setIsCheckoutOpen(false);
                        setCheckoutStep('DETAILS');
                        setCart([]); // Clear cart after success
                      }
                    }}
                    className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white font-black rounded-xl text-xs uppercase cursor-pointer shadow-lg hover:shadow-primary/20 flex items-center justify-center gap-1.5"
                  >
                    Acompanhar Pedido ao Vivo 🏍️
                  </button>

                  <button
                    onClick={() => {
                      setIsCheckoutOpen(false);
                      setCheckoutStep('DETAILS');
                      setOrderId(null);
                      setCart([]); // Clear cart
                    }}
                    className="w-full py-3 bg-stone-900 border border-card-border hover:bg-stone-850 hover:border-stone-700 text-stone-300 font-bold rounded-xl text-xs uppercase cursor-pointer"
                  >
                    Voltar ao Cardápio
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Footer Fixo (Carrinho flutuante no Mobile) */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-0 inset-x-0 p-4 z-30 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full py-4 px-6 bg-primary hover:bg-primary-hover text-white rounded-2xl shadow-[0_8px_25px_rgba(239,68,68,0.5)] flex items-center justify-between font-black text-sm tracking-wide uppercase transition-all duration-300 hover:scale-[1.02] cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="bg-white/20 px-2 py-0.5 rounded-md text-xs font-black">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
                <span>Ver Carrinho</span>
              </div>
              <span>R$ {total.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
