'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Check, 
  Flame, 
  MapPin, 
  ShoppingBag, 
  Clock, 
  ChevronRight, 
  ArrowLeft,
  AlertCircle
} from 'lucide-react';

interface OrderItem {
  productName: string;
  quantity: number;
}

interface Order {
  id: string;
  clientName: string;
  paymentStatus: string;
  orderStatus: string;
  deliveryType: string;
  deliveryFee: string;
  total: string;
  addressStreet: string | null;
  addressNumber: string | null;
  addressReference: string | null;
  neighborhoodName: string | null;
  createdAt: string;
  items: OrderItem[];
}

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${id}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
      } else {
        setError('Não conseguimos localizar esse pedido.');
      }
    } catch {
      setError('Erro ao carregar status do pedido.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    
    fetchOrder();

    // Poll a cada 3 segundos para atualizar o status do preparo em tempo real
    const interval = setInterval(fetchOrder, 3000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-stone-400 text-xs font-bold uppercase tracking-wider">Carregando Pedido...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center">
          <AlertCircle size={32} />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-white uppercase tracking-wider">Pedido não encontrado</h3>
          <p className="text-stone-400 text-xs max-w-xs">{error || 'Identificador de pedido inválido ou inexistente.'}</p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="bg-stone-900 border border-card-border hover:bg-stone-850 text-stone-200 px-5 py-3 rounded-xl text-xs font-bold uppercase cursor-pointer"
        >
          Voltar ao Cardápio
        </button>
      </div>
    );
  }

  // Mapeamento de etapas do stepper
  const getStepIndex = (status: string, deliveryType: string) => {
    if (deliveryType === 'DELIVERY') {
      switch (status) {
        case 'RECEIVED': return 0;
        case 'PREPARING': return 1;
        case 'READY': return 1;
        case 'DISPATCHED': return 2;
        case 'DELIVERED': return 3;
        default: return 0;
      }
    } else {
      switch (status) {
        case 'RECEIVED': return 0;
        case 'PREPARING': return 1;
        case 'READY': return 2;
        case 'DELIVERED': return 3;
        default: return 0;
      }
    }
  };

  const currentStep = getStepIndex(order.orderStatus, order.deliveryType);

  const steps = [
    { 
      title: 'Confirmado', 
      desc: 'Pedido recebido e confirmado', 
      icon: ShoppingBag 
    },
    { 
      title: 'Na Chapa', 
      desc: order.orderStatus === 'READY' && order.deliveryType === 'DELIVERY' 
        ? 'Pronto! Aguardando despacho.' 
        : 'Seu Oh my Dog está sendo preparado', 
      icon: Flame 
    },
    { 
      title: order.deliveryType === 'DELIVERY' ? 'A Caminho' : 'No Balcão', 
      desc: order.deliveryType === 'DELIVERY' ? 'Saiu para entrega com o motoboy' : 'Lanche pronto esperando você', 
      icon: order.deliveryType === 'DELIVERY' ? MapPin : Check 
    },
    { 
      title: 'Entregue', 
      desc: 'Lanche entregue, aproveite!', 
      icon: Check 
    }
  ];

  return (
    <div className="min-h-screen bg-black text-stone-100 font-sans flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-card-border/60 z-40 p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="text-stone-400 hover:text-white flex items-center gap-1 text-xs font-bold uppercase transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            Cardápio
          </button>
          <span className="font-mono text-xs text-stone-500 uppercase tracking-widest">
            Acompanhar Pedido
          </span>
          <span className="font-mono text-xs text-primary font-black uppercase">
            #{order.id.slice(-6).toUpperCase()}
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-6 pb-20">
        
        {/* Status Stepper Card */}
        <div className="bg-card-bg border border-card-border rounded-2xl p-5 shadow-xl space-y-6">
          <div className="border-b border-card-border/60 pb-3 flex justify-between items-center">
            <div>
              <h2 className="text-stone-400 text-[10px] font-bold uppercase tracking-wider">Status Atual</h2>
              <p className="text-lg font-black text-white mt-0.5">
                {steps[currentStep].title}
              </p>
            </div>
            <span className="text-[10px] text-muted font-mono flex items-center gap-1 bg-stone-900 border border-card-border/60 px-2 py-1 rounded">
              <Clock size={10} />
              Atualizando ao vivo
            </span>
          </div>

          {/* Vertical Stepper Timeline */}
          <div className="relative pl-6 space-y-6">
            {/* Timeline Vertical Line */}
            <div className="absolute left-2.5 top-1.5 bottom-1.5 w-0.5 bg-stone-900">
              <div 
                className="w-full bg-primary transition-all duration-700" 
                style={{ height: `${(currentStep / (steps.length - 1)) * 100}%` }}
              ></div>
            </div>

            {steps.map((step, idx) => {
              const StepIcon = step.icon;
              const isCompleted = idx < currentStep;
              const isActive = idx === currentStep;
              
              return (
                <div key={idx} className="relative flex gap-4 items-start">
                  {/* Circle Indicator */}
                  <div className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center border transition-all duration-300 z-10 ${
                    isCompleted 
                      ? 'bg-primary border-primary text-white scale-110' 
                      : isActive
                        ? 'bg-black border-primary text-primary scale-125 shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse'
                        : 'bg-stone-950 border-card-border text-stone-600'
                  }`}>
                    {isCompleted ? <Check size={11} className="stroke-[3]" /> : <StepIcon size={10} />}
                  </div>

                  {/* Text Details */}
                  <div className="space-y-0.5">
                    <h4 className={`text-xs font-black uppercase tracking-wide ${
                      isActive ? 'text-primary' : isCompleted ? 'text-stone-200' : 'text-stone-600'
                    }`}>
                      {step.title}
                    </h4>
                    <p className={`text-[10px] ${
                      isActive ? 'text-stone-300' : isCompleted ? 'text-stone-500' : 'text-stone-700'
                    }`}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Items Card */}
        <div className="bg-card-bg border border-card-border rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="font-black text-xs text-white uppercase tracking-wider border-b border-card-border/60 pb-2">
            Resumo do Pedido
          </h3>
          <div className="space-y-2">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs text-stone-300">
                <span>{item.productName}</span>
                <span className="font-extrabold text-stone-200 bg-stone-900 border border-card-border/60 px-2 py-0.5 rounded text-[10px]">
                  {item.quantity}x
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-card-border/60 pt-3 flex justify-between items-center text-xs font-bold">
            <span className="text-stone-400">Total Pago:</span>
            <span className="text-white text-sm font-black">R$ {parseFloat(order.total).toFixed(2)}</span>
          </div>
        </div>

        {/* Delivery Details Card (only if delivery) */}
        {order.deliveryType === 'DELIVERY' && order.addressStreet && (
          <div className="bg-card-bg border border-card-border rounded-2xl p-5 shadow-xl space-y-3 text-xs">
            <h3 className="font-black text-xs text-white uppercase tracking-wider border-b border-card-border/60 pb-2 flex items-center gap-1.5">
              <MapPin size={13} className="text-primary animate-pulse" />
              Endereço de Entrega
            </h3>
            <div className="space-y-1 text-stone-300 text-[11px]">
              <p className="font-bold text-stone-100">{order.addressStreet}, {order.addressNumber}</p>
              <p>Bairro: {order.neighborhoodName}</p>
              {order.addressReference && (
                <p className="text-stone-500 italic">Ponto de Ref: {order.addressReference}</p>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
