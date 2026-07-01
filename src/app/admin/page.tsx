'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  RefreshCw, 
  LogOut, 
  Eye, 
  EyeOff, 
  Lock, 
  ChefHat, 
  Utensils, 
  FileText,
  Upload,
  AlertCircle,
  Truck,
  MapPin,
  X,
  Settings,
  Save,
  ToggleLeft,
  ToggleRight,
  Clock,
  Store
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface OrderItem {
  productName: string;
  quantity: number;
  productPrice: string;
}

interface Order {
  id: string;
  clientName: string;
  clientPhone: string;
  notes: string | null;
  paymentStatus: string;
  orderStatus: string;
  total: string;
  createdAt: string;
  deliveryType: string;
  deliveryFee: string;
  neighborhoodName: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressReference: string | null;
  items: OrderItem[];
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  promotionalPrice: string | null;
  imageUrl: string | null;
  category: string;
  active: boolean;
}

interface DashboardData {
  metrics: {
    totalRevenue: number;
    totalOrders: number;
    ticketMedio: number;
  };
  chartData: Array<{ date: string; faturamento: number; pedidos: number }>;
  recentOrders: Order[];
}

interface StoreSettings {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  storeInstagram: string;
  isForceClose: boolean;
  openTime: string;
  closeTime: string;
  openDays: string; // "0,2,3,4,5,6"
  deliveryEnabled: boolean;
  withdrawalEnabled: boolean;
  deliveryBaseFee: string;
  deliveryFeePerKm: string;
  deliveryMaxDistanceKm: string;
  estimatedDeliveryTime: number;
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'KITCHEN' | 'PRODUCTS' | 'NEIGHBORHOODS' | 'SETTINGS'>('DASHBOARD');
  
  // Kitchen Live Ticking Timers
  const [currentTime, setCurrentTime] = useState<number>(0);

  // ─── Som de Novo Pedido ───────────────────────────────────────────────────
  const prevOrderCountRef = useRef<number | null>(null);
  const [hasNewOrder, setHasNewOrder] = useState(false);

