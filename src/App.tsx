import { useState, useMemo, useCallback, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  ShoppingBag,
  Search,
  Menu,
  X,
  Star,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Heart,
  ArrowRight,
  Diamond,
  Sparkles,
  RotateCcw,
  Plus,
  Minus,
  Trash2,
  Check,
  Package,
  Truck,
  Clock,
} from 'lucide-react';
import emailjs from '@emailjs/browser';
import {
  jewelryItems,
  categories,
  metals,
  gemstones,
  priceRanges,
  type Category,
  type Metal,
  type Gemstone,
  type SortOption,
  type JewelryItem,
} from './data/jewelry';

// ─── Cart Context ──────────────────────────────────────────────────
interface CartItem {
  item: JewelryItem;
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToBag: (item: JewelryItem) => void;
  removeFromBag: (itemId: number) => void;
  updateQuantity: (itemId: number, delta: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType>({
  cart: [],
  addToBag: () => {},
  removeFromBag: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  cartTotal: 0,
  cartCount: 0,
  cartOpen: false,
  setCartOpen: () => {},
});

function useCart() {
  return useContext(CartContext);
}

// ─── Wishlist Context ──────────────────────────────────────────────
interface WishlistContextType {
  wishlist: JewelryItem[];
  toggleWishlist: (item: JewelryItem) => void;
  isInWishlist: (itemId: number) => boolean;
  wishlistCount: number;
  wishlistOpen: boolean;
  setWishlistOpen: (open: boolean) => void;
}

const WishlistContext = createContext<WishlistContextType>({
  wishlist: [],
  toggleWishlist: () => {},
  isInWishlist: () => false,
  wishlistCount: 0,
  wishlistOpen: false,
  setWishlistOpen: () => {},
});

function useWishlist() {
  return useContext(WishlistContext);
}

// ─── Product Detail Context ────────────────────────────────────────
interface ProductDetailContextType {
  selectedProduct: JewelryItem | null;
  setSelectedProduct: (item: JewelryItem | null) => void;
}

const ProductDetailContext = createContext<ProductDetailContextType>({
  selectedProduct: null,
  setSelectedProduct: () => {},
});

function useProductDetail() {
  return useContext(ProductDetailContext);
}

// ─── Order Context ─────────────────────────────────────────────────
export interface Order {
  id: string;
  items: { name: string; price: number; quantity: number; category: string }[];
  shipping: { firstName: string; lastName: string; email: string; phone: string; address: string; city: string; state: string; zip: string };
  subtotal: number;
  promoCode?: string;
  discount?: number;
  tax: number;
  total: number;
  date: string;
  status: 'confirmed' | 'crafting' | 'shipped' | 'delivered';
  estimatedDelivery: string;
  trackingSteps: { label: string; date: string; done: boolean }[];
}

interface OrderContextType {
  orders: Order[];
  placeOrder: (order: Omit<Order, 'status' | 'estimatedDelivery' | 'trackingSteps'>) => string;
  getOrder: (id: string) => Order | undefined;
}

const OrderContext = createContext<OrderContextType>({
  orders: [],
  placeOrder: () => '',
  getOrder: () => undefined,
});

function useOrders() {
  return useContext(OrderContext);
}

// ─── Scroll to Top on Route Change ─────────────────────────────────
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// ─── Page Components ───────────────────────────────────────────────
function HomePage() {
  return (
    <>
      <Hero />
      <FeatureStrip />
      <TrendingCarousel />
      <Newsletter />
    </>
  );
}

function AboutPage() {
  return <AboutSection />;
}

function CollectionPage() {
  return (
    <>
      <ShopSection />
      <WishlistSection />
    </>
  );
}

function TrackOrderPage() {
  return <TrackOrder />;
}

function ContactPage() {
  return <ContactSection />;
}

// ─── App Layout (inside Router) ────────────────────────────────────
function AppLayout() {
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/collection" element={<CollectionPage />} />
        <Route path="/track" element={<TrackOrderPage />} />
        <Route path="/contact" element={<ContactPage />} />
      </Routes>
      <Footer />
      <CartDrawer />
      <WishlistDrawer />
      <ProductDetailModal />
    </>
  );
}

// ─── Cart Drawer ───────────────────────────────────────────────────
function CartDrawer() {
  const { cart, removeFromBag, updateQuantity, clearCart, cartTotal, cartCount, cartOpen, setCartOpen } = useCart();
  const { placeOrder } = useOrders();
  const [step, setStep] = useState<'bag' | 'shipping' | 'confirm' | 'success'>('bag');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '', city: '', state: '', zip: '' });
  const [lastOrderId, setLastOrderId] = useState('');
  const [lastOrderTotal, setLastOrderTotal] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [promoMessage, setPromoMessage] = useState('');

  const categoryImage: Record<string, string> = {
    Rings: '/images/ring.jpg',
    Necklaces: '/images/necklace.jpg',
    Bracelets: '/images/bracelet.jpg',
    Earrings: '/images/earrings.jpg',
  };

  const handleClose = () => {
    setCartOpen(false);
    if (step === 'success') setStep('bag');
  };

  const handleBack = () => {
    if (step === 'confirm') setStep('shipping');
    else if (step === 'shipping') setStep('bag');
  };

  const shippingCost = 0;
  const promoCodes: Record<string, number> = { VISION10: 0.1 };
  const discount = appliedPromo ? Math.round(cartTotal * promoCodes[appliedPromo]) : 0;
  const discountedSubtotal = Math.max(cartTotal - discount, 0);
  const tax = Math.round(discountedSubtotal * 0.08);
  const grandTotal = discountedSubtotal + shippingCost + tax;

  const handlePlaceOrder = () => {
    const orderId = placeOrder({
      id: '',
      items: cart.map((ci) => ({ name: ci.item.name, price: ci.item.price, quantity: ci.quantity, category: ci.item.category })),
      shipping: form,
      subtotal: cartTotal,
      promoCode: appliedPromo || undefined,
      discount,
      tax,
      total: grandTotal,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    });
    setLastOrderId(orderId);
    setLastOrderTotal(grandTotal);
    setStep('success');
    clearCart();
  };

  const handleApplyPromo = () => {
    const normalized = promoCode.trim().toUpperCase();
    if (promoCodes[normalized]) {
      setAppliedPromo(normalized);
      setPromoCode(normalized);
      setPromoMessage(`${normalized} applied.`);
    } else {
      setAppliedPromo('');
      setPromoMessage('Enter a valid promo code.');
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo('');
    setPromoCode('');
    setPromoMessage('');
  };

  useEffect(() => {
    if (cart.length === 0) handleRemovePromo();
  }, [cart.length]);

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-dark-900/80 backdrop-blur-sm z-[60]"
            onClick={handleClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-dark-800 border-l border-dark-600/30 z-[70] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-dark-600/20">
              <div className="flex items-center gap-3">
                {step !== 'bag' && step !== 'success' && (
                  <button onClick={handleBack} className="text-dark-400 hover:text-gold-500 transition-colors mr-1">
                    <ChevronUp size={18} className="rotate-[-90deg]" />
                  </button>
                )}
                {step === 'bag' && <ShoppingBag size={20} className="text-gold-500" />}
                {step === 'shipping' && <Star size={20} className="text-gold-500" />}
                {step === 'confirm' && <Diamond size={20} className="text-gold-500" />}
                {step === 'success' && <Check size={20} className="text-green-400" />}
                <span className="text-dark-100 text-lg tracking-wider uppercase font-medium font-serif">
                  {step === 'bag' && 'Your Bag'}
                  {step === 'shipping' && 'Shipping'}
                  {step === 'confirm' && 'Review Order'}
                  {step === 'success' && 'Order Placed!'}
                </span>
                {step === 'bag' && cartCount > 0 && (
                  <span className="bg-gold-500 text-dark-900 text-xs w-5 h-5 flex items-center justify-center font-semibold">
                    {cartCount}
                  </span>
                )}
              </div>
              <button onClick={handleClose} className="text-dark-400 hover:text-gold-500 transition-colors">
                <X size={22} />
              </button>
            </div>

            {/* Step indicator */}
            {step !== 'success' && (
              <div className="px-4 sm:px-6 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  {(['bag', 'shipping', 'confirm'] as const).map((s, idx) => (
                    <div key={s} className="flex-1 flex items-center gap-2">
                      <div className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                        step === s ? 'bg-gold-500' :
                        ['bag', 'shipping', 'confirm'].indexOf(step) > idx ? 'bg-gold-500/60' : 'bg-dark-600/30'
                      }`} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className={`text-[9px] tracking-wider uppercase ${step === 'bag' ? 'text-gold-500' : 'text-dark-500'}`}>Bag</span>
                  <span className={`text-[9px] tracking-wider uppercase ${step === 'shipping' ? 'text-gold-500' : 'text-dark-500'}`}>Shipping</span>
                  <span className={`text-[9px] tracking-wider uppercase ${step === 'confirm' ? 'text-gold-500' : 'text-dark-500'}`}>Confirm</span>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* ─── BAG STEP ─── */}
              {step === 'bag' && (
                <>
                  {cart.length === 0 ? (
                    <div className="text-center py-16">
                      <ShoppingBag className="mx-auto text-dark-600 mb-4" size={48} />
                      <p className="text-dark-400 font-serif text-lg mb-2">Your bag is empty</p>
                      <p className="text-dark-600 text-sm">Discover our exquisite collection and add your favorites.</p>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleClose}
                        className="mt-6 bg-gold-500 text-dark-900 px-6 py-3 text-xs tracking-widest uppercase font-semibold hover:bg-gold-400 transition-colors"
                      >
                        Browse Collection
                      </motion.button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <AnimatePresence>
                        {cart.map((cartItem) => (
                          <motion.div
                            key={cartItem.item.id}
                            layout
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                            transition={{ duration: 0.3 }}
                            className="flex gap-3 sm:gap-4 bg-dark-700/30 border border-dark-600/20 p-3"
                          >
                            <div
                              className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 bg-cover bg-center"
                              style={{ backgroundImage: `url(${categoryImage[cartItem.item.category]})` }}
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-dark-100 text-sm font-serif truncate">{cartItem.item.name}</h4>
                              <p className="text-dark-500 text-xs mt-0.5">{cartItem.item.metal} · {cartItem.item.category}</p>
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2">
                                  <button onClick={() => updateQuantity(cartItem.item.id, -1)} className="w-6 h-6 border border-dark-600/40 flex items-center justify-center text-dark-400 hover:text-gold-500 hover:border-gold-500/40 transition-colors">
                                    <Minus size={12} />
                                  </button>
                                  <span className="text-dark-200 text-sm w-6 text-center">{cartItem.quantity}</span>
                                  <button onClick={() => updateQuantity(cartItem.item.id, 1)} className="w-6 h-6 border border-dark-600/40 flex items-center justify-center text-dark-400 hover:text-gold-500 hover:border-gold-500/40 transition-colors">
                                    <Plus size={12} />
                                  </button>
                                </div>
                                <span className="text-gold-500 text-sm font-semibold">
                                  ${(cartItem.item.price * cartItem.quantity).toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <button onClick={() => removeFromBag(cartItem.item.id)} className="text-dark-500 hover:text-red-400 transition-colors self-start mt-1">
                              <Trash2 size={14} />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </>
              )}

              {/* ─── SHIPPING STEP ─── */}
              {step === 'shipping' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
                    <InputField label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
                  </div>
                  <InputField label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                  <InputField label="Phone" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                  <InputField label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <InputField label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
                    <InputField label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
                    <InputField label="Zip Code" value={form.zip} onChange={(v) => setForm({ ...form, zip: v })} />
                  </div>
                  <div className="bg-dark-700/30 border border-dark-600/20 p-4 mt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles size={14} className="text-gold-500" />
                      <span className="text-gold-500 text-xs tracking-widest uppercase font-medium">Complimentary Shipping</span>
                    </div>
                    <p className="text-dark-500 text-xs">All orders include free insured shipping in a luxury presentation box.</p>
                  </div>
                </div>
              )}

              {/* ─── CONFIRM STEP ─── */}
              {step === 'confirm' && (
                <div className="space-y-5">
                  <div className="bg-dark-700/30 border border-dark-600/20 p-4">
                    <h4 className="text-dark-200 text-xs tracking-widest uppercase mb-3 font-medium">Shipping To</h4>
                    <p className="text-dark-100 text-sm">{form.firstName} {form.lastName}</p>
                    <p className="text-dark-400 text-xs mt-0.5">{form.address}</p>
                    <p className="text-dark-400 text-xs">{form.city}, {form.state} {form.zip}</p>
                    <p className="text-dark-400 text-xs">{form.email} · {form.phone}</p>
                  </div>
                  <div className="bg-dark-700/30 border border-dark-600/20 p-4">
                    <h4 className="text-dark-200 text-xs tracking-widest uppercase mb-3 font-medium">Order Summary</h4>
                    <div className="space-y-2">
                      {cart.map((ci) => (
                        <div key={ci.item.id} className="flex justify-between text-xs">
                          <span className="text-dark-300">{ci.item.name} × {ci.quantity}</span>
                          <span className="text-dark-200">${(ci.item.price * ci.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-dark-700/30 border border-dark-600/20 p-4">
                    <h4 className="text-dark-200 text-xs tracking-widest uppercase mb-3 font-medium">Promo Code</h4>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value.toUpperCase());
                          setPromoMessage('');
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                        placeholder="Enter code"
                        className="flex-1 bg-dark-900/50 border border-dark-600/30 text-dark-200 px-3 py-2.5 text-sm placeholder-dark-600 focus:outline-none focus:border-gold-500/50 transition-colors uppercase"
                      />
                      {appliedPromo ? (
                        <button
                          onClick={handleRemovePromo}
                          className="border border-dark-600/40 text-dark-300 px-4 py-2.5 text-xs tracking-widest uppercase hover:border-gold-500/30 hover:text-gold-500 transition-colors"
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          onClick={handleApplyPromo}
                          className="bg-gold-500 text-dark-900 px-4 py-2.5 text-xs tracking-widest uppercase font-semibold hover:bg-gold-400 transition-colors"
                        >
                          Apply
                        </button>
                      )}
                    </div>
                    {promoMessage && (
                      <p className={`mt-2 text-xs ${appliedPromo ? 'text-green-400' : 'text-red-400'}`}>{promoMessage}</p>
                    )}
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-dark-500">Subtotal</span>
                      <span className="text-dark-300">${cartTotal.toLocaleString()}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-500">Promo ({appliedPromo})</span>
                        <span className="text-green-400">-${discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-dark-500">Shipping</span>
                      <span className="text-green-400">Free</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-dark-500">Estimated Tax</span>
                      <span className="text-dark-300">${tax.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-px bg-dark-600/20 my-2" />
                    <div className="flex justify-between">
                      <span className="text-dark-200 text-sm font-medium tracking-wider uppercase">Total</span>
                      <span className="text-gold-500 text-lg font-semibold">${grandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── SUCCESS STEP ─── */}
              {step === 'success' && (
                <div className="text-center py-12">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="w-20 h-20 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6"
                  >
                    <Check size={32} className="text-green-400" />
                  </motion.div>
                  <h3 className="font-serif text-2xl text-dark-100 mb-2">Thank You</h3>
                  <p className="text-dark-300 text-sm mb-1">Your order has been placed successfully.</p>
                  <p className="text-dark-500 text-xs mb-6">A confirmation email has been sent to {form.email || 'your inbox'}.</p>
                  <div className="bg-dark-700/30 border border-dark-600/20 p-4 mb-6">
                    <p className="text-dark-400 text-xs">Order #{lastOrderId}</p>
                    <p className="text-gold-500 font-semibold text-lg mt-1">${lastOrderTotal.toLocaleString()}</p>
                  </div>
                  <p className="text-dark-500 text-xs italic leading-relaxed">
                    Each piece will be lovingly prepared in our atelier and delivered in our signature presentation box. 
                    Thank you for trusting us with your most precious moments.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && step === 'bag' && (
              <div className="p-4 sm:p-6 border-t border-dark-600/20 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-dark-400 text-sm tracking-wider uppercase">Total</span>
                  <span className="text-gold-500 text-xl font-semibold">${cartTotal.toLocaleString()}</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(201,169,110,0.3)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('shipping')}
                  className="w-full bg-gold-500 text-dark-900 py-4 text-sm tracking-widest uppercase font-semibold flex items-center justify-center gap-2 hover:bg-gold-400 transition-colors"
                >
                  <ShoppingBag size={16} />
                  Checkout
                </motion.button>
                <button
                  onClick={() => setCartOpen(false)}
                  className="w-full border border-dark-600/40 text-dark-300 py-3 text-xs tracking-widest uppercase hover:border-gold-500/30 hover:text-gold-500 transition-colors"
                >
                  Continue Shopping
                </button>
              </div>
            )}

            {step === 'shipping' && (
              <div className="p-4 sm:p-6 border-t border-dark-600/20 space-y-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (form.firstName && form.lastName && form.email && form.address && form.city && form.state && form.zip) {
                      setStep('confirm');
                    }
                  }}
                  className={`w-full py-4 text-sm tracking-widest uppercase font-semibold flex items-center justify-center gap-2 transition-all duration-300 ${
                    (form.firstName && form.lastName && form.email && form.address && form.city && form.state && form.zip)
                      ? 'bg-gold-500 text-dark-900 hover:bg-gold-400'
                      : 'bg-dark-600/30 text-dark-500 cursor-not-allowed'
                  }`}
                >
                  Continue to Review
                </motion.button>
              </div>
            )}

            {step === 'confirm' && (
              <div className="p-4 sm:p-6 border-t border-dark-600/20 space-y-3">
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(201,169,110,0.3)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handlePlaceOrder}
                  className="w-full bg-gold-500 text-dark-900 py-4 text-sm tracking-widest uppercase font-semibold flex items-center justify-center gap-2 hover:bg-gold-400 transition-colors"
                >
                  <Diamond size={16} />
                  Place Order — ${grandTotal.toLocaleString()}
                </motion.button>
              </div>
            )}

            {step === 'success' && (
              <div className="p-4 sm:p-6 border-t border-dark-600/20 space-y-3">
                <Link
                  to="/track"
                  onClick={handleClose}
                  className="w-full border border-gold-500/40 text-gold-500 py-3 text-xs tracking-widest uppercase font-semibold flex items-center justify-center gap-2 hover:bg-gold-500/10 transition-colors"
                >
                  <Package size={14} />
                  Track Your Order
                </Link>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClose}
                  className="w-full bg-gold-500 text-dark-900 py-4 text-sm tracking-widest uppercase font-semibold hover:bg-gold-400 transition-colors"
                >
                  Continue Shopping
                </motion.button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function InputField({ label, type = 'text', value, onChange }: { label: string; type?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-dark-400 text-[10px] tracking-widest uppercase block mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-dark-900/50 border border-dark-600/30 text-dark-200 px-3 py-2.5 text-sm placeholder-dark-600 focus:outline-none focus:border-gold-500/50 transition-colors"
        placeholder={label}
      />
    </div>
  );
}

// ─── Wishlist Drawer ───────────────────────────────────────────────
function WishlistDrawer() {
  const { wishlist, toggleWishlist, wishlistOpen, setWishlistOpen } = useWishlist();
  const { addToBag } = useCart();

  const categoryImage: Record<string, string> = {
    Rings: '/images/ring.jpg',
    Necklaces: '/images/necklace.jpg',
    Bracelets: '/images/bracelet.jpg',
    Earrings: '/images/earrings.jpg',
  };

  return (
    <AnimatePresence>
      {wishlistOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-dark-900/80 backdrop-blur-sm z-[60]"
            onClick={() => setWishlistOpen(false)}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-dark-800 border-l border-dark-600/30 z-[70] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-dark-600/20">
              <div className="flex items-center gap-3">
                <Heart size={20} className="text-gold-500" />
                <span className="text-dark-100 text-lg tracking-wider uppercase font-medium font-serif">
                  Wishlist
                </span>
                {wishlist.length > 0 && (
                  <span className="bg-gold-500 text-dark-900 text-xs w-5 h-5 flex items-center justify-center font-semibold">
                    {wishlist.length}
                  </span>
                )}
              </div>
              <button onClick={() => setWishlistOpen(false)} className="text-dark-400 hover:text-gold-500 transition-colors">
                <X size={22} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {wishlist.length === 0 ? (
                <div className="text-center py-16">
                  <Heart className="mx-auto text-dark-600 mb-4" size={48} />
                  <p className="text-dark-400 font-serif text-lg mb-2">Your wishlist is empty</p>
                  <p className="text-dark-600 text-sm">Tap the heart on any piece to save it here.</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setWishlistOpen(false)}
                    className="mt-6 bg-gold-500 text-dark-900 px-6 py-3 text-xs tracking-widest uppercase font-semibold hover:bg-gold-400 transition-colors"
                  >
                    Browse Collection
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence>
                    {wishlist.map((wItem) => (
                      <motion.div
                        key={wItem.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex gap-4 bg-dark-700/30 border border-dark-600/20 p-3"
                      >
                        <div
                          className="w-20 h-20 shrink-0 bg-cover bg-center"
                          style={{ backgroundImage: `url(${categoryImage[wItem.category]})` }}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-dark-100 text-sm font-serif truncate">{wItem.name}</h4>
                          <p className="text-dark-500 text-xs mt-0.5">{wItem.metal} · {wItem.category}</p>
                          <div className="flex items-center justify-between mt-2">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => addToBag(wItem)}
                              className="flex items-center gap-1.5 bg-gold-500 text-dark-900 px-3 py-1.5 text-[10px] tracking-widest uppercase font-semibold hover:bg-gold-400 transition-colors"
                            >
                              <ShoppingBag size={11} />
                              Add to Bag
                            </motion.button>
                            <span className="text-gold-500 text-sm font-semibold">
                              ${wItem.price.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleWishlist(wItem)}
                          className="text-dark-500 hover:text-red-400 transition-colors self-start mt-1"
                        >
                          <X size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer */}
            {wishlist.length > 0 && (
              <div className="p-6 border-t border-dark-600/20 space-y-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    wishlist.forEach((wItem) => addToBag(wItem));
                    setWishlistOpen(false);
                  }}
                  className="w-full bg-gold-500 text-dark-900 py-4 text-sm tracking-widest uppercase font-semibold flex items-center justify-center gap-2 hover:bg-gold-400 transition-colors"
                >
                  <ShoppingBag size={16} />
                  Add All to Bag
                </motion.button>
                <button
                  onClick={() => setWishlistOpen(false)}
                  className="w-full border border-dark-600/40 text-dark-300 py-3 text-xs tracking-widest uppercase hover:border-gold-500/30 hover:text-gold-500 transition-colors"
                >
                  Continue Shopping
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Product Detail Modal ──────────────────────────────────────────
function ProductDetailModal() {
  const { selectedProduct, setSelectedProduct } = useProductDetail();
  const { addToBag } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [added, setAdded] = useState(false);
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedSize, setSelectedSize] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedView, setSelectedView] = useState(0);
  const [zooming, setZooming] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  // Reset view when product changes
  useEffect(() => {
    setSelectedView(0);
    setZooming(false);
    setQuantity(1);
    setSelectedColor(0);
    setSelectedSize(0);
    setAdded(false);
  }, [selectedProduct]);

  if (!selectedProduct) return null;

  const item = selectedProduct;
  const liked = isInWishlist(item.id);

  // 3 views per category: front, side, detail (zoomed crop)
  const categoryImages: Record<string, { src: string; label: string; bgPos: string; bgSize: string }[]> = {
    Rings: [
      { src: '/images/ring.jpg', label: 'Front', bgPos: 'center', bgSize: 'cover' },
      { src: '/images/ring-side.jpg', label: 'Profile', bgPos: 'center', bgSize: 'cover' },
      { src: '/images/ring.jpg', label: 'Detail', bgPos: 'center 35%', bgSize: '220%' },
    ],
    Necklaces: [
      { src: '/images/necklace.jpg', label: 'Front', bgPos: 'center', bgSize: 'cover' },
      { src: '/images/necklace-side.jpg', label: 'Side', bgPos: 'center', bgSize: 'cover' },
      { src: '/images/necklace.jpg', label: 'Detail', bgPos: 'center 30%', bgSize: '220%' },
    ],
    Bracelets: [
      { src: '/images/bracelet.jpg', label: 'Front', bgPos: 'center', bgSize: 'cover' },
      { src: '/images/bracelet-side.jpg', label: 'Side', bgPos: 'center', bgSize: 'cover' },
      { src: '/images/bracelet.jpg', label: 'Detail', bgPos: 'center 40%', bgSize: '220%' },
    ],
    Earrings: [
      { src: '/images/earrings.jpg', label: 'Front', bgPos: 'center', bgSize: 'cover' },
      { src: '/images/earrings-side.jpg', label: 'Side', bgPos: 'center', bgSize: 'cover' },
      { src: '/images/earrings.jpg', label: 'Detail', bgPos: 'center 35%', bgSize: '220%' },
    ],
  };

  const views = categoryImages[item.category];
  const currentView = views[selectedView];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  const availabilityStyles: Record<string, string> = {
    'In Stock': 'bg-green-500/10 text-green-400 border-green-500/20',
    'Limited Edition': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Pre-Order': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Made to Order': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  const handleAddToBag = () => {
    for (let i = 0; i < quantity; i++) {
      addToBag(item);
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <AnimatePresence>
      <motion.div
        key={item.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-dark-900/95 backdrop-blur-md z-[80] flex items-center justify-center p-4 md:p-6"
        onClick={() => setSelectedProduct(null)}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="bg-dark-800 border border-dark-600/40 max-w-6xl w-full max-h-[92vh] overflow-y-auto relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={() => setSelectedProduct(null)}
            className="absolute top-4 right-4 z-20 w-10 h-10 bg-dark-900/60 backdrop-blur-sm flex items-center justify-center text-dark-400 hover:text-gold-500 transition-colors border border-dark-600/30"
          >
            <X size={20} />
          </button>

          <div className="grid md:grid-cols-2">
            {/* Left — Image Gallery */}
            <div className="flex flex-col bg-dark-700/30">
              {/* Main Image with Zoom */}
              <div
                className="relative aspect-square overflow-hidden cursor-crosshair select-none"
                onMouseEnter={() => setZooming(true)}
                onMouseLeave={() => setZooming(false)}
                onMouseMove={handleMouseMove}
              >
                <motion.div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${currentView.src})`,
                    backgroundPosition: zooming ? `${mousePos.x}% ${mousePos.y}%` : currentView.bgPos,
                    backgroundSize: zooming ? '250%' : currentView.bgSize,
                    transition: zooming ? 'none' : 'background-size 0.4s ease, background-position 0.4s ease',
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-800/30 via-transparent to-transparent pointer-events-none md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-dark-800/10" />

                {/* Zoom hint */}
                <AnimatePresence>
                  {!zooming && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute bottom-4 left-4 flex items-center gap-2 bg-dark-900/70 backdrop-blur-sm px-3 py-1.5 text-dark-400 text-[10px] tracking-widest uppercase pointer-events-none"
                    >
                      <Search size={12} />
                      Hover to zoom
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Badges on image */}
                <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 pointer-events-none">
                  {item.isNew && (
                    <span className="bg-gold-500 text-dark-900 text-[10px] tracking-widest uppercase px-3 py-1 font-semibold">
                      New Arrival
                    </span>
                  )}
                  <span className={`text-[10px] tracking-widest uppercase px-3 py-1 border ${availabilityStyles[item.availability]}`}>
                    {item.availability}
                  </span>
                </div>
              </div>

              {/* Thumbnail Gallery */}
              <div className="flex gap-2 p-3 bg-dark-800/50">
                {views.map((view, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedView(idx)}
                    className={`relative flex-1 aspect-square overflow-hidden border-2 transition-all duration-200 ${
                      selectedView === idx
                        ? 'border-gold-500 opacity-100'
                        : 'border-dark-600/30 opacity-50 hover:opacity-75 hover:border-dark-400'
                    }`}
                  >
                    <div
                      className="absolute inset-0 bg-cover"
                      style={{
                        backgroundImage: `url(${view.src})`,
                        backgroundPosition: view.bgPos,
                        backgroundSize: view.bgSize === 'cover' ? 'cover' : '180%',
                      }}
                    />
                  </button>
                ))}
                <div className="flex items-center ml-2">
                  <span className="text-dark-500 text-[10px] tracking-widest uppercase whitespace-nowrap">
                    {views[selectedView].label} View
                  </span>
                </div>
              </div>
            </div>

            {/* Right — Details */}
            <div className="p-6 md:p-10 flex flex-col overflow-y-auto max-h-[92vh] md:max-h-none">
              {/* Category & Rating */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-gold-500 text-xs tracking-[0.3em] uppercase font-medium">
                  {item.category}
                </span>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={12}
                      className={i < Math.floor(item.rating) ? 'text-gold-500 fill-gold-500' : 'text-dark-600'}
                    />
                  ))}
                  <span className="text-dark-400 text-xs ml-1">({item.rating})</span>
                </div>
              </div>

              {/* Name */}
              <h2 className="font-serif text-2xl md:text-3xl text-dark-100 mb-4 leading-tight">
                {item.name}
              </h2>

              {/* Price */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-gold-500 text-2xl font-semibold">
                  ${item.price.toLocaleString()}
                </span>
                <span className="text-dark-500 text-xs tracking-wider uppercase">
                  {item.metal}{item.gemstone !== 'None' ? ` · ${item.gemstone}` : ''}
                </span>
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-dark-600/20 mb-6" />

              {/* Heartfelt Description */}
              <div className="mb-6">
                <p className="text-dark-300 text-sm leading-relaxed italic font-light">
                  "{item.heartfeltDescription}"
                </p>
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-dark-600/20 mb-6" />

              {/* Color Options */}
              <div className="mb-6">
                <h4 className="text-dark-200 text-xs tracking-widest uppercase font-medium mb-3">
                  Colour — <span className="text-gold-500">{item.colors[selectedColor].name}</span>
                </h4>
                <div className="flex items-center gap-3">
                  {item.colors.map((color, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedColor(idx)}
                      className={`w-8 h-8 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                        selectedColor === idx
                          ? 'border-gold-500 scale-110'
                          : 'border-dark-600/40 hover:border-dark-400'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    >
                      {selectedColor === idx && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-2 h-2 rounded-full bg-dark-900"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size Options */}
              <div className="mb-6">
                <h4 className="text-dark-200 text-xs tracking-widest uppercase font-medium mb-3">
                  Size
                </h4>
                <div className="flex flex-wrap gap-2">
                  {item.sizes.map((size, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedSize(idx)}
                      className={`px-4 py-2 text-xs tracking-wider border transition-all duration-200 ${
                        selectedSize === idx
                          ? 'border-gold-500 text-gold-500 bg-gold-500/10'
                          : 'border-dark-600/30 text-dark-400 hover:border-gold-500/30 hover:text-dark-200'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div className="mb-6">
                <h4 className="text-dark-200 text-xs tracking-widest uppercase font-medium mb-3">
                  Quantity
                </h4>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-9 h-9 border border-dark-600/40 flex items-center justify-center text-dark-400 hover:text-gold-500 hover:border-gold-500/40 transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-dark-200 text-sm w-8 text-center font-medium">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-9 h-9 border border-dark-600/40 flex items-center justify-center text-dark-400 hover:text-gold-500 hover:border-gold-500/40 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Availability */}
              <div className="mb-8">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] tracking-widest uppercase px-3 py-1.5 border ${availabilityStyles[item.availability]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      item.availability === 'In Stock' ? 'bg-green-400' :
                      item.availability === 'Limited Edition' ? 'bg-amber-400' :
                      item.availability === 'Pre-Order' ? 'bg-blue-400' : 'bg-purple-400'
                    }`} />
                    {item.availability}
                  </span>
                </div>
                {item.availability === 'Pre-Order' && (
                  <p className="text-dark-500 text-xs mt-2">Estimated delivery: 4–6 weeks</p>
                )}
                {item.availability === 'Made to Order' && (
                  <p className="text-dark-500 text-xs mt-2">Handcrafted for you in 3–4 weeks</p>
                )}
                {item.availability === 'Limited Edition' && (
                  <p className="text-dark-500 text-xs mt-2">Only a few pieces remaining worldwide</p>
                )}
              </div>

              {/* Actions */}
              <div className="mt-auto space-y-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddToBag}
                  className={`w-full py-4 text-sm tracking-widest uppercase font-semibold flex items-center justify-center gap-2 transition-all duration-300 ${
                    added
                      ? 'bg-green-500 text-white'
                      : 'bg-gold-500 text-dark-900 hover:bg-gold-400'
                  }`}
                >
                  {added ? (
                    <>
                      <Check size={16} />
                      Added to Bag!
                    </>
                  ) : (
                    <>
                      <ShoppingBag size={16} />
                      Add to Bag — ${(item.price * quantity).toLocaleString()}
                    </>
                  )}
                </motion.button>
                <button
                  onClick={() => toggleWishlist(item)}
                  className={`w-full py-3 text-sm tracking-widest uppercase font-semibold flex items-center justify-center gap-2 border transition-all duration-200 ${
                    liked
                      ? 'border-red-400/30 text-red-400 bg-red-400/5 hover:bg-red-400/10'
                      : 'border-dark-600/50 text-dark-200 hover:border-gold-500/40 hover:text-gold-500'
                  }`}
                >
                  <Heart size={16} className={liked ? 'fill-red-400' : ''} />
                  {liked ? 'Saved to Wishlist' : 'Add to Wishlist'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Navbar ────────────────────────────────────────────────────────
function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { cartCount, setCartOpen } = useCart();
  const { wishlistCount, setWishlistOpen } = useWishlist();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Collection', path: '/collection' },
    { name: 'About', path: '/about' },
    { name: 'Tracking', path: '/track' },
    { name: 'Contact', path: '/contact' },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/collection?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-dark-900/95 backdrop-blur-md border-b border-gold-500/10'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-center gap-6 sm:gap-10">
        <Link
          to="/"
          className="font-serif text-xl sm:text-2xl md:text-3xl tracking-[0.3em] text-gold-500 font-semibold hover:opacity-90 transition-opacity shrink-0"
        >
          VISION WRLD
          </Link>

        <div className="hidden md:flex items-center gap-4 sm:gap-7">
          {navLinks.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className="text-dark-200 hover:text-gold-500 transition-colors duration-300 text-sm tracking-widest uppercase"
            >
              {item.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSearchOpen(!searchOpen)}
            className="text-dark-200 hover:text-gold-500 transition-colors"
          >
            <Search size={20} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setWishlistOpen(true)}
            className="text-dark-200 hover:text-gold-500 transition-colors relative"
          >
            <Heart size={20} />
            {wishlistCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 text-white text-[10px] rounded-full flex items-center justify-center font-semibold"
              >
                {wishlistCount}
              </motion.span>
            )}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCartOpen(true)}
            className="text-dark-200 hover:text-gold-500 transition-colors relative"
          >
            <ShoppingBag size={20} />
            {cartCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-gold-500 text-dark-900 text-[10px] rounded-full flex items-center justify-center font-semibold"
              >
                {cartCount}
              </motion.span>
            )}
          </motion.button>
          <button
            className="md:hidden text-dark-200 hover:text-gold-500"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Search Bar Overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-dark-600/20 bg-dark-800/98 backdrop-blur-lg overflow-hidden"
          >
            <div className="max-w-3xl mx-auto px-6 py-5">
              <form onSubmit={handleSearch} className="flex items-center gap-4">
                <Search size={18} className="text-dark-500 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for rings, necklaces, diamonds..."
                  autoFocus
                  className="flex-1 bg-transparent text-dark-200 text-sm placeholder-dark-600 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-dark-500 hover:text-dark-200 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                  className="text-dark-500 hover:text-dark-200 text-xs tracking-widest uppercase transition-colors"
                >
                  Cancel
                </button>
              </form>
              {searchQuery && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 pt-3 border-t border-dark-600/20"
                >
                  <p className="text-dark-500 text-xs">
                    Press <span className="text-dark-300">Enter</span> to search for "<span className="text-gold-500">{searchQuery}</span>"
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-dark-800/98 backdrop-blur-lg border-t border-gold-500/10 overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-1">
              {/* Mobile search */}
              <form onSubmit={handleSearch} className="flex items-center gap-3 pb-4 mb-2 border-b border-dark-600/20">
                <Search size={16} className="text-dark-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search collection..."
                  className="flex-1 bg-transparent text-dark-200 text-sm placeholder-dark-600 focus:outline-none"
                />
              </form>
              {navLinks.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className="text-dark-200 hover:text-gold-500 text-base tracking-widest uppercase py-2.5"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────
function Hero() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 400], [1, 0]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <motion.div style={{ y }} className="absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/images/hero.jpg)' }}
        />
        <div className="absolute inset-0 bg-dark-900/70" />
        <div className="absolute inset-0 bg-gradient-to-b from-dark-900/50 via-transparent to-dark-900" />
      </motion.div>

      <motion.div style={{ opacity }} className="relative z-10 text-center px-6 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="mb-6"
        >
          <Diamond className="mx-auto text-gold-500 mb-4" size={32} />
          <div className="w-24 h-[1px] gold-line mx-auto" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="text-gold-500 tracking-[0.5em] text-xs md:text-sm uppercase mb-6 font-medium"
        >
          Exquisite Craftsmanship Since 1892
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="font-serif text-4xl sm:text-5xl md:text-7xl lg:text-8xl mb-6 sm:mb-8 leading-tight"
        >
          <span className="shimmer-text">Timeless</span>
          <br />
          <span className="text-dark-100 font-light">Elegance</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.9 }}
          className="text-dark-300 text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed font-light px-4 sm:px-0"
        >
          Discover our curated collection of handcrafted jewelry, where every piece tells
          a story of artistry and enduring beauty.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.1 }}
          className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0"
        >
          <Link
            to="/collection"
            className="bg-gold-500 text-dark-900 px-6 sm:px-8 py-3 sm:py-4 text-xs sm:text-sm tracking-widest uppercase font-semibold flex items-center justify-center gap-3 hover:bg-gold-400 transition-colors w-full sm:w-auto"
            style={{ display: 'inline-flex' }}
          >
            Explore Collection
            <ArrowRight size={16} />
          </Link>
          <Link
            to="/contact"
            className="border border-gold-500/40 text-gold-500 px-6 sm:px-8 py-3 sm:py-4 text-xs sm:text-sm tracking-widest uppercase font-semibold hover:bg-gold-500/10 transition-colors w-full sm:w-auto flex items-center justify-center"
            style={{ display: 'inline-flex' }}
          >
            Book Appointment
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="mt-16"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-dark-400"
          >
            <ChevronDown size={24} className="mx-auto" />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─── Filter Sidebar ────────────────────────────────────────────────
interface FilterState {
  categories: Category[];
  metals: Metal[];
  gemstones: Gemstone[];
  priceRanges: number[];
  sortBy: SortOption;
}

interface SidebarProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onReset: () => void;
  activeCount: number;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

function FilterSection({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-dark-600/30 pb-4 mb-4 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left mb-3 group"
      >
        <span className="flex items-center gap-2 text-dark-100 text-sm tracking-wider uppercase font-medium group-hover:text-gold-500 transition-colors">
          {icon}
          {title}
        </span>
        {open ? <ChevronUp size={14} className="text-dark-400" /> : <ChevronDown size={14} className="text-dark-400" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CheckboxItem({
  label,
  checked,
  onChange,
  count,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  count?: number;
}) {
  return (
    <label className="flex items-center gap-3 py-1.5 cursor-pointer group">
      <div
        className={`w-4 h-4 border flex items-center justify-center transition-all duration-200 ${
          checked
            ? 'bg-gold-500 border-gold-500'
            : 'border-dark-400 group-hover:border-gold-500/50'
        }`}
      >
        {checked && (
          <motion.svg
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-3 h-3 text-dark-900"
            viewBox="0 0 12 12"
          >
            <path
              d="M2 6l3 3 5-5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        )}
      </div>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span
        className={`text-sm transition-colors ${
          checked ? 'text-gold-500' : 'text-dark-300 group-hover:text-dark-100'
        }`}
      >
        {label}
      </span>
      {count !== undefined && (
        <span className="ml-auto text-xs text-dark-500">({count})</span>
      )}
    </label>
  );
}

function FilterSidebar({ filters, setFilters, onReset, activeCount, mobileOpen, setMobileOpen }: SidebarProps) {
  const toggleCategory = (cat: Category) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const toggleMetal = (metal: Metal) => {
    setFilters((prev) => ({
      ...prev,
      metals: prev.metals.includes(metal)
        ? prev.metals.filter((m) => m !== metal)
        : [...prev.metals, metal],
    }));
  };

  const toggleGemstone = (gem: Gemstone) => {
    setFilters((prev) => ({
      ...prev,
      gemstones: prev.gemstones.includes(gem)
        ? prev.gemstones.filter((g) => g !== gem)
        : [...prev.gemstones, gem],
    }));
  };

  const togglePriceRange = (idx: number) => {
    setFilters((prev) => ({
      ...prev,
      priceRanges: prev.priceRanges.includes(idx)
        ? prev.priceRanges.filter((i) => i !== idx)
        : [...prev.priceRanges, idx],
    }));
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of jewelryItems) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, []);

  const metalCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of jewelryItems) {
      counts[item.metal] = (counts[item.metal] || 0) + 1;
    }
    return counts;
  }, []);

  const gemstoneCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of jewelryItems) {
      counts[item.gemstone] = (counts[item.gemstone] || 0) + 1;
    }
    return counts;
  }, []);

  const content = (
    <div className="space-y-1">
      {/* Active filters header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-gold-500" />
          <span className="text-dark-100 text-sm tracking-wider uppercase font-medium">Filters</span>
          {activeCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-gold-500 text-dark-900 text-xs w-5 h-5 flex items-center justify-center font-semibold"
            >
              {activeCount}
            </motion.span>
          )}
        </div>
        {activeCount > 0 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onReset}
            className="flex items-center gap-1 text-dark-400 hover:text-gold-500 text-xs tracking-wider uppercase transition-colors"
          >
            <RotateCcw size={12} />
            Reset All
          </motion.button>
        )}
      </div>

      <FilterSection title="Category" icon={<Diamond size={14} className="text-gold-500" />}>
        {categories.map((cat) => (
          <CheckboxItem
            key={cat}
            label={cat}
            checked={filters.categories.includes(cat)}
            onChange={() => toggleCategory(cat)}
            count={categoryCounts[cat]}
          />
        ))}
      </FilterSection>

      <FilterSection title="Metal" icon={<Sparkles size={14} className="text-gold-500" />}>
        {metals.map((metal) => (
          <CheckboxItem
            key={metal}
            label={metal}
            checked={filters.metals.includes(metal)}
            onChange={() => toggleMetal(metal)}
            count={metalCounts[metal]}
          />
        ))}
      </FilterSection>

      <FilterSection title="Gemstone" icon={<Star size={14} className="text-gold-500" />}>
        {gemstones.map((gem) => (
          <CheckboxItem
            key={gem}
            label={gem === 'None' ? 'No Gemstone' : gem}
            checked={filters.gemstones.includes(gem)}
            onChange={() => toggleGemstone(gem)}
            count={gemstoneCounts[gem]}
          />
        ))}
      </FilterSection>

      <FilterSection title="Price Range" icon={<span className="text-gold-500 text-xs">$</span>}>
        {priceRanges.map((range, idx) => (
          <CheckboxItem
            key={idx}
            label={range.label}
            checked={filters.priceRanges.includes(idx)}
            onChange={() => togglePriceRange(idx)}
          />
        ))}
      </FilterSection>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-72 shrink-0">
        <div className="sticky top-24 bg-dark-800/50 border border-dark-600/30 p-6 rounded-sm backdrop-blur-sm">
          {content}
        </div>
      </aside>

      {/* Mobile filter overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-dark-900/80 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-80 bg-dark-800 z-50 p-6 overflow-y-auto lg:hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <span className="text-dark-100 text-lg tracking-wider uppercase font-medium font-serif">
                  Filters
                </span>
                <button onClick={() => setMobileOpen(false)} className="text-dark-400 hover:text-gold-500">
                  <X size={20} />
                </button>
              </div>
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Product Card ──────────────────────────────────────────────────
function ProductCard({ item, index }: { item: JewelryItem; index: number }) {
  const [hovered, setHovered] = useState(false);
  const [added, setAdded] = useState(false);
  const { addToBag } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { setSelectedProduct } = useProductDetail();

  const liked = isInWishlist(item.id);

  const categoryImage: Record<string, string> = {
    Rings: '/images/ring.jpg',
    Necklaces: '/images/necklace.jpg',
    Bracelets: '/images/bracelet.jpg',
    Earrings: '/images/earrings.jpg',
  };

  const handleAddToBag = () => {
    addToBag(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      className="group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="relative overflow-hidden bg-dark-800/50 border border-dark-600/30 hover:border-gold-500/30 transition-all duration-500 rounded-sm cursor-pointer"
        onClick={() => setSelectedProduct(item)}
      >
        {/* Image */}
        <div className="relative aspect-square overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${categoryImage[item.category]})`,
            }}
            animate={{ scale: hovered ? 1.08 : 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 via-dark-900/20 to-transparent" />
          </motion.div>

          {/* Badges */}
          <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex flex-col gap-1.5 sm:gap-2 z-10">
            {item.isNew && (
              <motion.span
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="bg-gold-500 text-dark-900 text-[9px] sm:text-[10px] tracking-widest uppercase px-2 sm:px-3 py-0.5 sm:py-1 font-semibold"
              >
                New
              </motion.span>
            )}
            {item.gemstone !== 'None' && (
              <span className="bg-dark-900/80 backdrop-blur-sm text-gold-400 text-[9px] sm:text-[10px] tracking-widest uppercase px-2 sm:px-3 py-0.5 sm:py-1">
                {item.gemstone}
              </span>
            )}
          </div>

          {/* Quick actions */}
          <div className="absolute top-2 sm:top-3 right-2 sm:right-3 flex flex-col gap-1.5 sm:gap-2 z-10">
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: hovered ? 1 : 0, x: hovered ? 0 : 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => { e.stopPropagation(); toggleWishlist(item); }}
              className={`w-8 h-8 sm:w-9 sm:h-9 backdrop-blur-sm flex items-center justify-center transition-all duration-200 border ${
                liked
                  ? 'bg-red-400/20 border-red-400/40'
                  : 'bg-dark-900/70 border-dark-600/30 hover:bg-gold-500/20'
              }`}
            >
              <motion.div
                key={liked ? 'filled' : 'empty'}
                initial={{ scale: liked ? 0 : 1 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <Heart
                  size={14}
                  className={liked ? 'text-red-400 fill-red-400' : 'text-dark-200'}
                />
              </motion.div>
            </motion.button>
          </div>

          {/* Add to cart overlay */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 20 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 z-10"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => { e.stopPropagation(); handleAddToBag(); }}
              className={`w-full py-2.5 sm:py-3 text-[10px] sm:text-xs tracking-widest uppercase font-semibold flex items-center justify-center gap-2 transition-all duration-300 ${
                added
                  ? 'bg-green-500 text-white'
                  : 'bg-gold-500 text-dark-900 hover:bg-gold-400'
              }`}
            >
              {added ? (
                <>
                  <Check size={14} />
                  Added!
                </>
              ) : (
                <>
                  <ShoppingBag size={14} />
                  Add to Bag
                </>
              )}
            </motion.button>
          </motion.div>
        </div>

        {/* Info */}
        <div className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-dark-500 text-[9px] sm:text-[10px] tracking-widest uppercase">
              {item.category}
            </span>
            <div className="flex items-center gap-1">
              <Star size={9} className="sm:size-[10px] text-gold-500 fill-gold-500" />
              <span className="text-dark-400 text-[10px] sm:text-xs">{item.rating}</span>
            </div>
          </div>
          <h3 className="text-dark-100 font-serif text-sm sm:text-base mb-2 group-hover:text-gold-500 transition-colors duration-300">
            {item.name}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-gold-500 font-semibold text-base sm:text-lg">
              ${item.price.toLocaleString()}
            </span>
            <span className="text-dark-500 text-[9px] sm:text-[10px] tracking-wider uppercase">
              {item.metal}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── About Section ─────────────────────────────────────────────────
function AboutSection() {
  const values = [
    {
      icon: <Diamond size={24} />,
      title: 'Uncompromising Craft',
      text: 'Every piece passes through the hands of master artisans who have dedicated their lives to the art of fine jewelry. No shortcuts, no compromises — only the relentless pursuit of perfection.',
    },
    {
      icon: <Heart size={24} />,
      title: 'Ethical Radiance',
      text: 'We believe beauty should never come at a cost to our planet or its people. Every gemstone is ethically sourced, every metal recycled, and every artisan fairly compensated for their mastery.',
    },
    {
      icon: <Sparkles size={24} />,
      title: 'Timeless, Not Trendy',
      text: 'We don\'t follow seasons. We create heirlooms. Each design is conceived to outlast generations, growing more meaningful with every year it\'s worn, loved, and passed on.',
    },
    {
      icon: <Star size={24} />,
      title: 'Personal Connection',
      text: 'Behind every piece is a story — yours. We honour the deeply personal nature of jewelry and craft each piece as though it were made for someone we love. Because one day, it will be.',
    },
  ];

  const milestones = [
    { year: '1892', event: 'Founded in a small Parisian atelier with a single promise: to create jewelry that moves the soul.' },
    { year: '1924', event: 'Our Art Deco collection captivated the world, gracing the wrists and necks of a new generation of visionaries.' },
    { year: '1967', event: 'Opened our first flagship maison, where clients could witness the magic of creation firsthand.' },
    { year: '2001', event: 'Pioneered ethical sourcing practices that would become the gold standard for the entire industry.' },
    { year: 'Today', event: 'From our ateliers to your heart — every piece still carries the same promise made over a century ago.' },
  ];

  return (
    <section id="about" className="py-0">
      {/* ── Hero Banner ── */}
      <div className="relative h-[60vh] md:h-[70vh] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/images/about.jpg)' }}
        />
        <div className="absolute inset-0 bg-dark-900/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/30 to-transparent" />

        <div className="relative z-10 h-full flex flex-col items-center justify-end pb-16 px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          >
            <div className="w-16 h-[1px] gold-line mx-auto mb-6" />
            <h2 className="font-serif text-4xl md:text-6xl lg:text-7xl text-dark-100 mb-4">
              Our <span className="shimmer-text">Story</span>
            </h2>
            <p className="text-dark-300 text-lg max-w-2xl mx-auto font-light">
              Where passion meets precision, and every piece carries a century of devotion.
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── The Letter ── */}
      <div className="py-24 px-6 bg-dark-900">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <Diamond className="mx-auto text-gold-500/30 mb-6" size={28} />
            <h3 className="font-serif text-3xl md:text-4xl text-dark-100 mb-8">A Letter From Our Founder</h3>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -left-4 md:-left-8 top-0 text-gold-500/15 font-serif text-[120px] leading-none select-none">"</div>
            <div className="space-y-6 text-dark-300 text-base md:text-lg leading-relaxed font-light relative z-10 pl-8 md:pl-16">
              <p>
                When I founded VISION WRLD in 1892, I didn't set out to build a jewelry house. I set out to capture the
                things that words fail to express — the quiet devotion between two people, the pride in a mother's eyes,
                the courage it takes to begin again.
              </p>
              <p>
                I believe that true elegance is not loud. It doesn't demand attention — it commands it. It lives in the
                curve of a gold band that has been worn for fifty years, in the way a diamond catches the morning light
                on a hand that has held a child, wiped a tear, and built a life. Our pieces are not accessories. They
                are witnesses to your most profound moments.
              </p>
              <p>
                Every gemstone we select has been chosen not just for its brilliance, but for its character. Every setting
                has been designed not just to hold a stone, but to hold a memory. Our artisans don't simply craft jewelry —
                they translate emotion into form, turning the invisible threads of love, loss, hope, and triumph into
                something you can hold in your hand.
              </p>
              <p>
                For over a century, we have had the extraordinary privilege of being part of your stories — the engagements,
                the anniversaries, the quiet Tuesdays when someone simply decided they were worth something beautiful. That
                trust is sacred to us, and it informs every decision we make.
              </p>
              <p className="text-gold-400 font-serif text-xl italic">
                We don't make jewelry for everyone. We make jewelry for the moments that matter.
              </p>
              <p className="text-dark-400 text-sm pt-4">
                — The VISION WRLD Family, since 1892
              </p>
            </div>
            <div className="absolute -right-4 md:-right-8 bottom-0 text-gold-500/15 font-serif text-[120px] leading-none select-none rotate-180">"</div>
          </motion.div>
        </div>
      </div>

      {/* ── Gold Divider ── */}
      <div className="w-full h-px gold-line" />

      {/* ── Our Values ── */}
      <div className="py-24 px-6 bg-dark-800/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <p className="text-gold-500 text-xs tracking-[0.5em] uppercase mb-4">What Guides Us</p>
            <h3 className="font-serif text-3xl md:text-4xl text-dark-100">Our Values</h3>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((v, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="bg-dark-900/50 border border-dark-600/20 p-8 hover:border-gold-500/20 transition-all duration-500 group"
              >
                <div className="text-gold-500/60 group-hover:text-gold-500 transition-colors duration-300 mb-4">
                  {v.icon}
                </div>
                <h4 className="text-dark-100 font-serif text-xl mb-3 group-hover:text-gold-500 transition-colors duration-300">
                  {v.title}
                </h4>
                <p className="text-dark-400 text-sm leading-relaxed font-light">{v.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Gold Divider ── */}
      <div className="w-full h-px gold-line" />

      {/* ── Journey / Timeline ── */}
      <div className="py-24 px-6 bg-dark-900">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <p className="text-gold-500 text-xs tracking-[0.5em] uppercase mb-4">Through The Years</p>
            <h3 className="font-serif text-3xl md:text-4xl text-dark-100">Our Journey</h3>
          </motion.div>

          <div className="relative">
            {/* Center line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-gold-500/40 via-gold-500/20 to-transparent" />

            <div className="space-y-12">
              {milestones.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.6 }}
                  className={`relative flex items-start gap-8 ${
                    i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                >
                  {/* Dot on timeline */}
                  <div className="absolute left-6 md:left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gold-500 border-2 border-dark-900 z-10 mt-2" />

                  {/* Content */}
                  <div className={`ml-14 md:ml-0 md:w-1/2 ${i % 2 === 0 ? 'md:pr-16 md:text-right' : 'md:pl-16 md:text-left'}`}>
                    <span className="text-gold-500 font-serif text-2xl">{m.year}</span>
                    <p className="text-dark-300 text-sm leading-relaxed mt-2 font-light">{m.event}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Closing Statement ── */}
      <div className="py-20 px-6 bg-dark-800/20 border-t border-b border-dark-600/10">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <Sparkles className="mx-auto text-gold-500/30 mb-6" size={24} />
            <p className="text-dark-200 text-xl md:text-2xl font-serif leading-relaxed mb-6">
              "The most beautiful things in life are not things — they are the feelings we carry, the people we cherish, and the moments we choose to remember."
            </p>
            <p className="text-dark-500 text-sm tracking-widest uppercase">
              — This is the VISION WRLD Promise
            </p>
            <div className="w-24 h-[1px] gold-line mx-auto mt-8" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Wishlist Page Section ─────────────────────────────────────────
function WishlistSection() {
  const { wishlist, toggleWishlist } = useWishlist();
  const { addToBag, setCartOpen } = useCart();

  const categoryImage: Record<string, string> = {
    Rings: '/images/ring.jpg',
    Necklaces: '/images/necklace.jpg',
    Bracelets: '/images/bracelet.jpg',
    Earrings: '/images/earrings.jpg',
  };

  return (
    <section id="wishlist" className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <Heart className="mx-auto text-gold-500/40 mb-4" size={24} />
          <h2 className="font-serif text-4xl md:text-5xl text-dark-100 mb-4">
            Your <span className="shimmer-text">Wishlist</span>
          </h2>
          <p className="text-dark-400 max-w-xl mx-auto">
            The pieces you've fallen in love with — all in one place.
          </p>
          <div className="w-24 h-[1px] gold-line mx-auto mt-6" />
        </motion.div>

        {wishlist.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Heart className="mx-auto text-dark-600 mb-4" size={56} />
            <h3 className="font-serif text-2xl text-dark-300 mb-3">No favorites yet</h3>
            <p className="text-dark-500 text-sm mb-8 max-w-md mx-auto">
              Browse our collection and tap the heart icon on any piece to save it to your wishlist.
            </p>
            <Link
              to="/collection"
              className="inline-flex items-center gap-2 bg-gold-500 text-dark-900 px-8 py-4 text-sm tracking-widest uppercase font-semibold hover:bg-gold-400 transition-colors"
            >
              <Diamond size={16} />
              Explore Collection
            </Link>
          </motion.div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <span className="text-dark-500 text-sm">
                <span className="text-dark-200 font-medium">{wishlist.length}</span>{' '}
                {wishlist.length === 1 ? 'piece' : 'pieces'} saved
              </span>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  wishlist.forEach((wItem) => addToBag(wItem));
                  setCartOpen(true);
                }}
                className="flex items-center gap-2 bg-gold-500 text-dark-900 px-6 py-2.5 text-xs tracking-widest uppercase font-semibold hover:bg-gold-400 transition-colors"
              >
                <ShoppingBag size={14} />
                Add All to Bag
              </motion.button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              <AnimatePresence>
                {wishlist.map((wItem, idx) => (
                  <motion.div
                    key={wItem.id}
                    layout
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, height: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                    className="group"
                  >
                    <div className="relative overflow-hidden bg-dark-800/50 border border-dark-600/30 hover:border-gold-500/30 transition-all duration-500 rounded-sm">
                      <div className="relative aspect-square overflow-hidden">
                        <div
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                          style={{ backgroundImage: `url(${categoryImage[wItem.category]})` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 via-dark-900/20 to-transparent" />
                        </div>

                        {/* Badges */}
                        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
                          {wItem.isNew && (
                            <span className="bg-gold-500 text-dark-900 text-[10px] tracking-widest uppercase px-3 py-1 font-semibold">
                              New
                            </span>
                          )}
                          {wItem.gemstone !== 'None' && (
                            <span className="bg-dark-900/80 backdrop-blur-sm text-gold-400 text-[10px] tracking-widest uppercase px-3 py-1">
                              {wItem.gemstone}
                            </span>
                          )}
                        </div>

                        {/* Remove button */}
                        <div className="absolute top-3 right-3 z-10">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => toggleWishlist(wItem)}
                            className="w-9 h-9 bg-red-400/20 backdrop-blur-sm flex items-center justify-center border border-red-400/40 hover:bg-red-400/30 transition-colors"
                          >
                            <Heart size={16} className="text-red-400 fill-red-400" />
                          </motion.button>
                        </div>

                        {/* Add to bag overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => addToBag(wItem)}
                            className="w-full bg-gold-500 text-dark-900 py-3 text-xs tracking-widest uppercase font-semibold flex items-center justify-center gap-2 hover:bg-gold-400 transition-colors"
                          >
                            <ShoppingBag size={14} />
                            Add to Bag
                          </motion.button>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-dark-500 text-[10px] tracking-widest uppercase">
                            {wItem.category}
                          </span>
                          <div className="flex items-center gap-1">
                            <Star size={10} className="text-gold-500 fill-gold-500" />
                            <span className="text-dark-400 text-xs">{wItem.rating}</span>
                          </div>
                        </div>
                        <h3 className="text-dark-100 font-serif text-base mb-2 group-hover:text-gold-500 transition-colors duration-300">
                          {wItem.name}
                        </h3>
                        <div className="flex items-center justify-between">
                          <span className="text-gold-500 font-semibold text-lg">
                            ${wItem.price.toLocaleString()}
                          </span>
                          <span className="text-dark-500 text-[10px] tracking-wider uppercase">
                            {wItem.metal}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ─── Shop Section ──────────────────────────────────────────────────
function ShopSection() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('q') || '';
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    metals: [],
    gemstones: [],
    priceRanges: [],
    sortBy: 'newest',
  });
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Sync search from URL when it changes
  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q !== searchQuery) setSearchQuery(q);
  }, [searchParams]);

  const activeCount =
    filters.categories.length +
    filters.metals.length +
    filters.gemstones.length +
    filters.priceRanges.length;

  const resetFilters = useCallback(() => {
    setFilters({
      categories: [],
      metals: [],
      gemstones: [],
      priceRanges: [],
      sortBy: 'newest',
    });
  }, []);

  const filteredItems = useMemo(() => {
    let items = [...jewelryItems];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.metal.toLowerCase().includes(q) ||
          item.gemstone.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.heartfeltDescription.toLowerCase().includes(q)
      );
    }

    if (filters.categories.length > 0) {
      items = items.filter((item) => filters.categories.includes(item.category));
    }
    if (filters.metals.length > 0) {
      items = items.filter((item) => filters.metals.includes(item.metal));
    }
    if (filters.gemstones.length > 0) {
      items = items.filter((item) => filters.gemstones.includes(item.gemstone));
    }
    if (filters.priceRanges.length > 0) {
      items = items.filter((item) =>
        filters.priceRanges.some((idx) => {
          const range = priceRanges[idx];
          return item.price >= range.min && item.price < range.max;
        })
      );
    }

    switch (filters.sortBy) {
      case 'price-asc':
        items.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        items.sort((a, b) => b.price - a.price);
        break;
      case 'name-asc':
        items.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        items.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'newest':
        items.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        break;
    }

    return items;
  }, [filters, searchQuery]);

  return (
    <section id="shop" className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <Diamond className="mx-auto text-gold-500/40 mb-4" size={24} />
          <h2 className="font-serif text-4xl md:text-5xl text-dark-100 mb-4">
            Our <span className="shimmer-text">Collection</span>
          </h2>
          <p className="text-dark-400 max-w-xl mx-auto">
            Each piece is meticulously crafted to celebrate life's most precious moments.
          </p>
          <div className="w-24 h-[1px] gold-line mx-auto mt-6" />
        </motion.div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-2 bg-dark-800/50 border border-dark-600/30 px-4 py-2.5 text-sm text-dark-200 hover:text-gold-500 hover:border-gold-500/30 transition-colors shrink-0"
            >
              <SlidersHorizontal size={16} />
              Filters
              {activeCount > 0 && (
                <span className="bg-gold-500 text-dark-900 text-[10px] w-4 h-4 flex items-center justify-center font-semibold">
                  {activeCount}
                </span>
              )}
            </motion.button>
            {/* Search bar */}
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search collection..."
                className="w-full bg-dark-800/50 border border-dark-600/30 text-dark-200 pl-9 pr-8 py-2 text-sm placeholder-dark-600 focus:outline-none focus:border-gold-500/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-600 hover:text-dark-300 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <span className="text-dark-500 text-sm shrink-0">
              Showing <span className="text-dark-200 font-medium">{filteredItems.length}</span>{' '}
              {filteredItems.length === 1 ? 'piece' : 'pieces'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-dark-500 text-sm hidden sm:inline">Sort by</span>
            <div className="relative">
              <select
                value={filters.sortBy}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, sortBy: e.target.value as SortOption }))
                }
                className="appearance-none bg-dark-800/50 border border-dark-600/30 text-dark-200 text-sm px-4 py-2.5 pr-10 cursor-pointer hover:border-gold-500/30 transition-colors focus:outline-none focus:border-gold-500/50"
              >
                <option value="newest">Newest First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name-asc">Name: A to Z</option>
                <option value="name-desc">Name: Z to A</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Active Filter Tags */}
        <AnimatePresence>
          {activeCount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-2 mb-6 overflow-hidden"
            >
              {filters.categories.map((cat) => (
                <FilterTag
                  key={cat}
                  label={cat}
                  onRemove={() =>
                    setFilters((prev) => ({
                      ...prev,
                      categories: prev.categories.filter((c) => c !== cat),
                    }))
                  }
                />
              ))}
              {filters.metals.map((metal) => (
                <FilterTag
                  key={metal}
                  label={metal}
                  onRemove={() =>
                    setFilters((prev) => ({
                      ...prev,
                      metals: prev.metals.filter((m) => m !== metal),
                    }))
                  }
                />
              ))}
              {filters.gemstones.map((gem) => (
                <FilterTag
                  key={gem}
                  label={gem === 'None' ? 'No Gemstone' : gem}
                  onRemove={() =>
                    setFilters((prev) => ({
                      ...prev,
                      gemstones: prev.gemstones.filter((g) => g !== gem),
                    }))
                  }
                />
              ))}
              {filters.priceRanges.map((idx) => (
                <FilterTag
                  key={idx}
                  label={priceRanges[idx].label}
                  onRemove={() =>
                    setFilters((prev) => ({
                      ...prev,
                      priceRanges: prev.priceRanges.filter((i) => i !== idx),
                    }))
                  }
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex gap-8">
          <FilterSidebar
            filters={filters}
            setFilters={setFilters}
            onReset={resetFilters}
            activeCount={activeCount}
            mobileOpen={mobileFilterOpen}
            setMobileOpen={setMobileFilterOpen}
          />

          <div className="flex-1 min-w-0">
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 sm:gap-6">
              <AnimatePresence mode="popLayout">
                {filteredItems.map((item, idx) => (
                  <ProductCard key={item.id} item={item} index={idx} />
                ))}
              </AnimatePresence>
            </motion.div>

            {filteredItems.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <Diamond className="mx-auto text-dark-600 mb-4" size={48} />
                <h3 className="font-serif text-xl text-dark-300 mb-2">No pieces found</h3>
                <p className="text-dark-500 text-sm mb-6">
                  Try adjusting your filters to discover more treasures.
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={resetFilters}
                  className="bg-dark-800/50 border border-dark-600/30 text-dark-200 px-6 py-3 text-sm tracking-widest uppercase hover:border-gold-500/30 hover:text-gold-500 transition-colors"
                >
                  Reset Filters
                </motion.button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="flex items-center gap-2 bg-gold-500/10 border border-gold-500/20 px-3 py-1.5 text-gold-400 text-xs tracking-wider"
    >
      {label}
      <button onClick={onRemove} className="hover:text-gold-300 transition-colors">
        <X size={12} />
      </button>
    </motion.div>
  );
}

// ─── Trending Carousel ─────────────────────────────────────────────
function TrendingCarousel() {
  const [page, setPage] = useState(0);
  const totalPages = 4;
  const itemsPerPage = 4;

  // Pick 16 trending items (prioritize new + highest rated)
  const trendingItems = useMemo(() => {
    return [...jewelryItems]
      .sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || b.rating - a.rating)
      .slice(0, 16);
  }, []);

  const currentItems = trendingItems.slice(page * itemsPerPage, (page + 1) * itemsPerPage);

  // Auto-cycle every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPage((prev) => (prev + 1) % totalPages);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 px-6 bg-dark-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-14"
        >
          <p className="text-gold-500 text-xs tracking-[0.5em] uppercase mb-4">Curated for You</p>
          <h2 className="font-serif text-4xl md:text-5xl text-dark-100 mb-4">
            Trending <span className="shimmer-text">Now</span>
          </h2>
          <p className="text-dark-400 max-w-lg mx-auto">
            The pieces our clients are falling in love with this season — each one a timeless treasure.
          </p>
          <div className="w-24 h-[1px] gold-line mx-auto mt-6" />
        </motion.div>

        {/* Items Grid */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
            >
              {currentItems.map((item, idx) => (
                <TrendingCard key={item.id} item={item} index={idx} />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dot Indicators */}
        <div className="flex items-center justify-center gap-3 mt-10">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className="group relative flex items-center justify-center"
              aria-label={`Go to page ${i + 1}`}
            >
              <motion.span
                animate={{
                  width: page === i ? 28 : 10,
                  backgroundColor: page === i ? '#c9a96e' : '#505050',
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="block h-[10px] rounded-full"
              />
            </button>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Link
            to="/collection"
            className="inline-flex items-center gap-2 border border-gold-500/40 text-gold-500 px-8 py-4 text-sm tracking-widest uppercase font-semibold hover:bg-gold-500/10 transition-colors"
          >
            View Full Collection
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function TrendingCard({ item, index }: { item: JewelryItem; index: number }) {
  const [hovered, setHovered] = useState(false);
  const [added, setAdded] = useState(false);
  const { addToBag } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { setSelectedProduct } = useProductDetail();

  const liked = isInWishlist(item.id);

  const categoryImage: Record<string, string> = {
    Rings: '/images/ring.jpg',
    Necklaces: '/images/necklace.jpg',
    Bracelets: '/images/bracelet.jpg',
    Earrings: '/images/earrings.jpg',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="group cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setSelectedProduct(item)}
    >
      <div className="relative overflow-hidden bg-dark-800/50 border border-dark-600/30 hover:border-gold-500/30 transition-all duration-500 rounded-sm">
        <div className="relative aspect-square overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
            style={{ backgroundImage: `url(${categoryImage[item.category]})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 via-dark-900/20 to-transparent" />
          </div>

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-10">
            {item.isNew && (
              <span className="bg-gold-500 text-dark-900 text-[9px] tracking-widest uppercase px-2 py-0.5 font-semibold">
                New
              </span>
            )}
          </div>

          {/* Heart */}
          <div className="absolute top-2 right-2 z-10">
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: hovered ? 1 : 0 }}
              onClick={(e) => { e.stopPropagation(); toggleWishlist(item); }}
              className={`w-8 h-8 backdrop-blur-sm flex items-center justify-center border transition-all duration-200 ${
                liked
                  ? 'bg-red-400/20 border-red-400/40 opacity-100'
                  : 'bg-dark-900/70 border-dark-600/30 hover:bg-gold-500/20'
              }`}
            >
              <Heart size={14} className={liked ? 'text-red-400 fill-red-400' : 'text-dark-200'} />
            </motion.button>
          </div>

          {/* Add to bag overlay */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 15 }}
            transition={{ duration: 0.25 }}
            className="absolute bottom-0 left-0 right-0 p-3 z-10"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                addToBag(item);
                setAdded(true);
                setTimeout(() => setAdded(false), 1200);
              }}
              className={`w-full py-2.5 text-[10px] tracking-widest uppercase font-semibold flex items-center justify-center gap-1.5 transition-all duration-300 ${
                added
                  ? 'bg-green-500 text-white'
                  : 'bg-gold-500 text-dark-900 hover:bg-gold-400'
              }`}
            >
              {added ? (
                <><Check size={12} /> Added!</>
              ) : (
                <><ShoppingBag size={12} /> Add to Bag</>
              )}
            </button>
          </motion.div>
        </div>

        {/* Info */}
        <div className="p-3">
          <span className="text-dark-500 text-[9px] tracking-widest uppercase">{item.category}</span>
          <h3 className="text-dark-100 font-serif text-sm mt-0.5 mb-1 group-hover:text-gold-500 transition-colors truncate">
            {item.name}
          </h3>
          <span className="text-gold-500 font-semibold text-sm">${item.price.toLocaleString()}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Feature Strip ─────────────────────────────────────────────────
function FeatureStrip() {
  const features = [
    { icon: <Diamond size={20} />, title: 'Ethically Sourced', desc: 'Conflict-free gemstones' },
    { icon: <Sparkles size={20} />, title: 'Handcrafted', desc: 'Master artisan quality' },
    { icon: <Star size={20} />, title: 'Lifetime Warranty', desc: 'Forever guaranteed' },
    { icon: <Heart size={20} />, title: 'Gift Wrapping', desc: 'Luxury presentation' },
  ];

  return (
    <section className="py-16 border-y border-dark-600/20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-gold-500/60 mx-auto mb-3 flex justify-center">{f.icon}</div>
              <h4 className="text-dark-100 text-sm font-medium tracking-wider uppercase mb-1">
                {f.title}
              </h4>
              <p className="text-dark-500 text-xs">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Newsletter ────────────────────────────────────────────────────
function SparkleParticle({ x, y }: { x: number; y: number }) {
  const angle = Math.random() * 360;
  const distance = 40 + Math.random() * 60;
  const dx = Math.cos((angle * Math.PI) / 180) * distance;
  const dy = Math.sin((angle * Math.PI) / 180) * distance;
  const size = 4 + Math.random() * 6;
  const colors = ['#c9a96e', '#f2d89e', '#e8bc5f', '#ffffff', '#d4a44a'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const duration = 0.6 + Math.random() * 0.4;

  return (
    <motion.div
      initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      animate={{ opacity: 0, scale: 0, x: dx, y: dy }}
      transition={{ duration, ease: 'easeOut' }}
      className="absolute pointer-events-none"
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: '50%',
        boxShadow: `0 0 ${size * 2}px ${color}`,
      }}
    />
  );
}

function CouponPopup({ onClose }: { onClose: () => void }) {
  const code = 'VISION10';
  const [copied, setCopied] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-dark-900/90 backdrop-blur-sm z-[80]"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="fixed inset-0 z-[90] flex items-center justify-center p-6 pointer-events-none"
      >
        <div
          className="bg-dark-800 border border-gold-500/30 max-w-md w-full p-8 text-center relative pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-dark-500 hover:text-gold-500 transition-colors"
          >
            <X size={18} />
          </button>

          {/* Confetti sparkles */}
          {Array.from({ length: 20 }).map((_, i) => {
            const colors = ['#c9a96e', '#f2d89e', '#e8bc5f', '#ffffff'];
            const c = colors[i % colors.length];
            const ox = -120 + Math.random() * 240;
            const oy = -120 + Math.random() * 240;
            const d = 1 + Math.random() * 2;
            const delay = Math.random() * 0.5;
            const s = 3 + Math.random() * 5;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                animate={{ opacity: [1, 1, 0], scale: [0, 1, 0], x: ox, y: oy }}
                transition={{ duration: d, delay, ease: 'easeOut' }}
                className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
                style={{
                  width: s,
                  height: s,
                  backgroundColor: c,
                  boxShadow: `0 0 ${s * 2}px ${c}`,
                }}
              />
            );
          })}

          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Sparkles className="mx-auto text-gold-500 mb-4" size={28} />
            <p className="text-gold-500 text-xs tracking-[0.5em] uppercase mb-2">Secret Discovered</p>
            <h3 className="font-serif text-3xl text-dark-100 mb-2">10% Off</h3>
            <p className="text-dark-400 text-sm mb-6">
              A hidden gem deserves a hidden reward. Enjoy 10% off your next order.
            </p>

            <div className="bg-dark-900/60 border-2 border-dashed border-gold-500/40 p-4 mb-6 relative">
              <p className="text-dark-500 text-[10px] tracking-widest uppercase mb-1">Your Code</p>
              <p className="text-gold-500 font-mono text-2xl tracking-[0.3em] font-bold">{code}</p>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                navigator.clipboard.writeText(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className={`px-8 py-3 text-sm tracking-widest uppercase font-semibold transition-all duration-300 ${
                copied
                  ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                  : 'bg-gold-500 text-dark-900 hover:bg-gold-400'
              }`}
            >
              {copied ? (
                <span className="flex items-center gap-2"><Check size={14} /> Copied!</span>
              ) : (
                'Copy Code'
              )}
            </motion.button>

            <Link
              to="/collection"
              onClick={onClose}
              className="block mt-4 text-dark-400 text-xs tracking-wider hover:text-gold-500 transition-colors"
            >
              Shop the Collection →
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}

function Newsletter() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [showCoupon, setShowCoupon] = useState(false);
  const [diamondGlow, setDiamondGlow] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const handleDiamondClick = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Spawn particles
    const newParticles = Array.from({ length: 12 }).map((_, i) => ({
      id: Date.now() + i,
      x,
      y,
    }));
    setParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 1200);

    // Shake effect
    setShakeKey((prev) => prev + 1);
    setDiamondGlow(true);
    setTimeout(() => setDiamondGlow(false), 400);

    const newCount = clickCount + 1;
    setClickCount(newCount);

    if (newCount >= 3) {
      setTimeout(() => setShowCoupon(true), 500);
      setClickCount(0);
    }
  };

  return (
    <section className="py-20 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="relative inline-block mb-4" onClick={handleDiamondClick} style={{ cursor: 'pointer' }}>
            <motion.div
              key={shakeKey}
              animate={shakeKey > 0 ? {
                rotate: [0, -12, 12, -8, 8, 0],
                scale: [1, 1.2, 1],
              } : {}}
              transition={{ duration: 0.5 }}
              className={`transition-all duration-300 relative ${diamondGlow ? 'drop-shadow-[0_0_20px_rgba(201,169,110,0.6)]' : ''}`}
            >
              <Diamond
                className={`transition-colors duration-300 ${
                  clickCount === 0
                    ? 'text-gold-500/40 hover:text-gold-500/60'
                    : clickCount === 1
                      ? 'text-gold-500/70'
                      : 'text-gold-500'
                }`}
                size={24}
              />
            </motion.div>
            {particles.map((p) => (
              <SparkleParticle key={p.id} x={p.x} y={p.y} />
            ))}
            {clickCount > 0 && clickCount < 3 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex gap-1"
              >
                {Array.from({ length: clickCount }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-1.5 h-1.5 rounded-full bg-gold-500"
                  />
                ))}
                {Array.from({ length: 3 - clickCount }).map((_, i) => (
                  <div key={`e-${i}`} className="w-1.5 h-1.5 rounded-full bg-dark-600/40" />
                ))}
              </motion.div>
            )}
          </div>
          <h2 className="font-serif text-3xl md:text-4xl text-dark-100 mb-4 mt-2">
            Stay <span className="shimmer-text">Radiant</span>
          </h2>
          <p className="text-dark-400 mb-8">
            Be the first to discover new collections, exclusive offers, and the stories behind our creations.
          </p>
          {!submitted ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                className="flex-1 bg-dark-800/50 border border-dark-600/30 text-dark-200 px-5 py-3.5 text-sm placeholder-dark-500 focus:outline-none focus:border-gold-500/50 transition-colors"
              />
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (email) setSubmitted(true);
                }}
                className="bg-gold-500 text-dark-900 px-8 py-3.5 text-sm tracking-widest uppercase font-semibold hover:bg-gold-400 transition-colors shrink-0"
              >
                Subscribe
              </motion.button>
            </div>
          ) : (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-gold-500 font-serif text-lg"
            >
              Thank you for joining the VISION WRLD family.
            </motion.p>
          )}
        </motion.div>
      </div>

      {/* Coupon popup */}
      <AnimatePresence>
        {showCoupon && <CouponPopup onClose={() => setShowCoupon(false)} />}
      </AnimatePresence>
    </section>
  );
}

// ─── Track Order ───────────────────────────────────────────────────
function TrackOrder() {
  const { orders, getOrder } = useOrders();
  const [searchId, setSearchId] = useState('');
  const [foundOrder, setFoundOrder] = useState<Order | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = () => {
    const order = getOrder(searchId.trim().toUpperCase());
    setFoundOrder(order || null);
    setSearched(true);
  };

  const categoryImage: Record<string, string> = {
    Rings: '/images/ring.jpg',
    Necklaces: '/images/necklace.jpg',
    Bracelets: '/images/bracelet.jpg',
    Earrings: '/images/earrings.jpg',
  };

  const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    confirmed: { icon: <Check size={18} />, color: 'text-green-400', label: 'Order Confirmed' },
    crafting: { icon: <Diamond size={18} />, color: 'text-gold-500', label: 'Being Crafted' },
    shipped: { icon: <Truck size={18} />, color: 'text-blue-400', label: 'Shipped' },
    delivered: { icon: <Package size={18} />, color: 'text-green-400', label: 'Delivered' },
  };

  const allSteps = ['confirmed', 'crafting', 'shipped', 'delivered'] as const;

  return (
    <section className="py-24 px-6 min-h-[80vh]">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-14"
        >
          <Package className="mx-auto text-gold-500/40 mb-4" size={28} />
          <h2 className="font-serif text-4xl md:text-5xl text-dark-100 mb-4">
            Track Your <span className="shimmer-text">Order</span>
          </h2>
          <p className="text-dark-400 max-w-lg mx-auto">
            Enter your order number to check the status of your precious piece.
          </p>
          <div className="w-24 h-[1px] gold-line mx-auto mt-6" />
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-xl mx-auto mb-16"
        >
          <div className="flex gap-3">
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter order number (e.g. AUR-XXXXX)"
              className="flex-1 bg-dark-800/50 border border-dark-600/30 text-dark-200 px-5 py-4 text-sm placeholder-dark-500 focus:outline-none focus:border-gold-500/50 transition-colors"
            />
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSearch}
              className="bg-gold-500 text-dark-900 px-8 py-4 text-sm tracking-widest uppercase font-semibold hover:bg-gold-400 transition-colors shrink-0"
            >
              Track
            </motion.button>
          </div>

          {/* Recent orders hint */}
          {orders.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 items-center">
              <span className="text-dark-500 text-xs">Recent orders:</span>
              {orders.slice(-3).reverse().map((o) => (
                <button
                  key={o.id}
                  onClick={() => { setSearchId(o.id); const order = getOrder(o.id); setFoundOrder(order || null); setSearched(true); }}
                  className="text-gold-500/70 hover:text-gold-500 text-xs font-mono border border-dark-600/30 px-2 py-1 hover:border-gold-500/30 transition-colors"
                >
                  {o.id}
                </button>
              ))}
            </div>
          )}

          {/* Not Found */}
          {searched && !foundOrder && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 text-center py-8"
            >
              <Package className="mx-auto text-dark-600 mb-3" size={36} />
              <p className="text-dark-400 text-sm">No order found with that number.</p>
              <p className="text-dark-600 text-xs mt-1">Please check your order number and try again.</p>
            </motion.div>
          )}
        </motion.div>

        {/* Order Result */}
        <AnimatePresence>
          {foundOrder && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
            >
              {/* Order Header */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                <div>
                  <p className="text-dark-500 text-xs tracking-wider uppercase mb-1">Order</p>
                  <p className="text-gold-500 font-mono text-xl font-semibold">#{foundOrder.id}</p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-dark-500 text-xs tracking-wider uppercase mb-1">Placed on</p>
                  <p className="text-dark-200 text-sm">{foundOrder.date}</p>
                </div>
              </div>

              {/* Status Timeline */}
              <div className="bg-dark-800/50 border border-dark-600/30 p-6 md:p-8 mb-8">
                <h3 className="text-dark-200 text-xs tracking-widest uppercase font-medium mb-8">Order Status</h3>

                <div className="relative">
                  {/* Progress bar */}
                  <div className="hidden md:block absolute top-5 left-5 right-5 h-0.5 bg-dark-600/30">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(allSteps.indexOf(foundOrder.status) / 3) * 100}%`,
                      }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className="h-full bg-gold-500"
                    />
                  </div>

                  <div className="flex justify-between relative">
                    {allSteps.map((s, idx) => {
                      const isDone = allSteps.indexOf(foundOrder.status) >= idx;
                      const isCurrent = foundOrder.status === s;
                      const config = statusConfig[s];
                      return (
                        <div key={s} className="flex flex-col items-center text-center flex-1">
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.3 + idx * 0.15 }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 relative z-10 ${
                              isCurrent
                                ? 'bg-gold-500 border-gold-500 text-dark-900'
                                : isDone
                                  ? 'bg-gold-500/20 border-gold-500/60 text-gold-500'
                                  : 'bg-dark-800 border-dark-600/30 text-dark-600'
                            }`}
                          >
                            {isCurrent ? config.icon : isDone ? <Check size={16} /> : <span className="text-xs font-mono">{idx + 1}</span>}
                          </motion.div>
                          <span className={`text-[10px] tracking-wider uppercase mt-3 ${isCurrent ? 'text-gold-500 font-medium' : isDone ? 'text-dark-300' : 'text-dark-600'}`}>
                            {config.label}
                          </span>
                          {isCurrent && foundOrder.trackingSteps.length > 0 && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 1 }}
                              className="text-dark-500 text-[9px] mt-1"
                            >
                              {foundOrder.trackingSteps.find((ts) => ts.label.toLowerCase().includes(s))?.date || ''}
                            </motion.span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Estimated Delivery */}
                <div className="mt-8 pt-6 border-t border-dark-600/20 flex items-center gap-3">
                  <Clock size={16} className="text-gold-500" />
                  <div>
                    <p className="text-dark-200 text-sm">Estimated Delivery</p>
                    <p className="text-gold-500 font-medium">{foundOrder.estimatedDelivery}</p>
                  </div>
                </div>
              </div>

              {/* Order Details Grid */}
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Items */}
                <div className="bg-dark-800/50 border border-dark-600/30 p-6">
                  <h4 className="text-dark-200 text-xs tracking-widest uppercase font-medium mb-4">Items</h4>
                  <div className="space-y-3">
                    {foundOrder.items.map((item, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div
                          className="w-14 h-14 shrink-0 bg-cover bg-center border border-dark-600/20"
                          style={{ backgroundImage: `url(${categoryImage[item.category] || '/images/hero.jpg'})` }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-dark-100 text-sm truncate">{item.name}</p>
                          <p className="text-dark-500 text-xs">Qty: {item.quantity}</p>
                        </div>
                        <span className="text-gold-500 text-sm font-semibold">${(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-dark-600/20 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-dark-500">Subtotal</span>
                      <span className="text-dark-300">${foundOrder.subtotal.toLocaleString()}</span>
                    </div>
                    {(foundOrder.discount || 0) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-dark-500">Promo{foundOrder.promoCode ? ` (${foundOrder.promoCode})` : ''}</span>
                        <span className="text-green-400">-${(foundOrder.discount || 0).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-dark-500">Shipping</span>
                      <span className="text-green-400">Free</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-dark-500">Tax</span>
                      <span className="text-dark-300">${foundOrder.tax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-dark-200 text-sm font-medium">Total</span>
                      <span className="text-gold-500 font-semibold">${foundOrder.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Shipping Info */}
                <div className="bg-dark-800/50 border border-dark-600/30 p-6">
                  <h4 className="text-dark-200 text-xs tracking-widest uppercase font-medium mb-4">Shipping Details</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-dark-100">{foundOrder.shipping.firstName} {foundOrder.shipping.lastName}</p>
                      <p className="text-dark-400 text-xs">{foundOrder.shipping.address}</p>
                      <p className="text-dark-400 text-xs">{foundOrder.shipping.city}, {foundOrder.shipping.state} {foundOrder.shipping.zip}</p>
                    </div>
                    <div className="w-full h-px bg-dark-600/20" />
                    <div>
                      <p className="text-dark-500 text-[10px] tracking-wider uppercase">Email</p>
                      <p className="text-dark-300 text-xs">{foundOrder.shipping.email}</p>
                    </div>
                    <div>
                      <p className="text-dark-500 text-[10px] tracking-wider uppercase">Phone</p>
                      <p className="text-dark-300 text-xs">{foundOrder.shipping.phone}</p>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-dark-600/20">
                    <h4 className="text-dark-200 text-xs tracking-widest uppercase font-medium mb-3">Activity Log</h4>
                    <div className="space-y-3">
                      {foundOrder.trackingSteps.map((ts, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ts.done ? 'bg-gold-500' : 'bg-dark-600'}`} />
                          <div>
                            <p className={`text-xs ${ts.done ? 'text-dark-200' : 'text-dark-500'}`}>{ts.label}</p>
                            <p className="text-dark-600 text-[10px]">{ts.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tracking Note */}
              <div className="bg-gold-500/5 border border-gold-500/15 p-5 flex items-start gap-3">
                <Sparkles size={16} className="text-gold-500 shrink-0 mt-0.5" />
                <p className="text-dark-400 text-xs leading-relaxed">
                  Each piece is handcrafted to order in our atelier. Your jewelry will be carefully inspected,
                  polished, and placed in our signature presentation box before shipping. You will receive
                  an email with tracking details once your order ships.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

// ─── Contact Section ───────────────────────────────────────────────
function ContactSection() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    type: 'appointment',
    date: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');

    const templateParams = {
      from_name: `${form.firstName} ${form.lastName}`,
      from_email: form.email,
      phone: form.phone,
      enquiry_type: form.type === 'appointment' ? 'Book Appointment' : form.type === 'bespoke' ? 'Bespoke Design' : form.type === 'repair' ? 'Repair & Care' : 'General Enquiry',
      preferred_date: form.date || 'Not specified',
      message: form.message,
    };

    emailjs.send('service_b0se7r7', 'template_zj02gm3', templateParams, 'SgSvoVyvuqYNxmcyx')
      .then(() => {
        setSending(false);
        setSubmitted(true);
      })
      .catch(() => {
        setSending(false);
        setError('Something went wrong. Please try again or email us directly at hello@visionwrld.com');
      });
  };

  const contactMethods = [
    {
      icon: <Diamond size={22} />,
      title: 'Visit Our Atelier',
      lines: ['42 Place Vendôme', 'Paris, 75001', 'France'],
    },
    {
      icon: <Star size={22} />,
      title: 'Call Us',
      lines: ['+33 1 42 60 15 00', 'Mon – Sat: 10:00 – 19:00', 'Sun: By appointment'],
    },
    {
      icon: <Sparkles size={22} />,
      title: 'Email',
      lines: ['hello@visionwrld.com', 'We respond within 24 hours'],
    },
  ];

  return (
    <section className="py-0 min-h-screen">
      {/* Hero banner */}
      <div className="relative h-[50vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/images/about.jpg)' }} />
        <div className="absolute inset-0 bg-dark-900/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/30 to-transparent" />

        <div className="relative z-10 text-center px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
            <div className="w-16 h-[1px] gold-line mx-auto mb-6" />
            <h2 className="font-serif text-4xl md:text-6xl text-dark-100 mb-4">
              Get in <span className="shimmer-text">Touch</span>
            </h2>
            <p className="text-dark-300 text-lg max-w-2xl mx-auto font-light">
              Whether you seek a bespoke creation or a private viewing, we are here for you.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Contact Methods */}
      <div className="py-20 px-6 bg-dark-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            {contactMethods.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="bg-dark-800/50 border border-dark-600/20 p-8 text-center hover:border-gold-500/20 transition-all duration-500"
              >
                <div className="text-gold-500/60 flex justify-center mb-4">{m.icon}</div>
                <h3 className="text-dark-100 font-serif text-lg mb-3">{m.title}</h3>
                {m.lines.map((line, j) => (
                  <p key={j} className="text-dark-400 text-sm">{line}</p>
                ))}
              </motion.div>
            ))}
          </div>

          {/* Form */}
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="text-center mb-12">
                  <p className="text-gold-500 text-xs tracking-[0.5em] uppercase mb-4">We'd Love to Hear From You</p>
                  <h3 className="font-serif text-3xl md:text-4xl text-dark-100">Send Us a Message</h3>
                </div>

                <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <ContactInput label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} required />
                    <ContactInput label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} required />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <ContactInput label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
                    <ContactInput label="Phone" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                  </div>

                  {/* Enquiry type */}
                  <div className="mb-4">
                    <label className="text-dark-400 text-[10px] tracking-widest uppercase block mb-2">Enquiry Type</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'appointment', label: 'Book Appointment' },
                        { value: 'bespoke', label: 'Bespoke Design' },
                        { value: 'repair', label: 'Repair & Care' },
                        { value: 'general', label: 'General Enquiry' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm({ ...form, type: opt.value })}
                          className={`px-4 py-2 text-xs tracking-wider border transition-all duration-200 ${
                            form.type === opt.value
                              ? 'border-gold-500 text-gold-500 bg-gold-500/10'
                              : 'border-dark-600/30 text-dark-400 hover:border-gold-500/30 hover:text-dark-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preferred date (for appointments) */}
                  {(form.type === 'appointment' || form.type === 'bespoke') && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4"
                    >
                      <ContactInput label="Preferred Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
                    </motion.div>
                  )}

                  {/* Message */}
                  <div className="mb-8">
                    <label className="text-dark-400 text-[10px] tracking-widest uppercase block mb-2">Your Message</label>
                    <textarea
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      rows={5}
                      placeholder="Tell us how we can help..."
                      className="w-full bg-dark-800/50 border border-dark-600/30 text-dark-200 px-4 py-3 text-sm placeholder-dark-600 focus:outline-none focus:border-gold-500/50 transition-colors resize-none"
                      required
                    />
                  </div>

                  {/* Error message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center text-red-400 text-sm mb-4"
                    >
                      {error}
                    </motion.div>
                  )}

                  <div className="text-center">
                    <motion.button
                      type="submit"
                      whileHover={sending ? {} : { scale: 1.03, boxShadow: '0 0 30px rgba(201,169,110,0.3)' }}
                      whileTap={sending ? {} : { scale: 0.97 }}
                      disabled={sending}
                      className={`px-12 py-4 text-sm tracking-widest uppercase font-semibold inline-flex items-center gap-2 transition-colors ${
                        sending
                          ? 'bg-dark-600/50 text-dark-400 cursor-not-allowed'
                          : 'bg-gold-500 text-dark-900 hover:bg-gold-400'
                      }`}
                    >
                      {sending ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-4 h-4 border-2 border-dark-400 border-t-transparent rounded-full"
                          />
                          Sending...
                        </>
                      ) : (
                        <>
                          <ArrowRight size={16} />
                          Send Message
                        </>
                      )}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16 max-w-lg mx-auto"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-20 h-20 bg-gold-500/10 border border-gold-500/30 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  <Check size={32} className="text-gold-500" />
                </motion.div>
                <h3 className="font-serif text-3xl text-dark-100 mb-4">Message Received</h3>
                <p className="text-dark-300 text-sm leading-relaxed mb-2">
                  Thank you for reaching out to us. Your enquiry has been received with the utmost care.
                </p>
                <p className="text-dark-400 text-sm leading-relaxed mb-8">
                  {form.type === 'appointment'
                    ? 'Our concierge team will confirm your appointment within a few hours. We look forward to welcoming you.'
                    : form.type === 'bespoke'
                      ? 'Our design team will review your vision and reach out to begin this beautiful journey together.'
                      : 'A member of our team will respond to you within 24 hours.'
                  }
                </p>
                <p className="text-dark-500 text-xs italic">
                  "Every great creation begins with a single conversation."
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function ContactInput({ label, type = 'text', value, onChange, required = false }: { label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="text-dark-400 text-[10px] tracking-widest uppercase block mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full bg-dark-800/50 border border-dark-600/30 text-dark-200 px-4 py-3 text-sm placeholder-dark-600 focus:outline-none focus:border-gold-500/50 transition-colors"
        placeholder={label}
      />
    </div>
  );
}

// ─── Footer ────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-dark-600/20 py-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-1">
            <h3 className="font-serif text-2xl tracking-[0.3em] text-gold-500 mb-4">VISION WRLD</h3>
            <p className="text-dark-500 text-sm leading-relaxed">
              Crafting extraordinary jewelry since 1892. Each piece is a testament to timeless elegance and
              exceptional artistry.
            </p>
          </div>
          <div>
            <h4 className="text-dark-100 text-xs tracking-widest uppercase mb-4 font-medium">Collections</h4>
            <ul className="space-y-2">
              {['Rings', 'Necklaces', 'Bracelets', 'Earrings'].map((item) => (
                <li key={item}>
                  <Link to="/collection" className="text-dark-500 text-sm hover:text-gold-500 transition-colors">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-dark-100 text-xs tracking-widest uppercase mb-4 font-medium">Company</h4>
            <ul className="space-y-2">
              {['About Us', 'Our Story', 'Careers', 'Press'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-dark-500 text-sm hover:text-gold-500 transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-dark-100 text-xs tracking-widest uppercase mb-4 font-medium">Support</h4>
            <ul className="space-y-2">
              {['Contact Us', 'Shipping', 'Returns', 'Size Guide'].map((item) => (
                <li key={item}>
                  {item === 'Contact Us' ? (
                    <Link to="/contact" className="text-dark-500 text-sm hover:text-gold-500 transition-colors">
                      {item}
                    </Link>
                  ) : (
                    <a href="#" className="text-dark-500 text-sm hover:text-gold-500 transition-colors">
                      {item}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-dark-600/20 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-dark-600 text-xs tracking-wider">
            © 2024 VISION WRLD Fine Jewelry. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            {['Privacy', 'Terms', 'Cookies'].map((item) => (
              <a
                key={item}
                href="#"
                className="text-dark-600 text-xs hover:text-gold-500 transition-colors tracking-wider"
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── App ───────────────────────────────────────────────────────────
export default function App() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlist, setWishlist] = useState<JewelryItem[]>([]);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<JewelryItem | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  // Cart functions
  const addToBag = useCallback((item: JewelryItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  }, []);

  const removeFromBag = useCallback((itemId: number) => {
    setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: number, delta: number) => {
    setCart((prev) => {
      const updated = prev.map((c) => {
        if (c.item.id === itemId) {
          const newQty = c.quantity + delta;
          return newQty > 0 ? { ...c, quantity: newQty } : c;
        }
        return c;
      });
      return updated.filter((c) => !(c.item.id === itemId && c.quantity + delta < 1));
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  // Order functions
  const placeOrder = useCallback((orderData: Omit<Order, 'status' | 'estimatedDelivery' | 'trackingSteps'>): string => {
    const id = 'AUR-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const now = new Date();
    const deliveryDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const order: Order = {
      ...orderData,
      id,
      status: 'confirmed',
      estimatedDelivery: deliveryDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      trackingSteps: [
        { label: 'Order Confirmed', date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), done: true },
        { label: 'Being Crafted', date: 'In progress', done: false },
        { label: 'Shipped', date: 'Pending', done: false },
        { label: 'Delivered', date: deliveryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), done: false },
      ],
    };
    setOrders((prev) => [...prev, order]);
    return id;
  }, []);

  const getOrder = useCallback((id: string) => orders.find((o) => o.id === id), [orders]);

  const orderValue = useMemo(() => ({ orders, placeOrder, getOrder }), [orders, placeOrder, getOrder]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0),
    [cart]
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, c) => sum + c.quantity, 0),
    [cart]
  );

  const cartValue = useMemo(
    () => ({
      cart,
      addToBag,
      removeFromBag,
      updateQuantity,
      clearCart,
      cartTotal,
      cartCount,
      cartOpen,
      setCartOpen,
    }),
    [cart, cartTotal, cartCount, cartOpen, addToBag, removeFromBag, updateQuantity, clearCart]
  );

  // Wishlist functions
  const toggleWishlist = useCallback((item: JewelryItem) => {
    setWishlist((prev) => {
      const exists = prev.find((w) => w.id === item.id);
      if (exists) {
        return prev.filter((w) => w.id !== item.id);
      }
      return [...prev, item];
    });
  }, []);

  const isInWishlist = useCallback(
    (itemId: number) => wishlist.some((w) => w.id === itemId),
    [wishlist]
  );

  const wishlistCount = wishlist.length;

  const wishlistValue = useMemo(
    () => ({
      wishlist,
      toggleWishlist,
      isInWishlist,
      wishlistCount,
      wishlistOpen,
      setWishlistOpen,
    }),
    [wishlist, isInWishlist, wishlistCount, wishlistOpen, toggleWishlist]
  );

  return (
    <CartContext.Provider value={cartValue}>
      <WishlistContext.Provider value={wishlistValue}>
        <ProductDetailContext.Provider value={{ selectedProduct, setSelectedProduct }}>
          <OrderContext.Provider value={orderValue}>
            <HashRouter>
              <div className="bg-dark-900 min-h-screen">
                <AppLayout />
              </div>
            </HashRouter>
          </OrderContext.Provider>
        </ProductDetailContext.Provider>
      </WishlistContext.Provider>
    </CartContext.Provider>
  );
}
