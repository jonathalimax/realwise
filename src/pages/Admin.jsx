import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Settings,
  DollarSign,
  Image,
  Tag,
  CreditCard,
  LogOut,
  Save,
  Plus,
  Trash2,
  Shield,
  Loader2,
  Check,
  X,
  FileText,
  MessageSquare,
  Heart,
  HelpCircle,
  Home,
  ChevronDown,
  ChevronUp,
  BarChart3
} from 'lucide-react';

const ADMIN_EMAIL = 'jonathalimax@gmail.com';

// Collapsible section component
function Section({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <span className="font-semibold text-slate-900 dark:text-white">{title}</span>
        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>
      {isOpen && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

// Field component for PT/EN inputs
function TranslationField({ label, ptValue, enValue, onPtChange, onEnChange, multiline = false }) {
  const InputComponent = multiline ? Textarea : Input;
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">{label} (PT)</label>
        <InputComponent
          value={ptValue || ''}
          onChange={(e) => onPtChange(e.target.value)}
          className="rounded-lg"
          placeholder={`${label} em português`}
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">{label} (EN)</label>
        <InputComponent
          value={enValue || ''}
          onChange={(e) => onEnChange(e.target.value)}
          className="rounded-lg"
          placeholder={`${label} in English`}
        />
      </div>
    </div>
  );
}

export default function Admin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // CMS States
  const [pricing, setPricing] = useState({
    price: 99,
    currency: 'BRL',
    discountPercent: 0,
    discountEndDate: '',
    discountActive: false
  });

  const [pix, setPix] = useState({
    key: '',
    keyType: 'email',
    qrCodeUrl: '',
    beneficiary: ''
  });

  const [coupons, setCoupons] = useState([]);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discountPercent: 10,
    maxUses: 100,
    expiresAt: '',
    active: true
  });

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsStats, setAnalyticsStats] = useState({
    totalEvents: 0,
    uniqueSessions: 0,
    pageViews: 0,
    ctaClicks: 0,
    purchases: 0
  });

  // All content translations
  const [content, setContent] = useState({
    // Hero
    hero_badge_pt: '', hero_badge_en: '',
    hero_headline1_pt: '', hero_headline1_en: '',
    hero_headline2_pt: '', hero_headline2_en: '',
    hero_subheadline_pt: '', hero_subheadline_en: '',
    hero_cta_pt: '', hero_cta_en: '',
    hero_note_pt: '', hero_note_en: '',

    // Benefits
    benefits_title_pt: '', benefits_title_en: '',
    benefits_subtitle_pt: '', benefits_subtitle_en: '',
    benefits_works_pt: '', benefits_works_en: '',
    benefits_works_desc_pt: '', benefits_works_desc_en: '',
    benefits_import_pt: '', benefits_import_en: '',
    benefits_import_desc_pt: '', benefits_import_desc_en: '',
    benefits_categorize_pt: '', benefits_categorize_en: '',
    benefits_categorize_desc_pt: '', benefits_categorize_desc_en: '',
    benefits_charts_pt: '', benefits_charts_en: '',
    benefits_charts_desc_pt: '', benefits_charts_desc_en: '',
    benefits_plan_pt: '', benefits_plan_en: '',
    benefits_plan_desc_pt: '', benefits_plan_desc_en: '',
    benefits_darkmode_pt: '', benefits_darkmode_en: '',
    benefits_darkmode_desc_pt: '', benefits_darkmode_desc_en: '',
    benefits_social_pt: '', benefits_social_en: '',

    // Features
    features_label_pt: '', features_label_en: '',
    features_title_pt: '', features_title_en: '',
    features_subtitle_pt: '', features_subtitle_en: '',
    // Transactions
    features_transactions_title_pt: '', features_transactions_title_en: '',
    features_transactions_desc_pt: '', features_transactions_desc_en: '',
    features_transactions_h1_pt: '', features_transactions_h1_en: '',
    features_transactions_h2_pt: '', features_transactions_h2_en: '',
    features_transactions_h3_pt: '', features_transactions_h3_en: '',
    // Categorize
    features_categorize_title_pt: '', features_categorize_title_en: '',
    features_categorize_desc_pt: '', features_categorize_desc_en: '',
    features_categorize_h1_pt: '', features_categorize_h1_en: '',
    features_categorize_h2_pt: '', features_categorize_h2_en: '',
    features_categorize_h3_pt: '', features_categorize_h3_en: '',
    // Visualize
    features_visualize_title_pt: '', features_visualize_title_en: '',
    features_visualize_desc_pt: '', features_visualize_desc_en: '',
    features_visualize_h1_pt: '', features_visualize_h1_en: '',
    features_visualize_h2_pt: '', features_visualize_h2_en: '',
    features_visualize_h3_pt: '', features_visualize_h3_en: '',
    // Plan
    features_plan_title_pt: '', features_plan_title_en: '',
    features_plan_desc_pt: '', features_plan_desc_en: '',
    features_plan_h1_pt: '', features_plan_h1_en: '',
    features_plan_h2_pt: '', features_plan_h2_en: '',
    features_plan_h3_pt: '', features_plan_h3_en: '',
    // Investments
    features_investments_title_pt: '', features_investments_title_en: '',
    features_investments_desc_pt: '', features_investments_desc_en: '',
    features_investments_h1_pt: '', features_investments_h1_en: '',
    features_investments_h2_pt: '', features_investments_h2_en: '',
    features_investments_h3_pt: '', features_investments_h3_en: '',
    // Additional features
    features_international_title_pt: '', features_international_title_en: '',
    features_international_desc_pt: '', features_international_desc_en: '',
    features_privacy_title_pt: '', features_privacy_title_en: '',
    features_privacy_desc_pt: '', features_privacy_desc_en: '',
    features_fast_title_pt: '', features_fast_title_en: '',
    features_fast_desc_pt: '', features_fast_desc_en: '',

    // Pricing
    pricing_label_pt: '', pricing_label_en: '',
    pricing_title_pt: '', pricing_title_en: '',
    pricing_subtitle_pt: '', pricing_subtitle_en: '',
    pricing_badge_pt: '', pricing_badge_en: '',
    pricing_complete_pt: '', pricing_complete_en: '',
    pricing_feature1_pt: '', pricing_feature1_en: '',
    pricing_feature2_pt: '', pricing_feature2_en: '',
    pricing_feature3_pt: '', pricing_feature3_en: '',
    pricing_feature4_pt: '', pricing_feature4_en: '',
    pricing_feature5_pt: '', pricing_feature5_en: '',
    pricing_onetime_pt: '', pricing_onetime_en: '',
    pricing_cta_pt: '', pricing_cta_en: '',
    pricing_guarantee_pt: '', pricing_guarantee_en: '',
    pricing_why_title_pt: '', pricing_why_title_en: '',
    pricing_why_desc_pt: '', pricing_why_desc_en: '',
    pricing_note_pt: '', pricing_note_en: '',

    // Footer
    footer_title_pt: '', footer_title_en: '',
    footer_title2_pt: '', footer_title2_en: '',
    footer_desc_pt: '', footer_desc_en: '',
    footer_cta_pt: '', footer_cta_en: '',

    // Donations
    donations_title_pt: '', donations_title_en: '',
    donations_subtitle_pt: '', donations_subtitle_en: '',
    donations_select_pt: '', donations_select_en: '',
    donations_impact_pt: '', donations_impact_en: '',
    donations_impact_desc_pt: '', donations_impact_desc_en: '',
    donations_reports_pt: '', donations_reports_en: '',
    donations_comingSoon_pt: '', donations_comingSoon_en: '',
    donations_comingSoonDesc_pt: '', donations_comingSoonDesc_en: '',

    // Feedback
    feedback_title_pt: '', feedback_title_en: '',
    feedback_subtitle_pt: '', feedback_subtitle_en: '',
    feedback_submit_pt: '', feedback_submit_en: '',
    feedback_roadmap_pt: '', feedback_roadmap_en: '',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser?.email === ADMIN_EMAIL) {
        loadCMSData();
      }
    });
    return () => unsubscribe();
  }, []);

  const loadCMSData = async () => {
    try {
      const pricingDoc = await getDoc(doc(db, 'cms', 'pricing'));
      if (pricingDoc.exists()) setPricing(pricingDoc.data());

      const pixDoc = await getDoc(doc(db, 'cms', 'pix'));
      if (pixDoc.exists()) setPix(pixDoc.data());

      const contentDoc = await getDoc(doc(db, 'cms', 'content'));
      if (contentDoc.exists()) setContent({ ...content, ...contentDoc.data() });

      const couponsSnapshot = await getDocs(collection(db, 'coupons'));
      setCoupons(couponsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error loading CMS data:', error);
      showMessage('error', 'Erro ao carregar dados');
    }
  };

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const analyticsSnapshot = await getDocs(collection(db, 'analytics'));
      const data = analyticsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().createdAt)
      }));

      // Sort by timestamp descending
      data.sort((a, b) => b.timestamp - a.timestamp);
      setAnalyticsData(data);

      // Calculate stats
      const uniqueSessions = new Set(data.map(d => d.sessionId)).size;
      const pageViews = data.filter(d => d.event === 'page_view').length;
      const ctaClicks = data.filter(d => d.event === 'cta_click').length;
      const purchases = data.filter(d => d.event === 'purchase_complete').length;

      setAnalyticsStats({
        totalEvents: data.length,
        uniqueSessions,
        pageViews,
        ctaClicks,
        purchases
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
      showMessage('error', 'Erro ao carregar analytics');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
      showMessage('error', 'Erro ao fazer login');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const savePricing = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'cms', 'pricing'), { ...pricing, updatedAt: serverTimestamp() });
      showMessage('success', 'Preços salvos!');
    } catch (error) {
      console.error('Error saving pricing:', error);
      showMessage('error', 'Erro ao salvar');
    }
    setSaving(false);
  };

  const savePix = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'cms', 'pix'), { ...pix, updatedAt: serverTimestamp() });
      showMessage('success', 'PIX salvo!');
    } catch (error) {
      console.error('Error saving PIX:', error);
      showMessage('error', 'Erro ao salvar');
    }
    setSaving(false);
  };

  const saveContent = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'cms', 'content'), { ...content, updatedAt: serverTimestamp() });
      showMessage('success', 'Conteúdo salvo!');
    } catch (error) {
      console.error('Error saving content:', error);
      showMessage('error', 'Erro ao salvar');
    }
    setSaving(false);
  };

  const addCoupon = async () => {
    if (!newCoupon.code) return;
    setSaving(true);
    try {
      const couponRef = doc(collection(db, 'coupons'));
      await setDoc(couponRef, {
        ...newCoupon,
        code: newCoupon.code.toUpperCase(),
        usedCount: 0,
        createdAt: serverTimestamp()
      });
      setCoupons([...coupons, { id: couponRef.id, ...newCoupon, code: newCoupon.code.toUpperCase(), usedCount: 0 }]);
      setNewCoupon({ code: '', discountPercent: 10, maxUses: 100, expiresAt: '', active: true });
      showMessage('success', 'Cupom criado!');
    } catch (error) {
      console.error('Error adding coupon:', error);
      showMessage('error', 'Erro ao criar cupom');
    }
    setSaving(false);
  };

  const deleteCoupon = async (couponId) => {
    if (!window.confirm('Excluir este cupom?')) return;
    try {
      await deleteDoc(doc(db, 'coupons', couponId));
      setCoupons(coupons.filter(c => c.id !== couponId));
      showMessage('success', 'Cupom excluído!');
    } catch (error) {
      console.error('Error deleting coupon:', error);
      showMessage('error', 'Erro ao excluir');
    }
  };

  const toggleCoupon = async (coupon) => {
    try {
      await setDoc(doc(db, 'coupons', coupon.id), { ...coupon, active: !coupon.active }, { merge: true });
      setCoupons(coupons.map(c => c.id === coupon.id ? { ...c, active: !c.active } : c));
    } catch (error) {
      console.error('Error toggling coupon:', error);
    }
  };

  const updateContent = (key, value) => {
    setContent(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">Admin CMS</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Faça login com sua conta Google autorizada.
          </p>
          <Button onClick={handleLogin} className="w-full h-12 rounded-xl">
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Entrar com Google
          </Button>
        </div>
      </div>
    );
  }

  if (user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-rose-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">Acesso Negado</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Sua conta ({user.email}) não está autorizada.
          </p>
          <Button onClick={handleLogout} variant="outline" className="w-full h-12 rounded-xl">
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white">Admin CMS</h1>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="ghost" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      {message.text && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Tabs defaultValue="content" className="space-y-8" onValueChange={(value) => {
          if (value === 'analytics' && analyticsData.length === 0 && !loadingAnalytics) {
            loadAnalytics();
          }
        }}>
          <TabsList className="flex flex-wrap justify-center gap-2 h-auto p-2 bg-slate-100 dark:bg-slate-900 rounded-2xl">
            <TabsTrigger value="content" className="px-4">
              <FileText className="w-4 h-4 mr-2" />
              Conteúdo
            </TabsTrigger>
            <TabsTrigger value="pricing" className="px-4">
              <DollarSign className="w-4 h-4 mr-2" />
              Preços
            </TabsTrigger>
            <TabsTrigger value="coupons" className="px-4">
              <Tag className="w-4 h-4 mr-2" />
              Cupons
            </TabsTrigger>
            <TabsTrigger value="pix" className="px-4">
              <CreditCard className="w-4 h-4 mr-2" />
              PIX
            </TabsTrigger>
            <TabsTrigger value="analytics" className="px-4">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Content Tab */}
          <TabsContent value="content">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Conteúdo do Site</h2>
                <Button onClick={saveContent} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar Tudo
                </Button>
              </div>

              <div className="space-y-4">
                {/* Hero Section */}
                <Section title="Hero (Página Inicial)" defaultOpen={true}>
                  <TranslationField label="Badge" ptValue={content.hero_badge_pt} enValue={content.hero_badge_en}
                    onPtChange={(v) => updateContent('hero_badge_pt', v)} onEnChange={(v) => updateContent('hero_badge_en', v)} />
                  <TranslationField label="Título Linha 1" ptValue={content.hero_headline1_pt} enValue={content.hero_headline1_en}
                    onPtChange={(v) => updateContent('hero_headline1_pt', v)} onEnChange={(v) => updateContent('hero_headline1_en', v)} />
                  <TranslationField label="Título Linha 2 (destaque)" ptValue={content.hero_headline2_pt} enValue={content.hero_headline2_en}
                    onPtChange={(v) => updateContent('hero_headline2_pt', v)} onEnChange={(v) => updateContent('hero_headline2_en', v)} />
                  <TranslationField label="Subtítulo" ptValue={content.hero_subheadline_pt} enValue={content.hero_subheadline_en}
                    onPtChange={(v) => updateContent('hero_subheadline_pt', v)} onEnChange={(v) => updateContent('hero_subheadline_en', v)} multiline />
                  <TranslationField label="Botão CTA" ptValue={content.hero_cta_pt} enValue={content.hero_cta_en}
                    onPtChange={(v) => updateContent('hero_cta_pt', v)} onEnChange={(v) => updateContent('hero_cta_en', v)} />
                  <TranslationField label="Nota abaixo do botão" ptValue={content.hero_note_pt} enValue={content.hero_note_en}
                    onPtChange={(v) => updateContent('hero_note_pt', v)} onEnChange={(v) => updateContent('hero_note_en', v)} />
                </Section>

                {/* Benefits Section */}
                <Section title="Benefícios">
                  <TranslationField label="Título" ptValue={content.benefits_title_pt} enValue={content.benefits_title_en}
                    onPtChange={(v) => updateContent('benefits_title_pt', v)} onEnChange={(v) => updateContent('benefits_title_en', v)} />
                  <TranslationField label="Subtítulo" ptValue={content.benefits_subtitle_pt} enValue={content.benefits_subtitle_en}
                    onPtChange={(v) => updateContent('benefits_subtitle_pt', v)} onEnChange={(v) => updateContent('benefits_subtitle_en', v)} />
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-medium text-slate-500 mb-3">Benefício 1: Funciona em todos os lugares</p>
                    <TranslationField label="Título" ptValue={content.benefits_works_pt} enValue={content.benefits_works_en}
                      onPtChange={(v) => updateContent('benefits_works_pt', v)} onEnChange={(v) => updateContent('benefits_works_en', v)} />
                    <TranslationField label="Descrição" ptValue={content.benefits_works_desc_pt} enValue={content.benefits_works_desc_en}
                      onPtChange={(v) => updateContent('benefits_works_desc_pt', v)} onEnChange={(v) => updateContent('benefits_works_desc_en', v)} />
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-slate-500 mb-3">Benefício 2: Importar extratos</p>
                    <TranslationField label="Título" ptValue={content.benefits_import_pt} enValue={content.benefits_import_en}
                      onPtChange={(v) => updateContent('benefits_import_pt', v)} onEnChange={(v) => updateContent('benefits_import_en', v)} />
                    <TranslationField label="Descrição" ptValue={content.benefits_import_desc_pt} enValue={content.benefits_import_desc_en}
                      onPtChange={(v) => updateContent('benefits_import_desc_pt', v)} onEnChange={(v) => updateContent('benefits_import_desc_en', v)} />
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-slate-500 mb-3">Benefício 3: Categorização</p>
                    <TranslationField label="Título" ptValue={content.benefits_categorize_pt} enValue={content.benefits_categorize_en}
                      onPtChange={(v) => updateContent('benefits_categorize_pt', v)} onEnChange={(v) => updateContent('benefits_categorize_en', v)} />
                    <TranslationField label="Descrição" ptValue={content.benefits_categorize_desc_pt} enValue={content.benefits_categorize_desc_en}
                      onPtChange={(v) => updateContent('benefits_categorize_desc_pt', v)} onEnChange={(v) => updateContent('benefits_categorize_desc_en', v)} />
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-slate-500 mb-3">Benefício 4: Gráficos</p>
                    <TranslationField label="Título" ptValue={content.benefits_charts_pt} enValue={content.benefits_charts_en}
                      onPtChange={(v) => updateContent('benefits_charts_pt', v)} onEnChange={(v) => updateContent('benefits_charts_en', v)} />
                    <TranslationField label="Descrição" ptValue={content.benefits_charts_desc_pt} enValue={content.benefits_charts_desc_en}
                      onPtChange={(v) => updateContent('benefits_charts_desc_pt', v)} onEnChange={(v) => updateContent('benefits_charts_desc_en', v)} />
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-slate-500 mb-3">Benefício 5: Planejamento</p>
                    <TranslationField label="Título" ptValue={content.benefits_plan_pt} enValue={content.benefits_plan_en}
                      onPtChange={(v) => updateContent('benefits_plan_pt', v)} onEnChange={(v) => updateContent('benefits_plan_en', v)} />
                    <TranslationField label="Descrição" ptValue={content.benefits_plan_desc_pt} enValue={content.benefits_plan_desc_en}
                      onPtChange={(v) => updateContent('benefits_plan_desc_pt', v)} onEnChange={(v) => updateContent('benefits_plan_desc_en', v)} />
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-slate-500 mb-3">Benefício 6: Modo escuro</p>
                    <TranslationField label="Título" ptValue={content.benefits_darkmode_pt} enValue={content.benefits_darkmode_en}
                      onPtChange={(v) => updateContent('benefits_darkmode_pt', v)} onEnChange={(v) => updateContent('benefits_darkmode_en', v)} />
                    <TranslationField label="Descrição" ptValue={content.benefits_darkmode_desc_pt} enValue={content.benefits_darkmode_desc_en}
                      onPtChange={(v) => updateContent('benefits_darkmode_desc_pt', v)} onEnChange={(v) => updateContent('benefits_darkmode_desc_en', v)} />
                  </div>
                  <div className="border-t pt-4">
                    <TranslationField label="Texto Social/CTA" ptValue={content.benefits_social_pt} enValue={content.benefits_social_en}
                      onPtChange={(v) => updateContent('benefits_social_pt', v)} onEnChange={(v) => updateContent('benefits_social_en', v)} multiline />
                  </div>
                </Section>

                {/* Features Section */}
                <Section title="Recursos (Features)">
                  <TranslationField label="Label" ptValue={content.features_label_pt} enValue={content.features_label_en}
                    onPtChange={(v) => updateContent('features_label_pt', v)} onEnChange={(v) => updateContent('features_label_en', v)} />
                  <TranslationField label="Título" ptValue={content.features_title_pt} enValue={content.features_title_en}
                    onPtChange={(v) => updateContent('features_title_pt', v)} onEnChange={(v) => updateContent('features_title_en', v)} />
                  <TranslationField label="Subtítulo" ptValue={content.features_subtitle_pt} enValue={content.features_subtitle_en}
                    onPtChange={(v) => updateContent('features_subtitle_pt', v)} onEnChange={(v) => updateContent('features_subtitle_en', v)} multiline />

                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-medium text-slate-500 mb-3">Recurso 1: Transações</p>
                    <TranslationField label="Título" ptValue={content.features_transactions_title_pt} enValue={content.features_transactions_title_en}
                      onPtChange={(v) => updateContent('features_transactions_title_pt', v)} onEnChange={(v) => updateContent('features_transactions_title_en', v)} />
                    <TranslationField label="Descrição" ptValue={content.features_transactions_desc_pt} enValue={content.features_transactions_desc_en}
                      onPtChange={(v) => updateContent('features_transactions_desc_pt', v)} onEnChange={(v) => updateContent('features_transactions_desc_en', v)} multiline />
                    <TranslationField label="Bullet 1" ptValue={content.features_transactions_h1_pt} enValue={content.features_transactions_h1_en}
                      onPtChange={(v) => updateContent('features_transactions_h1_pt', v)} onEnChange={(v) => updateContent('features_transactions_h1_en', v)} />
                    <TranslationField label="Bullet 2" ptValue={content.features_transactions_h2_pt} enValue={content.features_transactions_h2_en}
                      onPtChange={(v) => updateContent('features_transactions_h2_pt', v)} onEnChange={(v) => updateContent('features_transactions_h2_en', v)} />
                    <TranslationField label="Bullet 3" ptValue={content.features_transactions_h3_pt} enValue={content.features_transactions_h3_en}
                      onPtChange={(v) => updateContent('features_transactions_h3_pt', v)} onEnChange={(v) => updateContent('features_transactions_h3_en', v)} />
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-slate-500 mb-3">Recurso 2: Categorização</p>
                    <TranslationField label="Título" ptValue={content.features_categorize_title_pt} enValue={content.features_categorize_title_en}
                      onPtChange={(v) => updateContent('features_categorize_title_pt', v)} onEnChange={(v) => updateContent('features_categorize_title_en', v)} />
                    <TranslationField label="Descrição" ptValue={content.features_categorize_desc_pt} enValue={content.features_categorize_desc_en}
                      onPtChange={(v) => updateContent('features_categorize_desc_pt', v)} onEnChange={(v) => updateContent('features_categorize_desc_en', v)} multiline />
                    <TranslationField label="Bullet 1" ptValue={content.features_categorize_h1_pt} enValue={content.features_categorize_h1_en}
                      onPtChange={(v) => updateContent('features_categorize_h1_pt', v)} onEnChange={(v) => updateContent('features_categorize_h1_en', v)} />
                    <TranslationField label="Bullet 2" ptValue={content.features_categorize_h2_pt} enValue={content.features_categorize_h2_en}
                      onPtChange={(v) => updateContent('features_categorize_h2_pt', v)} onEnChange={(v) => updateContent('features_categorize_h2_en', v)} />
                    <TranslationField label="Bullet 3" ptValue={content.features_categorize_h3_pt} enValue={content.features_categorize_h3_en}
                      onPtChange={(v) => updateContent('features_categorize_h3_pt', v)} onEnChange={(v) => updateContent('features_categorize_h3_en', v)} />
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-slate-500 mb-3">Recurso 3: Visualização</p>
                    <TranslationField label="Título" ptValue={content.features_visualize_title_pt} enValue={content.features_visualize_title_en}
                      onPtChange={(v) => updateContent('features_visualize_title_pt', v)} onEnChange={(v) => updateContent('features_visualize_title_en', v)} />
                    <TranslationField label="Descrição" ptValue={content.features_visualize_desc_pt} enValue={content.features_visualize_desc_en}
                      onPtChange={(v) => updateContent('features_visualize_desc_pt', v)} onEnChange={(v) => updateContent('features_visualize_desc_en', v)} multiline />
                    <TranslationField label="Bullet 1" ptValue={content.features_visualize_h1_pt} enValue={content.features_visualize_h1_en}
                      onPtChange={(v) => updateContent('features_visualize_h1_pt', v)} onEnChange={(v) => updateContent('features_visualize_h1_en', v)} />
                    <TranslationField label="Bullet 2" ptValue={content.features_visualize_h2_pt} enValue={content.features_visualize_h2_en}
                      onPtChange={(v) => updateContent('features_visualize_h2_pt', v)} onEnChange={(v) => updateContent('features_visualize_h2_en', v)} />
                    <TranslationField label="Bullet 3" ptValue={content.features_visualize_h3_pt} enValue={content.features_visualize_h3_en}
                      onPtChange={(v) => updateContent('features_visualize_h3_pt', v)} onEnChange={(v) => updateContent('features_visualize_h3_en', v)} />
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-slate-500 mb-3">Recurso 4: Planejamento</p>
                    <TranslationField label="Título" ptValue={content.features_plan_title_pt} enValue={content.features_plan_title_en}
                      onPtChange={(v) => updateContent('features_plan_title_pt', v)} onEnChange={(v) => updateContent('features_plan_title_en', v)} />
                    <TranslationField label="Descrição" ptValue={content.features_plan_desc_pt} enValue={content.features_plan_desc_en}
                      onPtChange={(v) => updateContent('features_plan_desc_pt', v)} onEnChange={(v) => updateContent('features_plan_desc_en', v)} multiline />
                    <TranslationField label="Bullet 1" ptValue={content.features_plan_h1_pt} enValue={content.features_plan_h1_en}
                      onPtChange={(v) => updateContent('features_plan_h1_pt', v)} onEnChange={(v) => updateContent('features_plan_h1_en', v)} />
                    <TranslationField label="Bullet 2" ptValue={content.features_plan_h2_pt} enValue={content.features_plan_h2_en}
                      onPtChange={(v) => updateContent('features_plan_h2_pt', v)} onEnChange={(v) => updateContent('features_plan_h2_en', v)} />
                    <TranslationField label="Bullet 3" ptValue={content.features_plan_h3_pt} enValue={content.features_plan_h3_en}
                      onPtChange={(v) => updateContent('features_plan_h3_pt', v)} onEnChange={(v) => updateContent('features_plan_h3_en', v)} />
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-slate-500 mb-3">Recurso 5: Investimentos</p>
                    <TranslationField label="Título" ptValue={content.features_investments_title_pt} enValue={content.features_investments_title_en}
                      onPtChange={(v) => updateContent('features_investments_title_pt', v)} onEnChange={(v) => updateContent('features_investments_title_en', v)} />
                    <TranslationField label="Descrição" ptValue={content.features_investments_desc_pt} enValue={content.features_investments_desc_en}
                      onPtChange={(v) => updateContent('features_investments_desc_pt', v)} onEnChange={(v) => updateContent('features_investments_desc_en', v)} multiline />
                    <TranslationField label="Bullet 1" ptValue={content.features_investments_h1_pt} enValue={content.features_investments_h1_en}
                      onPtChange={(v) => updateContent('features_investments_h1_pt', v)} onEnChange={(v) => updateContent('features_investments_h1_en', v)} />
                    <TranslationField label="Bullet 2" ptValue={content.features_investments_h2_pt} enValue={content.features_investments_h2_en}
                      onPtChange={(v) => updateContent('features_investments_h2_pt', v)} onEnChange={(v) => updateContent('features_investments_h2_en', v)} />
                    <TranslationField label="Bullet 3" ptValue={content.features_investments_h3_pt} enValue={content.features_investments_h3_en}
                      onPtChange={(v) => updateContent('features_investments_h3_pt', v)} onEnChange={(v) => updateContent('features_investments_h3_en', v)} />
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-slate-500 mb-3">Recursos Adicionais (cards)</p>
                    <TranslationField label="Internacional - Título" ptValue={content.features_international_title_pt} enValue={content.features_international_title_en}
                      onPtChange={(v) => updateContent('features_international_title_pt', v)} onEnChange={(v) => updateContent('features_international_title_en', v)} />
                    <TranslationField label="Internacional - Desc" ptValue={content.features_international_desc_pt} enValue={content.features_international_desc_en}
                      onPtChange={(v) => updateContent('features_international_desc_pt', v)} onEnChange={(v) => updateContent('features_international_desc_en', v)} />
                    <TranslationField label="Privacidade - Título" ptValue={content.features_privacy_title_pt} enValue={content.features_privacy_title_en}
                      onPtChange={(v) => updateContent('features_privacy_title_pt', v)} onEnChange={(v) => updateContent('features_privacy_title_en', v)} />
                    <TranslationField label="Privacidade - Desc" ptValue={content.features_privacy_desc_pt} enValue={content.features_privacy_desc_en}
                      onPtChange={(v) => updateContent('features_privacy_desc_pt', v)} onEnChange={(v) => updateContent('features_privacy_desc_en', v)} />
                    <TranslationField label="Rápido - Título" ptValue={content.features_fast_title_pt} enValue={content.features_fast_title_en}
                      onPtChange={(v) => updateContent('features_fast_title_pt', v)} onEnChange={(v) => updateContent('features_fast_title_en', v)} />
                    <TranslationField label="Rápido - Desc" ptValue={content.features_fast_desc_pt} enValue={content.features_fast_desc_en}
                      onPtChange={(v) => updateContent('features_fast_desc_pt', v)} onEnChange={(v) => updateContent('features_fast_desc_en', v)} />
                  </div>
                </Section>

                {/* Pricing Section */}
                <Section title="Preços (Pricing)">
                  <TranslationField label="Label" ptValue={content.pricing_label_pt} enValue={content.pricing_label_en}
                    onPtChange={(v) => updateContent('pricing_label_pt', v)} onEnChange={(v) => updateContent('pricing_label_en', v)} />
                  <TranslationField label="Título" ptValue={content.pricing_title_pt} enValue={content.pricing_title_en}
                    onPtChange={(v) => updateContent('pricing_title_pt', v)} onEnChange={(v) => updateContent('pricing_title_en', v)} />
                  <TranslationField label="Subtítulo" ptValue={content.pricing_subtitle_pt} enValue={content.pricing_subtitle_en}
                    onPtChange={(v) => updateContent('pricing_subtitle_pt', v)} onEnChange={(v) => updateContent('pricing_subtitle_en', v)} />
                  <TranslationField label="Badge" ptValue={content.pricing_badge_pt} enValue={content.pricing_badge_en}
                    onPtChange={(v) => updateContent('pricing_badge_pt', v)} onEnChange={(v) => updateContent('pricing_badge_en', v)} />
                  <TranslationField label="Título do Plano" ptValue={content.pricing_complete_pt} enValue={content.pricing_complete_en}
                    onPtChange={(v) => updateContent('pricing_complete_pt', v)} onEnChange={(v) => updateContent('pricing_complete_en', v)} />
                  <TranslationField label="Feature 1" ptValue={content.pricing_feature1_pt} enValue={content.pricing_feature1_en}
                    onPtChange={(v) => updateContent('pricing_feature1_pt', v)} onEnChange={(v) => updateContent('pricing_feature1_en', v)} />
                  <TranslationField label="Feature 2" ptValue={content.pricing_feature2_pt} enValue={content.pricing_feature2_en}
                    onPtChange={(v) => updateContent('pricing_feature2_pt', v)} onEnChange={(v) => updateContent('pricing_feature2_en', v)} />
                  <TranslationField label="Feature 3" ptValue={content.pricing_feature3_pt} enValue={content.pricing_feature3_en}
                    onPtChange={(v) => updateContent('pricing_feature3_pt', v)} onEnChange={(v) => updateContent('pricing_feature3_en', v)} />
                  <TranslationField label="Feature 4" ptValue={content.pricing_feature4_pt} enValue={content.pricing_feature4_en}
                    onPtChange={(v) => updateContent('pricing_feature4_pt', v)} onEnChange={(v) => updateContent('pricing_feature4_en', v)} />
                  <TranslationField label="Feature 5" ptValue={content.pricing_feature5_pt} enValue={content.pricing_feature5_en}
                    onPtChange={(v) => updateContent('pricing_feature5_pt', v)} onEnChange={(v) => updateContent('pricing_feature5_en', v)} />
                  <TranslationField label="Texto 'único'" ptValue={content.pricing_onetime_pt} enValue={content.pricing_onetime_en}
                    onPtChange={(v) => updateContent('pricing_onetime_pt', v)} onEnChange={(v) => updateContent('pricing_onetime_en', v)} />
                  <TranslationField label="Botão CTA" ptValue={content.pricing_cta_pt} enValue={content.pricing_cta_en}
                    onPtChange={(v) => updateContent('pricing_cta_pt', v)} onEnChange={(v) => updateContent('pricing_cta_en', v)} />
                  <TranslationField label="Garantia" ptValue={content.pricing_guarantee_pt} enValue={content.pricing_guarantee_en}
                    onPtChange={(v) => updateContent('pricing_guarantee_pt', v)} onEnChange={(v) => updateContent('pricing_guarantee_en', v)} />
                  <TranslationField label="Por que doamos - Título" ptValue={content.pricing_why_title_pt} enValue={content.pricing_why_title_en}
                    onPtChange={(v) => updateContent('pricing_why_title_pt', v)} onEnChange={(v) => updateContent('pricing_why_title_en', v)} />
                  <TranslationField label="Por que doamos - Texto" ptValue={content.pricing_why_desc_pt} enValue={content.pricing_why_desc_en}
                    onPtChange={(v) => updateContent('pricing_why_desc_pt', v)} onEnChange={(v) => updateContent('pricing_why_desc_en', v)} multiline />
                  <TranslationField label="Nota de rodapé" ptValue={content.pricing_note_pt} enValue={content.pricing_note_en}
                    onPtChange={(v) => updateContent('pricing_note_pt', v)} onEnChange={(v) => updateContent('pricing_note_en', v)} multiline />
                </Section>

                {/* Footer Section */}
                <Section title="Rodapé (Footer)">
                  <TranslationField label="Título Linha 1" ptValue={content.footer_title_pt} enValue={content.footer_title_en}
                    onPtChange={(v) => updateContent('footer_title_pt', v)} onEnChange={(v) => updateContent('footer_title_en', v)} />
                  <TranslationField label="Título Linha 2" ptValue={content.footer_title2_pt} enValue={content.footer_title2_en}
                    onPtChange={(v) => updateContent('footer_title2_pt', v)} onEnChange={(v) => updateContent('footer_title2_en', v)} />
                  <TranslationField label="Descrição" ptValue={content.footer_desc_pt} enValue={content.footer_desc_en}
                    onPtChange={(v) => updateContent('footer_desc_pt', v)} onEnChange={(v) => updateContent('footer_desc_en', v)} multiline />
                  <TranslationField label="Botão CTA" ptValue={content.footer_cta_pt} enValue={content.footer_cta_en}
                    onPtChange={(v) => updateContent('footer_cta_pt', v)} onEnChange={(v) => updateContent('footer_cta_en', v)} />
                </Section>

                {/* Donations Section */}
                <Section title="Página de Doações">
                  <TranslationField label="Título" ptValue={content.donations_title_pt} enValue={content.donations_title_en}
                    onPtChange={(v) => updateContent('donations_title_pt', v)} onEnChange={(v) => updateContent('donations_title_en', v)} />
                  <TranslationField label="Subtítulo" ptValue={content.donations_subtitle_pt} enValue={content.donations_subtitle_en}
                    onPtChange={(v) => updateContent('donations_subtitle_pt', v)} onEnChange={(v) => updateContent('donations_subtitle_en', v)} multiline />
                  <TranslationField label="Selecione o valor" ptValue={content.donations_select_pt} enValue={content.donations_select_en}
                    onPtChange={(v) => updateContent('donations_select_pt', v)} onEnChange={(v) => updateContent('donations_select_en', v)} />
                  <TranslationField label="Seu Impacto" ptValue={content.donations_impact_pt} enValue={content.donations_impact_en}
                    onPtChange={(v) => updateContent('donations_impact_pt', v)} onEnChange={(v) => updateContent('donations_impact_en', v)} />
                  <TranslationField label="Descrição do impacto" ptValue={content.donations_impact_desc_pt} enValue={content.donations_impact_desc_en}
                    onPtChange={(v) => updateContent('donations_impact_desc_pt', v)} onEnChange={(v) => updateContent('donations_impact_desc_en', v)} />
                  <TranslationField label="Relatórios" ptValue={content.donations_reports_pt} enValue={content.donations_reports_en}
                    onPtChange={(v) => updateContent('donations_reports_pt', v)} onEnChange={(v) => updateContent('donations_reports_en', v)} />
                  <TranslationField label="Em breve - Título" ptValue={content.donations_comingSoon_pt} enValue={content.donations_comingSoon_en}
                    onPtChange={(v) => updateContent('donations_comingSoon_pt', v)} onEnChange={(v) => updateContent('donations_comingSoon_en', v)} />
                  <TranslationField label="Em breve - Desc" ptValue={content.donations_comingSoonDesc_pt} enValue={content.donations_comingSoonDesc_en}
                    onPtChange={(v) => updateContent('donations_comingSoonDesc_pt', v)} onEnChange={(v) => updateContent('donations_comingSoonDesc_en', v)} multiline />
                </Section>

                {/* Feedback Section */}
                <Section title="Página de Feedback">
                  <TranslationField label="Título" ptValue={content.feedback_title_pt} enValue={content.feedback_title_en}
                    onPtChange={(v) => updateContent('feedback_title_pt', v)} onEnChange={(v) => updateContent('feedback_title_en', v)} />
                  <TranslationField label="Subtítulo" ptValue={content.feedback_subtitle_pt} enValue={content.feedback_subtitle_en}
                    onPtChange={(v) => updateContent('feedback_subtitle_pt', v)} onEnChange={(v) => updateContent('feedback_subtitle_en', v)} multiline />
                  <TranslationField label="Tab Enviar" ptValue={content.feedback_submit_pt} enValue={content.feedback_submit_en}
                    onPtChange={(v) => updateContent('feedback_submit_pt', v)} onEnChange={(v) => updateContent('feedback_submit_en', v)} />
                  <TranslationField label="Tab Roadmap" ptValue={content.feedback_roadmap_pt} enValue={content.feedback_roadmap_en}
                    onPtChange={(v) => updateContent('feedback_roadmap_pt', v)} onEnChange={(v) => updateContent('feedback_roadmap_en', v)} />
                </Section>
              </div>
            </div>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
              <h2 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Configurar Preços</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Preço (R$)</label>
                  <Input type="number" value={pricing.price} onChange={(e) => setPricing({ ...pricing, price: parseFloat(e.target.value) || 0 })} className="h-12 rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Desconto (%)</label>
                  <Input type="number" value={pricing.discountPercent} onChange={(e) => setPricing({ ...pricing, discountPercent: parseFloat(e.target.value) || 0 })} className="h-12 rounded-xl" min="0" max="100" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Desconto válido até</label>
                  <Input type="date" value={pricing.discountEndDate} onChange={(e) => setPricing({ ...pricing, discountEndDate: e.target.value })} className="h-12 rounded-xl" />
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setPricing({ ...pricing, discountActive: !pricing.discountActive })}
                    className={`w-14 h-8 rounded-full transition-colors flex items-center px-1 ${pricing.discountActive ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    <div className={`w-6 h-6 rounded-full bg-white shadow transition-transform ${pricing.discountActive ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Desconto ativo</span>
                </div>
              </div>
              {pricing.discountActive && pricing.discountPercent > 0 && (
                <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
                  <p className="text-emerald-700 dark:text-emerald-300">
                    <strong>Preço com desconto:</strong> R$ {(pricing.price * (1 - pricing.discountPercent / 100)).toFixed(2)}
                    <span className="ml-2 text-sm">({pricing.discountPercent}% off)</span>
                  </p>
                </div>
              )}
              <Button onClick={savePricing} className="mt-6 h-12 rounded-xl" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Preços
              </Button>
            </div>
          </TabsContent>

          {/* Coupons Tab */}
          <TabsContent value="coupons">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
              <h2 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Gerenciar Cupons</h2>
              <div className="grid md:grid-cols-5 gap-4 mb-8 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Código</label>
                  <Input placeholder="PROMO20" value={newCoupon.code} onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })} className="h-10 rounded-lg uppercase" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Desconto %</label>
                  <Input type="number" value={newCoupon.discountPercent} onChange={(e) => setNewCoupon({ ...newCoupon, discountPercent: parseInt(e.target.value) || 0 })} className="h-10 rounded-lg" min="1" max="100" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Máx. Usos</label>
                  <Input type="number" value={newCoupon.maxUses} onChange={(e) => setNewCoupon({ ...newCoupon, maxUses: parseInt(e.target.value) || 0 })} className="h-10 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Expira em</label>
                  <Input type="date" value={newCoupon.expiresAt} onChange={(e) => setNewCoupon({ ...newCoupon, expiresAt: e.target.value })} className="h-10 rounded-lg" />
                </div>
                <div className="flex items-end">
                  <Button onClick={addCoupon} className="h-10 w-full rounded-lg" disabled={saving || !newCoupon.code}>
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                {coupons.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Nenhum cupom cadastrado</p>
                ) : (
                  coupons.map((coupon) => (
                    <div key={coupon.id} className={`flex items-center justify-between p-4 rounded-xl border ${coupon.active ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 opacity-60'}`}>
                      <div className="flex items-center gap-4">
                        <code className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg font-mono font-bold">{coupon.code}</code>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{coupon.discountPercent}% OFF</span>
                        <span className="text-sm text-slate-500">{coupon.usedCount || 0}/{coupon.maxUses} usos</span>
                        {coupon.expiresAt && <span className="text-sm text-slate-500">Expira: {new Date(coupon.expiresAt).toLocaleDateString('pt-BR')}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleCoupon(coupon)} className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${coupon.active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                          <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${coupon.active ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                        <Button onClick={() => deleteCoupon(coupon.id)} variant="ghost" size="sm" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* PIX Tab */}
          <TabsContent value="pix">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
              <h2 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Configurar PIX</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Tipo de Chave</label>
                  <select value={pix.keyType} onChange={(e) => setPix({ ...pix, keyType: e.target.value })} className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                    <option value="email">E-mail</option>
                    <option value="cpf">CPF</option>
                    <option value="phone">Telefone</option>
                    <option value="random">Chave Aleatória</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Chave PIX</label>
                  <Input value={pix.key} onChange={(e) => setPix({ ...pix, key: e.target.value })} placeholder={pix.keyType === 'email' ? 'seu@email.com' : pix.keyType === 'cpf' ? '000.000.000-00' : pix.keyType === 'phone' ? '+5511999999999' : 'Chave aleatória'} className="h-12 rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Nome do Beneficiário</label>
                  <Input value={pix.beneficiary} onChange={(e) => setPix({ ...pix, beneficiary: e.target.value })} placeholder="Nome completo" className="h-12 rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">URL do QR Code (opcional)</label>
                  <Input value={pix.qrCodeUrl} onChange={(e) => setPix({ ...pix, qrCodeUrl: e.target.value })} placeholder="https://..." className="h-12 rounded-xl" />
                </div>
              </div>
              <Button onClick={savePix} className="mt-6 h-12 rounded-xl" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar PIX
              </Button>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Events</div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{analyticsStats.totalEvents.toLocaleString()}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Sessions</div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{analyticsStats.uniqueSessions.toLocaleString()}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Page Views</div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{analyticsStats.pageViews.toLocaleString()}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">CTA Clicks</div>
                  <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{analyticsStats.ctaClicks.toLocaleString()}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Purchases</div>
                  <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{analyticsStats.purchases.toLocaleString()}</div>
                </div>
              </div>

              {/* Events Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recent Events</h2>
                  <Button onClick={loadAnalytics} disabled={loadingAnalytics} variant="outline" size="sm">
                    {loadingAnalytics ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}
                    Refresh
                  </Button>
                </div>

                {loadingAnalytics ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                  </div>
                ) : analyticsData.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p className="text-slate-500 dark:text-slate-400">No analytics data yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Event</th>
                          <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data</th>
                          <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Device</th>
                          <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">URL</th>
                          <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {analyticsData.slice(0, 50).map((event) => (
                          <tr key={event.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                event.event === 'purchase_complete' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                                event.event === 'cta_click' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                event.event === 'page_view' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}>
                                {event.event}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                              {event.data && Object.keys(event.data).length > 0 ? (
                                <span className="font-mono text-xs">{JSON.stringify(event.data).slice(0, 40)}...</span>
                              ) : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                              {event.device?.type || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                              <code className="text-xs">{event.url || '-'}</code>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {event.timestamp ? new Date(event.timestamp).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {analyticsData.length > 50 && (
                  <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
                    Showing 50 of {analyticsData.length} events
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