  const playNewOrderSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playBeep = (startTime: number, freq: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.5, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      playBeep(ctx.currentTime, 880, 0.15);        // Bip 1
      playBeep(ctx.currentTime + 0.2, 1100, 0.15); // Bip 2
      playBeep(ctx.currentTime + 0.4, 880, 0.25);  // Bip 3 (longo)
    } catch (e) {
      console.warn('Audio não suportado:', e);
    }
  }, []);

  useEffect(() => {
    setCurrentTime(Date.now());
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const getElapsedTime = (createdAtString: string) => {
    if (currentTime === 0) return 'Calculando...';
    const diffMs = currentTime - new Date(createdAtString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Agora mesmo';
    return `${diffMins} min atrás`;
  };

  // Dashboard & Orders state
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Neighborhoods state
  const [neighborhoods, setNeighborhoods] = useState<Array<{ id: string; name: string; deliveryFee: string; active: boolean }>>([]);
  const [isNeighborhoodModalOpen, setIsNeighborhoodModalOpen] = useState(false);
  const [editingNeighborhood, setEditingNeighborhood] = useState<any | null>(null);
  const [neighborhoodForm, setNeighborhoodForm] = useState({
    id: '',
    name: '',
    deliveryFee: '',
    active: true
  });
  const [neighborhoodError, setNeighborhoodError] = useState('');

  // ─── Store Settings State ────────────────────────────────────────────────────
  const defaultSettings: StoreSettings = {
    storeName: 'Oh my Dog!',
    storePhone: '',
    storeAddress: '',
    storeInstagram: '',
    isForceClose: false,
    openTime: '17:30',
    closeTime: '23:00',
    openDays: '0,2,3,4,5,6',
    deliveryEnabled: true,
    withdrawalEnabled: true,
    deliveryBaseFee: '5.00',
    deliveryFeePerKm: '1.50',
    deliveryMaxDistanceKm: '10.00',
    estimatedDeliveryTime: 40,
  };
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(defaultSettings);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  const fetchNeighborhoods = async () => {
    try {
      const res = await fetch('/api/admin/neighborhoods');
      if (res.ok) {
        const data = await res.json();
        setNeighborhoods(data.neighborhoods || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveNeighborhood = async (e: React.FormEvent) => {
    e.preventDefault();
    setNeighborhoodError('');

    if (!neighborhoodForm.name || neighborhoodForm.deliveryFee === '') {
      setNeighborhoodError('Preencha os campos obrigatórios.');
      return;
    }

    const isEdit = !!neighborhoodForm.id;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch('/api/admin/neighborhoods', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(neighborhoodForm)
      });

      if (res.ok) {
        setIsNeighborhoodModalOpen(false);
        fetchNeighborhoods();
      } else {
        const data = await res.json();
        setNeighborhoodError(data.message || 'Erro ao salvar bairro');
      }
    } catch {
      setNeighborhoodError('Erro ao conectar com o servidor.');
    }
  };

  const handleDeleteNeighborhood = async (id: string) => {
    if (!confirm('Deseja realmente excluir este bairro?')) return;
    try {
      const res = await fetch(`/api/admin/neighborhoods?id=${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchNeighborhoods();
      } else {
        alert('Erro ao excluir bairro.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    id: '',
    name: '',
    description: '',
    price: '',
    promotionalPrice: '',
    category: 'HOTDOG',
    imageUrl: '',
    active: true
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [productError, setProductError] = useState('');

  // Check auth on mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        setIsAuthenticated(true);
        fetchDashboardData();
        fetchProducts();
        fetchNeighborhoods();
        fetchStoreSettings();
      } else {
        const data = await res.json();
        setLoginError(data.message || 'Senha inválida');
      }
    } catch {
      setLoginError('Erro ao efetuar login');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setIsAuthenticated(false);
    setDashboardData(null);
  };

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/admin/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
        setIsAuthenticated(true);
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/admin/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStoreSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setStoreSettings({
          ...data.settings,
          deliveryBaseFee: data.settings.deliveryBaseFee?.toString() ?? '5.00',
          deliveryFeePerKm: data.settings.deliveryFeePerKm?.toString() ?? '1.50',
          deliveryMaxDistanceKm: data.settings.deliveryMaxDistanceKm?.toString() ?? '10.00',
        });
      }
    } catch (err) {
      console.error('Erro ao buscar configurações:', err);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsSaved(false);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeSettings),
      });
      if (res.ok) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
      } else {
        setSettingsError('Erro ao salvar configurações.');
      }
    } catch {
      setSettingsError('Falha na conexão.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    const current = storeSettings.openDays.split(',').filter(Boolean).map(Number);
    const next = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day].sort();
    setStoreSettings(prev => ({ ...prev, openDays: next.join(',') }));
  };

  // Poll for new orders every 5 seconds for kitchen view
  useEffect(() => {
    if (!isAuthenticated) return;

    if (activeTab === 'KITCHEN') {
      fetchProducts();
      setHasNewOrder(false);
    }
    if (activeTab === 'SETTINGS') {
      fetchStoreSettings();
    }

    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAuthenticated, activeTab]);

  // Detectar novos pedidos e tocar som
  useEffect(() => {
    if (!dashboardData) return;
    const currentCount = dashboardData.recentOrders.length;
    if (prevOrderCountRef.current !== null && currentCount > prevOrderCountRef.current) {
      playNewOrderSound();
      if (activeTab !== 'KITCHEN') {
        setHasNewOrder(true);
      }
    }
    prevOrderCountRef.current = currentCount;
  }, [dashboardData, playNewOrderSound, activeTab]);

  // Load products when visiting products tab
  useEffect(() => {
    if (isAuthenticated && activeTab === 'PRODUCTS') {
      fetchProducts();
    }
  }, [isAuthenticated, activeTab]);

  // Load neighborhoods when visiting neighborhoods tab
  useEffect(() => {
    if (isAuthenticated && activeTab === 'NEIGHBORHOODS') {
      fetchNeighborhoods();
    }
  }, [isAuthenticated, activeTab]);

  // Order status update handler
  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, orderStatus: status })
      });
      if (res.ok) {
        fetchDashboardData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Order payment update handler
  const handleUpdateOrderPayment = async (orderId: string, status: string) => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, paymentStatus: status })
      });
      if (res.ok) {
        fetchDashboardData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Re-print queue handler
  const handleRePrintOrder = async (orderId: string) => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, paymentStatus: 'PAID' }) // Atualizar para PAID força o re-print se já não estiver na fila
      });
      if (res.ok) {
        alert('Pedido reenviado para a fila de impressão!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Image Upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setProductError('');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setProductForm(prev => ({ ...prev, imageUrl: data.imageUrl }));
      } else {
        setProductError(data.message || 'Erro ao subir imagem');
      }
    } catch {
      setProductError('Erro de conexão ao realizar upload.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Save/Edit product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductError('');

    if (!productForm.name || !productForm.description || !productForm.price) {
      setProductError('Preencha os campos obrigatórios.');
      return;
    }

    const isEdit = !!productForm.id;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch('/api/admin/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productForm)
      });

      if (res.ok) {
        setIsProductModalOpen(false);
        fetchProducts();
        setProductForm({
          id: '',
          name: '',
          description: '',
          price: '',
          promotionalPrice: '',
          category: 'HOTDOG',
          imageUrl: '',
          active: true
        });
      } else {
        const data = await res.json();
        setProductError(data.message || 'Erro ao salvar produto');
      }
    } catch {
      setProductError('Erro ao conectar com o servidor.');
    }
  };

  const openNewProductModal = () => {
    setProductForm({
      id: '',
      name: '',
      description: '',
      price: '',
      promotionalPrice: '',
      category: 'HOTDOG',
      imageUrl: '',
      active: true
    });
    setEditingProduct(null);
    setIsProductModalOpen(true);
    setProductError('');
  };

  const openEditProductModal = (p: Product) => {
    setProductForm({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      promotionalPrice: p.promotionalPrice || '',
      category: p.category,
      imageUrl: p.imageUrl || '',
      active: p.active
    });
    setEditingProduct(p);
    setIsProductModalOpen(true);
    setProductError('');
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Deseja realmente excluir este produto?')) return;
    try {
      const res = await fetch(`/api/admin/products?id=${productId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchProducts();
      } else {
        alert('Erro ao excluir produto.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Render Login state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-card-bg border border-card-border rounded-2xl p-6 shadow-2xl relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xl shadow-[0_0_15px_rgba(239,68,68,0.5)]">
            🌭
          </div>
          
          <div className="text-center mt-6">
            <h2 className="font-extrabold text-xl text-white">Oh my Dog Admin</h2>
            <p className="text-xs text-muted mt-1">Acesso restrito para gerência</p>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold text-stone-300">Senha de Acesso</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-stone-600 pl-10"
                />
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600" />
              </div>
            </div>

            {loginError && <p className="text-red-500 text-xs font-bold">{loginError}</p>}

            <button
              type="submit"
              className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-[0_4px_12px_rgba(239,68,68,0.3)] cursor-pointer text-sm uppercase"
            >
              Entrar no Painel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card-bg border-b md:border-b-0 md:border-r border-card-border flex flex-col justify-between flex-shrink-0">
        <div>
          {/* Brand */}
          <div className="p-5 border-b border-card-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌭</span>
              <div>
                <h1 className="font-extrabold text-base text-white tracking-tight leading-none">Oh my Dog!</h1>
                <span className="text-[10px] text-primary font-bold tracking-wider uppercase">Painel de Controle</span>
              </div>
            </div>
            <button 
              onClick={() => fetchDashboardData()} 
              className={`p-1 rounded-lg bg-stone-950 border border-card-border text-stone-400 hover:text-white ${refreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Nav */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('DASHBOARD')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 cursor-pointer ${
                activeTab === 'DASHBOARD'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-stone-300 hover:bg-stone-850'
              }`}
            >
              <TrendingUp size={18} />
              <span>Faturamento</span>
            </button>

            <button
              onClick={() => { setActiveTab('KITCHEN'); setHasNewOrder(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 cursor-pointer relative ${
                activeTab === 'KITCHEN'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-stone-300 hover:bg-stone-850'
              }`}
            >
              <ChefHat size={18} />
              <span>Cozinha / Chapa</span>
              {dashboardData?.recentOrders.filter(o => o.orderStatus === 'RECEIVED' || o.orderStatus === 'PREPARING').length ? (
                <span className="absolute right-3 bg-accent text-stone-950 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center animate-bounce">
                  {dashboardData?.recentOrders.filter(o => o.orderStatus === 'RECEIVED' || o.orderStatus === 'PREPARING').length}
                </span>
              ) : null}
              {hasNewOrder && activeTab !== 'KITCHEN' && (
                <span className="absolute top-1 right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('PRODUCTS')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 cursor-pointer ${
                activeTab === 'PRODUCTS'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-stone-300 hover:bg-stone-850'
              }`}
            >
              <Utensils size={18} />
              <span>Cardápio</span>
            </button>

            <button
              onClick={() => setActiveTab('NEIGHBORHOODS')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 cursor-pointer ${
                activeTab === 'NEIGHBORHOODS'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-stone-300 hover:bg-stone-850'
              }`}
            >
              <Truck size={18} />
              <span>Taxas de Entrega</span>
            </button>

            <button
              onClick={() => setActiveTab('SETTINGS')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 cursor-pointer ${
                activeTab === 'SETTINGS'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-stone-300 hover:bg-stone-850'
              }`}
            >
              <Settings size={18} />
              <span>Configurações</span>
            </button>
          </nav>
        </div>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-card-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-stone-950 hover:bg-red-950/20 text-stone-400 hover:text-red-400 border border-card-border rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut size={14} />
            <span>Sair do Painel</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col overflow-y-auto">
        <header className="hidden md:flex bg-card-bg/50 border-b border-card-border py-4 px-6 justify-between items-center">
          <h2 className="text-sm font-bold text-muted uppercase tracking-wider">
            {activeTab === 'DASHBOARD' && 'Visão Geral Financeira'}
            {activeTab === 'KITCHEN' && 'Pedidos da Chapa'}
            {activeTab === 'PRODUCTS' && 'Gerenciamento do Cardápio'}
            {activeTab === 'NEIGHBORHOODS' && 'Taxas de Entrega por Bairro'}
            {activeTab === 'SETTINGS' && 'Configurações da Loja'}
          </h2>
          <div className="flex items-center gap-3">
            {/* Toggle Rápido de Status da Loja */}
            <button
              onClick={() => {
                const newVal = !storeSettings.isForceClose;
                setStoreSettings(prev => ({ ...prev, isForceClose: newVal }));
                fetch('/api/admin/settings', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ isForceClose: newVal }),
                });
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                storeSettings.isForceClose
                  ? 'bg-red-950/30 border-red-500/40 text-red-400 hover:bg-red-950/50'
                  : 'bg-success/10 border-success/30 text-success hover:bg-success/20'
              }`}
            >
              {storeSettings.isForceClose ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
              <span>{storeSettings.isForceClose ? 'LOJA FECHADA' : 'LOJA ABERTA'}</span>
            </button>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted">
              <div className="w-2 h-2 rounded-full bg-success animate-ping"></div>
              <span>Conectado à nuvem</span>
            </div>
          </div>
        </header>

        <main className={`p-6 w-full mx-auto transition-all duration-300 ${activeTab === 'KITCHEN' ? 'max-w-7xl' : 'max-w-5xl'}`}>
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'DASHBOARD' && dashboardData && (
            <div className="space-y-6 animate-fadeIn">
              {/* Cards Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-card-bg border border-card-border rounded-xl p-5 shadow-lg flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs text-muted font-semibold uppercase tracking-wider">Faturamento Total</span>
                    <h3 className="text-2xl font-black text-white">R$ {dashboardData.metrics.totalRevenue.toFixed(2)}</h3>
                  </div>
                  <div className="p-3 bg-primary/10 text-primary rounded-xl border border-primary/20">
                    <DollarSign size={24} />
                  </div>
                </div>

                <div className="bg-card-bg border border-card-border rounded-xl p-5 shadow-lg flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs text-muted font-semibold uppercase tracking-wider">Pedidos Concluídos</span>
                    <h3 className="text-2xl font-black text-white">{dashboardData.metrics.totalOrders}</h3>
                  </div>
                  <div className="p-3 bg-accent/10 text-accent rounded-xl border border-accent/20">
                    <ShoppingBag size={24} />
                  </div>
                </div>

                <div className="bg-card-bg border border-card-border rounded-xl p-5 shadow-lg flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs text-muted font-semibold uppercase tracking-wider">Ticket Médio</span>
                    <h3 className="text-2xl font-black text-white">R$ {dashboardData.metrics.ticketMedio.toFixed(2)}</h3>
                  </div>
                  <div className="p-3 bg-success/10 text-success rounded-xl border border-success/20">
                    <TrendingUp size={24} />
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-card-bg border border-card-border rounded-2xl p-5 shadow-lg">
                <h3 className="font-extrabold text-base text-white mb-4">Vendas nos Últimos 15 Dias</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={dashboardData.chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#29221f" vertical={false} />
                      <XAxis dataKey="date" stroke="#a8a29e" fontSize={10} tickLine={false} />
                      <YAxis stroke="#a8a29e" fontSize={10} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#181413', borderColor: '#29221f', borderRadius: '8px', color: '#f5f5f4' }} 
                        labelStyle={{ fontWeight: 'bold', color: '#ef4444' }}
                      />
                      <Area type="monotone" dataKey="faturamento" name="Faturamento (R$)" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorFaturamento)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Orders List */}
              <div className="bg-card-bg border border-card-border rounded-2xl p-5 shadow-lg">
                <h3 className="font-extrabold text-base text-white mb-4">Histórico Recente de Pedidos</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-card-border text-muted pb-3">
                        <th className="py-3 font-bold uppercase">ID</th>
                        <th className="py-3 font-bold uppercase">Cliente</th>
                        <th className="py-3 font-bold uppercase">Itens</th>
                        <th className="py-3 font-bold uppercase">Total</th>
                        <th className="py-3 font-bold uppercase">Pagamento</th>
                        <th className="py-3 font-bold uppercase">Preparo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-card-border/50 text-stone-200">
                      {dashboardData.recentOrders.map(o => (
                        <tr key={o.id} className="hover:bg-stone-900/30 transition-all">
                          <td className="py-3.5 font-mono">#{o.id.slice(-6).toUpperCase()}</td>
                          <td className="py-3.5">
                            <p className="font-bold">{o.clientName}</p>
                            <p className="text-[10px] text-muted">{o.clientPhone}</p>
                          </td>
                          <td className="py-3.5">
                            {o.items.map((item, idx) => (
                              <span key={idx} className="block text-[11px]">
                                {item.quantity}x {item.productName}
                              </span>
                            ))}
                          </td>
                          <td className="py-3.5 font-bold text-white">R$ {parseFloat(o.total).toFixed(2)}</td>
                          <td className="py-3.5">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase border ${
                              o.paymentStatus === 'PAID' 
                                ? 'bg-success/15 border-success/30 text-success' 
                                : 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                            }`}>
                              {o.paymentStatus === 'PAID' ? 'Pago' : 'Pendente'}
                            </span>
                          </td>
                          <td className="py-3.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                              o.orderStatus === 'RECEIVED' ? 'bg-blue-600/20 text-blue-400' :
                              o.orderStatus === 'PREPARING' ? 'bg-accent/20 text-accent' :
                              o.orderStatus === 'READY' ? 'bg-purple-600/20 text-purple-400' :
                              'bg-stone-800 text-stone-400'
                            }`}>
                              {o.orderStatus === 'RECEIVED' && 'Recebido'}
                              {o.orderStatus === 'PREPARING' && 'Preparando'}
                              {o.orderStatus === 'READY' && 'Pronto'}
                              {o.orderStatus === 'DELIVERED' && 'Entregue'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KITCHEN VIEW */}
          {activeTab === 'KITCHEN' && dashboardData && (
            <div className="space-y-6 animate-fadeIn">

              {/* 🏕️ Painel Motoboy */}
              {dashboardData.recentOrders.some(o => o.deliveryType === 'DELIVERY' && (o.orderStatus === 'RECEIVED' || o.orderStatus === 'PREPARING' || o.orderStatus === 'READY' || o.orderStatus === 'DISPATCHED')) && (
                <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Truck size={18} className="text-amber-400" />
                    <h3 className="font-black text-sm text-amber-300 uppercase tracking-wider">Entregas para Motoboy</h3>
                    <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-500/30">
                      {dashboardData.recentOrders.filter(o => o.deliveryType === 'DELIVERY' && o.orderStatus !== 'DELIVERED').length} ativas
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {dashboardData.recentOrders
                      .filter(o => o.deliveryType === 'DELIVERY' && o.orderStatus !== 'DELIVERED')
                      .map(order => (
                        <div key={order.id} className="bg-card-bg border border-amber-500/20 rounded-xl p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-black text-sm text-white">{order.clientName}</p>
                              <p className="text-[10px] text-stone-500 font-mono">#{order.id.slice(-6).toUpperCase()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-stone-500 uppercase tracking-wide">Taxa Motoboy</p>
                              <p className="text-xl font-black text-amber-400">R$ {parseFloat(order.deliveryFee).toFixed(2).replace('.', ',')}</p>
                            </div>
                          </div>
                          <div className="bg-stone-950/60 rounded-lg p-2.5 text-[11px] text-stone-300 space-y-1">
                            <p className="font-bold">{order.addressStreet}, {order.addressNumber}</p>
                            <p className="text-stone-500">{order.neighborhoodName}</p>
                            {order.addressReference && <p className="text-stone-600 italic text-[10px]">Ref: {order.addressReference}</p>}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                              order.orderStatus === 'RECEIVED' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                              order.orderStatus === 'PREPARING' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                              order.orderStatus === 'READY' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                              'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            }`}>
                              {order.orderStatus === 'RECEIVED' ? 'Aguardando' :
                               order.orderStatus === 'PREPARING' ? 'Na chapa' :
                               order.orderStatus === 'READY' ? 'Pronto p/ sair' : 'Em rota'}
                            </span>
                            <a
                              href={`https://wa.me/55${order.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${order.clientName}! Seu pedido #${order.id.slice(-6).toUpperCase()} está a caminho! 📦🌭`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-bold text-success border border-success/30 px-2.5 py-1 rounded-lg hover:bg-success/10 transition-all"
                            >
                              WhatsApp 💬
                            </a>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Col 1: Recebidos (Aguardando Preparo) */}
                <div className="bg-stone-950/40 border border-card-border/60 rounded-2xl p-4 min-h-[75vh] flex flex-col space-y-4 shadow-inner">
                  {/* Header */}
                  <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                      </span>
                      <h3 className="font-black text-xs text-blue-400 uppercase tracking-wider">Novos Recebidos</h3>
                    </div>
                    <span className="bg-blue-500/20 text-blue-300 font-mono text-xs px-2.5 py-1 rounded-full border border-blue-500/30">
                      {dashboardData.recentOrders.filter(o => o.orderStatus === 'RECEIVED').length}
                    </span>
                  </div>

                  {/* Card Container */}
                  <div className="space-y-3.5 overflow-y-auto flex-1 max-h-[70vh] pr-1">
                    {dashboardData.recentOrders
                      .filter(o => o.orderStatus === 'RECEIVED')
                      .map(order => (
                        <div key={order.id} className="bg-card-bg border border-card-border/80 rounded-2xl p-4 shadow-xl space-y-4 hover:border-blue-500/50 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
                          {/* Card Top */}
                          <div className="flex justify-between items-start border-b border-card-border/60 pb-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-sm text-stone-100">{order.clientName}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                  order.deliveryType === 'DELIVERY'
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                    : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                                }`}>
                                  {order.deliveryType === 'DELIVERY' ? 'Motoboy 🏍️' : 'Balcão 📦'}
                                </span>
                              </div>
                              <span className="font-mono text-[10px] text-stone-500 mt-1 block">
                                ID: #{order.id.slice(-6).toUpperCase()} • {getElapsedTime(order.createdAt)}
                              </span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${
                              order.paymentStatus === 'PAID' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse'
                            }`}>
                              {order.paymentStatus === 'PAID' ? 'Pago' : 'Pendente'}
                            </span>
                          </div>

                          {/* Item list */}
                          <div className="space-y-2 py-1">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-stone-900/60 p-2.5 rounded-xl border border-card-border/40 hover:bg-stone-900 transition-colors">
                                <span className="font-bold text-xs text-stone-200">{item.productName}</span>
                                <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md text-[11px] font-black">
                                  {item.quantity}x
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Observation / Note */}
                          {order.notes && (
                            <div className="bg-amber-500/5 border-l-4 border-amber-500 p-3 rounded-r-xl flex gap-2 items-start text-amber-200">
                              <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-amber-500 animate-pulse" />
                              <div className="text-[11px] leading-relaxed">
                                <span className="font-black text-amber-400 uppercase tracking-wider text-[9px] block mb-0.5">Observação Especial</span>
                                {order.notes}
                              </div>
                            </div>
                          )}

                          {/* Delivery Address block */}
                          {order.deliveryType === 'DELIVERY' && (
                            <div className="bg-stone-950/80 p-3 rounded-xl border border-card-border/40 text-[10px] text-stone-400 space-y-1">
                              <div className="flex items-center gap-1 font-extrabold text-stone-300 uppercase tracking-wider text-[9px]">
                                <MapPin size={11} className="text-primary animate-pulse" />
                                <span>Endereço de Entrega</span>
                              </div>
                              <p className="font-bold text-stone-100">{order.addressStreet}, {order.addressNumber}</p>
                              <p className="text-stone-300">Bairro: <span className="font-semibold">{order.neighborhoodName}</span></p>
                              {order.addressReference && (
                                <p className="text-[9px] text-stone-500 italic">Ponto de Ref: {order.addressReference}</p>
                              )}
                            </div>
                          )}

                          {/* Card bottom actions */}
                          <div className="flex gap-2 pt-2 border-t border-card-border/40">
                            {order.paymentStatus !== 'PAID' && (
                              <button
                                onClick={() => handleUpdateOrderPayment(order.id, 'PAID')}
                                className="flex-1 py-2.5 bg-stone-900 border border-card-border hover:border-green-500 text-green-400 hover:text-green-300 rounded-xl font-bold text-xs cursor-pointer transition-all uppercase tracking-wider"
                              >
                                Pagar
                              </button>
                            )}
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'PREPARING')}
                              className="flex-grow py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-black text-xs cursor-pointer transition-all uppercase tracking-wider shadow-md hover:shadow-primary/20"
                            >
                              Mandar pra Chapa ⚙️
                            </button>
                          </div>
                        </div>
                      ))}
                    
                    {dashboardData.recentOrders.filter(o => o.orderStatus === 'RECEIVED').length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-card-border/40 rounded-xl bg-stone-900/10">
                        <ShoppingBag className="text-stone-700 mb-3" size={32} />
                        <h4 className="font-extrabold text-stone-400 text-xs uppercase tracking-wider">Fila Vazia</h4>
                        <p className="text-[10px] text-stone-500 mt-1 max-w-[200px]">Nenhum pedido novo aguardando chapa.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Col 2: Em Preparação (Na Chapa) */}
                <div className="bg-stone-950/40 border border-card-border/60 rounded-2xl p-4 min-h-[75vh] flex flex-col space-y-4 shadow-inner">
                  {/* Header */}
                  <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                      </span>
                      <h3 className="font-black text-xs text-amber-400 uppercase tracking-wider">Na Chapa (Preparando)</h3>
                    </div>
                    <span className="bg-amber-500/20 text-amber-300 font-mono text-xs px-2.5 py-1 rounded-full border border-amber-500/30 animate-pulse">
                      {dashboardData.recentOrders.filter(o => o.orderStatus === 'PREPARING').length}
                    </span>
                  </div>

                  {/* Card Container */}
                  <div className="space-y-3.5 overflow-y-auto flex-1 max-h-[70vh] pr-1">
                    {dashboardData.recentOrders
                      .filter(o => o.orderStatus === 'PREPARING')
                      .map(order => (
                        <div key={order.id} className="bg-card-bg border border-card-border/80 rounded-2xl p-4 shadow-xl space-y-4 hover:border-amber-500/50 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
                          {/* Card Top */}
                          <div className="flex justify-between items-start border-b border-card-border/60 pb-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-sm text-stone-100">{order.clientName}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                  order.deliveryType === 'DELIVERY'
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                    : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                                }`}>
                                  {order.deliveryType === 'DELIVERY' ? 'Motoboy 🏍️' : 'Balcão 📦'}
                                </span>
                              </div>
                              <span className="font-mono text-[10px] text-stone-500 mt-1 block">
                                ID: #{order.id.slice(-6).toUpperCase()} • {getElapsedTime(order.createdAt)}
                              </span>
                            </div>
                            
                            <button
                              onClick={() => handleRePrintOrder(order.id)}
                              className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white border border-card-border/60 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                            >
                              <RefreshCw size={9} />
                              Reimprimir
                            </button>
                          </div>

                          {/* Item list */}
                          <div className="space-y-2 py-1">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-stone-900/60 p-2.5 rounded-xl border border-card-border/40 hover:bg-stone-900 transition-colors">
                                <span className="font-bold text-xs text-stone-200">{item.productName}</span>
                                <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md text-[11px] font-black">
                                  {item.quantity}x
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Observation / Note */}
                          {order.notes && (
                            <div className="bg-amber-500/5 border-l-4 border-amber-500 p-3 rounded-r-xl flex gap-2 items-start text-amber-200">
                              <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-amber-500 animate-pulse" />
                              <div className="text-[11px] leading-relaxed">
                                <span className="font-black text-amber-400 uppercase tracking-wider text-[9px] block mb-0.5">Observação Especial</span>
                                {order.notes}
                              </div>
                            </div>
                          )}

                          {/* Delivery Address block */}
                          {order.deliveryType === 'DELIVERY' && (
                            <div className="bg-stone-950/80 p-3 rounded-xl border border-card-border/40 text-[10px] text-stone-400 space-y-1">
                              <div className="flex items-center gap-1 font-extrabold text-stone-300 uppercase tracking-wider text-[9px]">
                                <MapPin size={11} className="text-primary animate-pulse" />
                                <span>Endereço de Entrega</span>
                              </div>
                              <p className="font-bold text-stone-100">{order.addressStreet}, {order.addressNumber}</p>
                              <p className="text-stone-300">Bairro: <span className="font-semibold">{order.neighborhoodName}</span></p>
                              {order.addressReference && (
                                <p className="text-[9px] text-stone-500 italic">Ponto de Ref: {order.addressReference}</p>
                              )}
                            </div>
                          )}

                          {/* Card bottom action */}
                          <div className="pt-2 border-t border-card-border/40">
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'READY')}
                              className="w-full py-2.5 bg-accent hover:bg-accent-hover text-stone-950 rounded-xl font-black text-xs cursor-pointer transition-all uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5"
                            >
                              <ChefHat size={14} />
                              Pronto p/ Saída ✔️
                            </button>
                          </div>
                        </div>
                      ))}
                    
                    {dashboardData.recentOrders.filter(o => o.orderStatus === 'PREPARING').length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-card-border/40 rounded-xl bg-stone-900/10">
                        <ChefHat className="text-stone-700 mb-3" size={32} />
                        <h4 className="font-extrabold text-stone-400 text-xs uppercase tracking-wider">Chapa Vazia</h4>
                        <p className="text-[10px] text-stone-500 mt-1 max-w-[200px]">Nenhum hotdog na chapa nesse momento.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Col 3: Pronto (Aguardando Entrega/Retirada) */}
                <div className="bg-stone-950/40 border border-card-border/60 rounded-2xl p-4 min-h-[75vh] flex flex-col space-y-4 shadow-inner">
                  {/* Header */}
                  <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="h-3 w-3 rounded-full bg-green-500 inline-block animate-pulse"></span>
                      <h3 className="font-black text-xs text-green-400 uppercase tracking-wider">Prontos p/ Saída</h3>
                    </div>
                    <span className="bg-green-500/20 text-green-300 font-mono text-xs px-2.5 py-1 rounded-full border border-green-500/30">
                      {dashboardData.recentOrders.filter(o => o.orderStatus === 'READY').length}
                    </span>
                  </div>

                  {/* Card Container */}
                  <div className="space-y-3.5 overflow-y-auto flex-1 max-h-[70vh] pr-1">
                    {dashboardData.recentOrders
                      .filter(o => o.orderStatus === 'READY')
                      .map(order => (
                        <div key={order.id} className="bg-card-bg border border-card-border/80 rounded-2xl p-4 shadow-xl space-y-4 hover:border-green-500/50 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
                          {/* Card Top */}
                          <div className="flex justify-between items-start border-b border-card-border/60 pb-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-sm text-stone-100">{order.clientName}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                  order.deliveryType === 'DELIVERY'
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                    : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                                }`}>
                                  {order.deliveryType === 'DELIVERY' ? 'Motoboy 🏍️' : 'Balcão 📦'}
                                </span>
                              </div>
                              <span className="font-mono text-[10px] text-stone-500 mt-1 block">
                                ID: #{order.id.slice(-6).toUpperCase()} • {getElapsedTime(order.createdAt)}
                              </span>
                            </div>
                            <span className="text-[10px] text-stone-400 font-bold bg-stone-900 px-2 py-1 rounded border border-card-border/60">{order.clientPhone}</span>
                          </div>

                          {/* Item list */}
                          <div className="space-y-2 py-1">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-stone-900/60 p-2.5 rounded-xl border border-card-border/40 hover:bg-stone-900 transition-colors">
                                <span className="font-bold text-xs text-stone-300">{item.productName}</span>
                                <span className="bg-stone-850 text-stone-400 border border-card-border/60 px-2 py-0.5 rounded-md text-[11px] font-bold">
                                  {item.quantity}x
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Delivery Address block */}
                          {order.deliveryType === 'DELIVERY' && (
                            <div className="bg-stone-950/80 p-3 rounded-xl border border-card-border/40 text-[10px] text-stone-400 space-y-1">
                              <div className="flex items-center gap-1 font-extrabold text-stone-300 uppercase tracking-wider text-[9px]">
                                <MapPin size={11} className="text-primary animate-pulse" />
                                <span>Endereço de Entrega</span>
                              </div>
                              <p className="font-bold text-stone-100">{order.addressStreet}, {order.addressNumber}</p>
                              <p className="text-stone-300">Bairro: <span className="font-semibold">{order.neighborhoodName}</span></p>
                              {order.addressReference && (
                                <p className="text-[9px] text-stone-500 italic">Ponto de Ref: {order.addressReference}</p>
                              )}
                            </div>
                          )}

                          {/* Card bottom action */}
                          <div className="pt-2 border-t border-card-border/40">
                            {order.deliveryType === 'DELIVERY' ? (
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'DISPATCHED')}
                                className="w-full py-2.5 bg-success hover:bg-green-600 text-white rounded-xl font-black text-xs cursor-pointer transition-all uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5"
                              >
                                <Truck size={14} />
                                Despachar Motoboy 🏍️
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'DELIVERED')}
                                className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black text-xs cursor-pointer transition-all uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5"
                              >
                                <ShoppingBag size={14} />
                                Entregar Lanche 📦
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    
                    {dashboardData.recentOrders.filter(o => o.orderStatus === 'READY').length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-card-border/40 rounded-xl bg-stone-900/10">
                        <Truck className="text-stone-700 mb-3" size={32} />
                        <h4 className="font-extrabold text-stone-400 text-xs uppercase tracking-wider">Nenhum Pronto</h4>
                        <p className="text-[10px] text-stone-500 mt-1 max-w-[200px]">Nenhum pedido aguardando entrega ou retirada.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Col 4: Em Trânsito (Motoboy na rua) */}
                <div className="bg-stone-950/40 border border-card-border/60 rounded-2xl p-4 min-h-[75vh] flex flex-col space-y-4 shadow-inner">
                  {/* Header */}
                  <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                      </span>
                      <h3 className="font-black text-xs text-purple-400 uppercase tracking-wider">Em Trânsito 🏍️</h3>
                    </div>
                    <span className="bg-purple-500/20 text-purple-300 font-mono text-xs px-2.5 py-1 rounded-full border border-purple-500/30">
                      {dashboardData.recentOrders.filter(o => o.orderStatus === 'DISPATCHED').length}
                    </span>
                  </div>

                  {/* Card Container */}
                  <div className="space-y-3.5 overflow-y-auto flex-1 max-h-[70vh] pr-1">
                    {dashboardData.recentOrders
                      .filter(o => o.orderStatus === 'DISPATCHED')
                      .map(order => (
                        <div key={order.id} className="bg-card-bg border border-card-border/80 rounded-2xl p-4 shadow-xl space-y-4 hover:border-purple-500/50 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
                          {/* Card Top */}
                          <div className="flex justify-between items-start border-b border-card-border/60 pb-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-sm text-stone-100">{order.clientName}</span>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase border bg-purple-500/10 border-purple-500/20 text-purple-400">
                                  Motoboy 🏍️
                                </span>
                              </div>
                              <span className="font-mono text-[10px] text-stone-500 mt-1 block">
                                ID: #{order.id.slice(-6).toUpperCase()} • {getElapsedTime(order.createdAt)}
                              </span>
                            </div>
                            <span className="text-[10px] text-stone-400 font-bold bg-stone-900 px-2 py-1 rounded border border-card-border/60">{order.clientPhone}</span>
                          </div>

                          {/* Item list */}
                          <div className="space-y-2 py-1">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-stone-900/60 p-2.5 rounded-xl border border-card-border/40 hover:bg-stone-900 transition-colors">
                                <span className="font-bold text-xs text-stone-300">{item.productName}</span>
                                <span className="bg-stone-850 text-stone-400 border border-card-border/60 px-2 py-0.5 rounded-md text-[11px] font-bold">
                                  {item.quantity}x
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Delivery Address block */}
                          {order.addressStreet && (
                            <div className="bg-stone-950/80 p-3 rounded-xl border border-card-border/40 text-[10px] text-stone-400 space-y-1">
                              <div className="flex items-center gap-1 font-extrabold text-stone-300 uppercase tracking-wider text-[9px]">
                                <MapPin size={11} className="text-primary animate-pulse" />
                                <span>Endereço de Entrega</span>
                              </div>
                              <p className="font-bold text-stone-100">{order.addressStreet}, {order.addressNumber}</p>
                              <p className="text-stone-300">Bairro: <span className="font-semibold">{order.neighborhoodName}</span></p>
                            </div>
                          )}

                          {/* Card bottom action */}
                          <div className="pt-2 border-t border-card-border/40">
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'DELIVERED')}
                              className="w-full py-2.5 bg-success hover:bg-green-600 text-white rounded-xl font-black text-xs cursor-pointer transition-all uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5"
                            >
                              <Check size={14} />
                              Confirmar Entrega ✔️
                            </button>
                          </div>
                        </div>
                      ))}
                    
                    {dashboardData.recentOrders.filter(o => o.orderStatus === 'DISPATCHED').length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-card-border/40 rounded-xl bg-stone-900/10">
                        <Truck className="text-stone-700 mb-3" size={32} />
                        <h4 className="font-extrabold text-stone-400 text-xs uppercase tracking-wider">Nenhum em Rota</h4>
                        <p className="text-[10px] text-stone-500 mt-1 max-w-[200px]">Nenhum motoboy em rota no momento.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 5: SETTINGS */}
          {activeTab === 'SETTINGS' && (
            <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">

              {/* Save bar */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white">Configurações da Loja</h3>
                <div className="flex items-center gap-3">
                  {settingsSaved && (
                    <span className="text-success text-xs font-bold flex items-center gap-1">
                      <Check size={14} /> Salvo com sucesso!
                    </span>
                  )}
                  {settingsError && <span className="text-red-400 text-xs font-bold">{settingsError}</span>}
                  <button
                    onClick={handleSaveSettings}
                    disabled={settingsSaving}
                    className="bg-primary hover:bg-primary-hover disabled:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-pointer transition-all shadow-lg uppercase"
                  >
                    {settingsSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
                    Salvar Tudo
                  </button>
                </div>
              </div>

              {/* Status da Loja */}
              <div className="bg-card-bg border border-card-border rounded-2xl p-6 space-y-4">
                <h4 className="font-black text-sm text-white uppercase tracking-wider flex items-center gap-2">
                  <Store size={16} className="text-primary" /> Status da Loja
                </h4>

                <div className="flex items-center justify-between bg-stone-950 border border-card-border rounded-xl p-4">
                  <div>
                    <p className="font-bold text-sm text-white">Fechar a loja agora</p>
                    <p className="text-xs text-stone-500 mt-0.5">Bloqueia novos pedidos imediatamente, independente do horário</p>
                  </div>
                  <button
                    onClick={() => setStoreSettings(prev => ({ ...prev, isForceClose: !prev.isForceClose }))}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-black transition-all cursor-pointer ${
                      storeSettings.isForceClose
                        ? 'bg-red-950/40 border-red-500/40 text-red-400'
                        : 'bg-success/10 border-success/30 text-success'
                    }`}
                  >
                    {storeSettings.isForceClose
                      ? <><ToggleLeft size={20} /> FECHADO</>
                      : <><ToggleRight size={20} /> ABERTO</>}
                  </button>
                </div>
              </div>

              {/* Horário de Funcionamento */}
              <div className="bg-card-bg border border-card-border rounded-2xl p-6 space-y-5">
                <h4 className="font-black text-sm text-white uppercase tracking-wider flex items-center gap-2">
                  <Clock size={16} className="text-primary" /> Horário de Funcionamento
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-400">Abertura</label>
                    <input
                      type="time"
                      value={storeSettings.openTime}
                      onChange={e => setStoreSettings(prev => ({ ...prev, openTime: e.target.value }))}
                      className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-400">Fechamento</label>
                    <input
                      type="time"
                      value={storeSettings.closeTime}
                      onChange={e => setStoreSettings(prev => ({ ...prev, closeTime: e.target.value }))}
                      className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-400">Dias abertos</label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_LABELS.map((label, idx) => {
                      const active = storeSettings.openDays.split(',').filter(Boolean).map(Number).includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleDay(idx)}
                          className={`px-4 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                            active
                              ? 'bg-primary border-primary text-white shadow-[0_2px_8px_rgba(239,68,68,0.3)]'
                              : 'bg-stone-950 border-card-border text-stone-500 hover:border-stone-600'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-400">Tempo estimado de entrega (minutos)</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={storeSettings.estimatedDeliveryTime}
                    onChange={e => setStoreSettings(prev => ({ ...prev, estimatedDeliveryTime: parseInt(e.target.value) || 40 }))}
                    className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Entrega */}
              <div className="bg-card-bg border border-card-border rounded-2xl p-6 space-y-5">
                <h4 className="font-black text-sm text-white uppercase tracking-wider flex items-center gap-2">
                  <Truck size={16} className="text-primary" /> Configurações de Entrega
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between bg-stone-950 border border-card-border rounded-xl p-4">
                    <div>
                      <p className="font-bold text-sm text-white">Delivery</p>
                      <p className="text-[11px] text-stone-500">Entrega em casa</p>
                    </div>
                    <button
                      onClick={() => setStoreSettings(prev => ({ ...prev, deliveryEnabled: !prev.deliveryEnabled }))}
                      className={`text-xl transition-all cursor-pointer ${storeSettings.deliveryEnabled ? 'text-success' : 'text-stone-600'}`}
                    >
                      {storeSettings.deliveryEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between bg-stone-950 border border-card-border rounded-xl p-4">
                    <div>
                      <p className="font-bold text-sm text-white">Retirada</p>
                      <p className="text-[11px] text-stone-500">Balcão</p>
                    </div>
                    <button
                      onClick={() => setStoreSettings(prev => ({ ...prev, withdrawalEnabled: !prev.withdrawalEnabled }))}
                      className={`text-xl transition-all cursor-pointer ${storeSettings.withdrawalEnabled ? 'text-success' : 'text-stone-600'}`}
                    >
                      {storeSettings.withdrawalEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-400">Taxa base (R$)</label>
                    <input
                      type="number" step="0.50" min="0"
                      value={storeSettings.deliveryBaseFee}
                      onChange={e => setStoreSettings(prev => ({ ...prev, deliveryBaseFee: e.target.value }))}
                      className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-400">Valor por km (R$)</label>
                    <input
                      type="number" step="0.25" min="0"
                      value={storeSettings.deliveryFeePerKm}
                      onChange={e => setStoreSettings(prev => ({ ...prev, deliveryFeePerKm: e.target.value }))}
                      className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-400">Distância máx (km)</label>
                    <input
                      type="number" step="1" min="1"
                      value={storeSettings.deliveryMaxDistanceKm}
                      onChange={e => setStoreSettings(prev => ({ ...prev, deliveryMaxDistanceKm: e.target.value }))}
                      className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Dados da Loja */}
              <div className="bg-card-bg border border-card-border rounded-2xl p-6 space-y-4">
                <h4 className="font-black text-sm text-white uppercase tracking-wider flex items-center gap-2">
                  <MapPin size={16} className="text-primary" /> Dados da Loja
                </h4>
                {[
                  { key: 'storeName', label: 'Nome da Loja', placeholder: 'Oh my Dog!' },
                  { key: 'storePhone', label: 'WhatsApp / Telefone', placeholder: '(11) 99999-9999' },
                  { key: 'storeAddress', label: 'Endereço Completo', placeholder: 'R. Exemplo, 123 - Bragança Paulista' },
                  { key: 'storeInstagram', label: 'Instagram', placeholder: '@ohmydog' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-400">{label}</label>
                    <input
                      type="text"
                      placeholder={placeholder}
                      value={(storeSettings as any)[key]}
                      onChange={e => setStoreSettings(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                ))}
              </div>

              {/* Save button bottom */}
              <div className="flex justify-end pb-8">
                <button
                  onClick={handleSaveSettings}
                  disabled={settingsSaving}
                  className="bg-primary hover:bg-primary-hover disabled:bg-stone-800 text-white px-8 py-3 rounded-xl text-sm font-extrabold flex items-center gap-2 cursor-pointer transition-all shadow-lg uppercase"
                >
                  {settingsSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
                  Salvar Configurações
                </button>
              </div>

            </div>
          )}

          {/* TAB 3: PRODUCTS MANAGEMENT */}
          {activeTab === 'PRODUCTS' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold text-lg text-white">Cardápio do Oh my Dog</h3>
                <button
                  onClick={openNewProductModal}
                  className="bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-lg uppercase"
                >
                  <Plus size={16} />
                  Adicionar Item
                </button>
              </div>

              {/* Product list grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map(product => {
                  const hasPromo = product.promotionalPrice !== null;
                  return (
                    <div 
                      key={product.id} 
                      className={`bg-card-bg border rounded-xl p-4 flex gap-4 hover:border-stone-700 transition-all ${
                        product.active ? 'border-card-border' : 'border-stone-900 opacity-60'
                      }`}
                    >
                      <div className="w-20 h-20 bg-stone-950 rounded-lg overflow-hidden border border-card-border flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={product.imageUrl || '/placeholder.png'} 
                          alt={product.name} 
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-grow flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-stone-150">{product.name}</h4>
                            <span className="text-[9px] bg-stone-900 text-stone-400 font-extrabold uppercase px-2 py-0.5 rounded border border-card-border">
                              {product.category}
                            </span>
                          </div>
                          <p className="text-xs text-muted line-clamp-2 mt-0.5">{product.description}</p>
                        </div>

                        <div className="flex justify-between items-center mt-2.5">
                          <div className="flex items-baseline gap-1.5">
                            {hasPromo ? (
                              <>
                                <span className="text-sm font-black text-white">R$ {parseFloat(product.promotionalPrice!).toFixed(2)}</span>
                                <span className="text-[10px] text-muted line-through">R$ {parseFloat(product.price).toFixed(2)}</span>
                              </>
                            ) : (
                              <span className="text-sm font-black text-white">R$ {parseFloat(product.price).toFixed(2)}</span>
                            )}
                          </div>

                          <div className="flex gap-1.5">
                            <button
                              onClick={() => openEditProductModal(product)}
                              className="p-1.5 rounded-lg bg-stone-900 border border-card-border text-stone-400 hover:text-white"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-1.5 rounded-lg bg-stone-950 border border-card-border text-stone-500 hover:text-red-400"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: TAXAS DE ENTREGA */}
          {activeTab === 'NEIGHBORHOODS' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold text-lg text-white">Taxas de Entrega por Bairro</h3>
                <button
                  onClick={() => {
                    setNeighborhoodForm({ id: '', name: '', deliveryFee: '', active: true });
                    setEditingNeighborhood(null);
                    setIsNeighborhoodModalOpen(true);
                  }}
                  className="bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-lg uppercase"
                >
                  <Plus size={16} />
                  Adicionar Bairro
                </button>
              </div>

              <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden shadow-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-card-border text-muted bg-stone-950/40">
                      <th className="p-4 font-bold uppercase">Bairro</th>
                      <th className="p-4 font-bold uppercase">Taxa de Entrega</th>
                      <th className="p-4 font-bold uppercase">Status</th>
                      <th className="p-4 font-bold uppercase text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border text-stone-200">
                    {neighborhoods.map(n => (
                      <tr key={n.id} className="hover:bg-stone-900/20 transition-all">
                        <td className="p-4 font-bold text-stone-150">{n.name}</td>
                        <td className="p-4 font-extrabold text-white">R$ {parseFloat(n.deliveryFee).toFixed(2)}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                            n.active ? 'bg-success/15 border border-success/30 text-success' : 'bg-stone-850 border border-stone-850 text-stone-500'
                          }`}>
                            {n.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-1.5">
                          <button
                            onClick={() => {
                              setNeighborhoodForm({
                                id: n.id,
                                name: n.name,
                                deliveryFee: n.deliveryFee,
                                active: n.active
                              });
                              setEditingNeighborhood(n);
                              setIsNeighborhoodModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-stone-900 border border-card-border text-stone-400 hover:text-white inline-flex"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteNeighborhood(n.id)}
                            className="p-1.5 rounded-lg bg-stone-950 border border-card-border text-stone-500 hover:text-red-400 inline-flex"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {neighborhoods.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted">Nenhum bairro cadastrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Product Add/Edit Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-card-bg border border-card-border rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-card-border flex justify-between items-center">
              <h3 className="font-extrabold text-base text-white">
                {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Item'}
              </h3>
              <button 
                onClick={() => setIsProductModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-bold text-stone-300">Nome do Item *</label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={e => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Oh My Bacon Dog"
                    className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-stone-600"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-bold text-stone-300">Ingredientes / Descrição *</label>
                  <textarea
                    required
                    rows={3}
                    value={productForm.description}
                    onChange={e => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Ex: Pão de brioche, salsicha artesanal envolta em bacon..."
                    className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-stone-600 resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-300">Preço Padrão (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.price}
                    onChange={e => setProductForm(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="25.90"
                    className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-stone-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-300">Preço Promocional (Opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={productForm.promotionalPrice}
                    onChange={e => setProductForm(prev => ({ ...prev, promotionalPrice: e.target.value }))}
                    placeholder="19.90"
                    className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-stone-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-300">Categoria *</label>
                  <select
                    value={productForm.category}
                    onChange={e => setProductForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-stone-600 cursor-pointer"
                  >
                    <option value="HOTDOG">🌭 Hot Dog</option>
                    <option value="DRINK">🥤 Bebida</option>
                    <option value="PORTION">🍟 Acompanhamento</option>
                  </select>
                </div>

                <div className="space-y-1.5 flex items-center justify-between pl-2">
                  <span className="text-xs font-bold text-stone-300">Status Ativo</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.active}
                      onChange={e => setProductForm(prev => ({ ...prev, active: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-stone-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-stone-500 peer-checked:after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-success"></div>
                  </label>
                </div>

                {/* Photo Upload */}
                <div className="space-y-2 col-span-2">
                  <label className="text-xs font-bold text-stone-300 block">Foto do Produto</label>
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 bg-stone-950 border border-card-border rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center text-stone-600 text-xs">
                      {productForm.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={productForm.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <span>Sem Foto</span>
                      )}
                    </div>
                    
                    <div className="flex-grow">
                      <label className="flex items-center justify-center gap-1.5 bg-stone-900 hover:bg-stone-850 border border-card-border border-dashed text-stone-300 py-3 rounded-xl text-xs font-semibold cursor-pointer transition-all">
                        <Upload size={16} />
                        {uploadingImage ? 'Enviando...' : 'Selecionar Imagem'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                      </label>
                      <p className="text-[10px] text-muted mt-1">Imagens de até 5MB. Se o Supabase não estiver configurado, usaremos fotos de simulação automaticamente.</p>
                    </div>
                  </div>
                </div>
              </div>

              {productError && (
                <div className="bg-red-950/30 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-xs flex gap-2 items-center">
                  <AlertCircle size={16} />
                  <span>{productError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-card-border justify-end">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-5 py-2.5 bg-stone-900 border border-card-border hover:bg-stone-850 rounded-xl text-xs font-bold text-stone-300 transition-all cursor-pointer uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploadingImage}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:bg-stone-800 disabled:text-stone-600 rounded-xl text-xs font-extrabold text-white transition-all cursor-pointer uppercase"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Neighborhood Add/Edit Modal */}
      {isNeighborhoodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card-bg border border-card-border rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-card-border flex justify-between items-center">
              <h3 className="font-extrabold text-base text-white">
                {editingNeighborhood ? 'Editar Bairro' : 'Cadastrar Novo Bairro'}
              </h3>
              <button 
                onClick={() => setIsNeighborhoodModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNeighborhood} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-300">Nome do Bairro *</label>
                <input
                  type="text"
                  required
                  value={neighborhoodForm.name}
                  onChange={e => setNeighborhoodForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Jardim Paulista"
                  className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-stone-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-300">Taxa de Entrega (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={neighborhoodForm.deliveryFee}
                  onChange={e => setNeighborhoodForm(prev => ({ ...prev, deliveryFee: e.target.value }))}
                  placeholder="6.00"
                  className="w-full bg-stone-950 border border-card-border text-stone-100 rounded-xl p-3 text-sm focus:outline-none focus:border-stone-600"
                />
              </div>

              <div className="space-y-1.5 flex items-center justify-between pl-2 pt-2">
                <span className="text-xs font-bold text-stone-300">Status Ativo</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={neighborhoodForm.active}
                    onChange={e => setNeighborhoodForm(prev => ({ ...prev, active: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-stone-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-stone-500 peer-checked:after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-success"></div>
                </label>
              </div>

              {neighborhoodError && (
                <div className="bg-red-950/30 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs flex gap-2 items-center">
                  <AlertCircle size={16} />
                  <span>{neighborhoodError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-card-border justify-end">
                <button
                  type="button"
                  onClick={() => setIsNeighborhoodModalOpen(false)}
                  className="px-5 py-2.5 bg-stone-900 border border-card-border hover:bg-stone-850 rounded-xl text-xs font-bold text-stone-300 transition-all cursor-pointer uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary hover:bg-primary-hover rounded-xl text-xs font-extrabold text-white transition-all cursor-pointer uppercase"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
