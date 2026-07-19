import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, Dimensions, Modal } from 'react-native';
import { TouchableOpacity } from '@/components/HapticTouchable';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'expo-router';
import { Mail, Lock, User, Eye, EyeOff, Globe, ChevronRight, ShieldAlert, Check } from 'lucide-react-native';

const TERMS_ACCEPTED_KEY = '@alchemize/terms_accepted_v1';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CRYSTAL_BALL_IMAGE = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/89z8qu274hk8f1cht7vcg.png';

const TRANSLATIONS = {
  en: {
    transformTitle: 'Alchemize',
    transformSubtitle: 'Transform Your Life',
    login: 'Sign In',
    signup: 'Sign Up',
    email: 'Email',
    password: 'Password',
    fullName: 'Full Name',
    rememberMe: 'Remember Me',
    forgotPassword: 'Forgot Password?',
    or: 'or continue with',
    signInWithApple: 'Apple',
    fillFields: 'Please fill in all fields',
    enterName: 'Please enter your name',
    resetTitle: 'Reset Password',
    resetMessage: 'Enter your email to receive reset instructions',
    resetEmail: 'Email address',
    sendReset: 'Send Reset Link',
    cancel: 'Cancel',
    resetSent: 'Reset link sent! Check your email.',
    enterEmail: 'Please enter your email address',
    agreeLabel: 'I agree to the',
    termsLink: 'Terms & Privacy',
    mustAgree: 'You must agree to the Terms to continue',
    termsTitle: 'Terms & Privacy Agreement',
    termsIntro: 'Please read carefully before using Alchemize.',
    termsBody:
      'By using Alchemize you agree to the following:\n\n1. Use at Your Own Risk. This app is provided "as is" without warranties of any kind. Content (affirmations, fitness, nutrition, financial and wellness data) is for personal informational purposes only and is not professional medical, legal, or financial advice. Alchemize is not a medical device, has not been evaluated by the FDA or any regulator, and must never be used for medical diagnosis, treatment, or emergencies — call your doctor or emergency services for those.\n\n2. AI-Generated Content. Alchemize uses artificial intelligence (including third-party AI service providers) to analyze photos and text you submit and to generate estimates, suggestions, and content (for example: food/nutrition recognition from photos, workout suggestions, generated text). AI output can be inaccurate, incomplete, or misleading. You are responsible for independently verifying anything AI-generated before relying on it, especially calorie, nutrition, fitness, or financial figures. We are not liable for decisions made based on AI-generated content.\n\n3. Data & Privacy. We store the data you create (goals, habits, photos, journals, health metrics) to operate the app. Content and photos you submit for AI features may be sent to and processed by third-party AI providers as described in our Privacy Policy. If you connect Apple Health, HealthKit data is used only to power in-app features (like workout and activity sync) — we do not sell it and do not use it for advertising or marketing. We use industry-standard practices but no system is 100% secure.\n\n4. No Liability for Data Leaks. To the maximum extent permitted by law, Alchemize, its developers and affiliates are NOT responsible or liable for any data breaches, leaks, loss, unauthorized access, or damages arising from use of the app or third-party services (including Apple, Google, Supabase, RevenueCat, and our AI providers).\n\n5. Subscriptions. Paid plans, where offered, are billed through the Apple App Store or Google Play and auto-renew until cancelled. Manage or cancel your subscription anytime in your App Store or Play Store account settings; refunds are handled by Apple/Google per their policies.\n\n6. Age Requirement. Alchemize is not intended for children under 13 (or the minimum age required in your country). Do not use this app if you do not meet this requirement.\n\n7. Your Responsibility. You are responsible for keeping your account credentials secure and for the content you upload. Do not share sensitive medical, legal, or financial details that you would not want stored or processed by AI.\n\n8. Changes. We may update these Terms from time to time; continued use after changes means you accept the updated Terms.\n\n9. Consent. By tapping "I Agree" you confirm you have read, understood, and accepted these terms and our Privacy Policy.\n\n—\n\nDeveloped by FRC Enterprise\nPowered & Designed by Metallicv1',
    iAgree: 'I Agree & Continue',
    decline: 'Decline',
  },
  es: {
    transformTitle: 'Alchemize',
    transformSubtitle: 'Transforma Tu Vida',
    login: 'Iniciar Sesión',
    signup: 'Registrarse',
    email: 'Correo',
    password: 'Contraseña',
    fullName: 'Nombre Completo',
    rememberMe: 'Recuérdame',
    forgotPassword: '¿Olvidaste tu contraseña?',
    or: 'o continuar con',
    signInWithApple: 'Apple',
    fillFields: 'Por favor completa todos los campos',
    enterName: 'Por favor ingresa tu nombre',
    resetTitle: 'Restablecer Contraseña',
    resetMessage: 'Ingresa tu correo para recibir instrucciones',
    resetEmail: 'Correo electrónico',
    sendReset: 'Enviar Enlace',
    cancel: 'Cancelar',
    resetSent: '¡Enlace enviado! Revisa tu correo.',
    enterEmail: 'Por favor ingresa tu correo electrónico',
    agreeLabel: 'Acepto los',
    termsLink: 'Términos y Privacidad',
    mustAgree: 'Debes aceptar los Términos para continuar',
    termsTitle: 'Acuerdo de Términos y Privacidad',
    termsIntro: 'Por favor lee con atención antes de usar Alchemize.',
    termsBody:
      'Al usar Alchemize aceptas lo siguiente:\n\n1. Uso Bajo Tu Propio Riesgo. Esta aplicación se proporciona "tal cual" sin garantías de ningún tipo. El contenido (afirmaciones, fitness, nutrición, datos financieros y de bienestar) es solo para fines informativos personales y no constituye asesoramiento médico, legal o financiero profesional. Alchemize no es un dispositivo médico, no ha sido evaluado por la FDA ni ningún regulador, y nunca debe usarse para diagnóstico, tratamiento o emergencias médicas — llama a tu médico o a servicios de emergencia para eso.\n\n2. Contenido Generado por IA. Alchemize usa inteligencia artificial (incluidos proveedores externos de IA) para analizar las fotos y textos que envías y para generar estimaciones, sugerencias y contenido (por ejemplo: reconocimiento de comida/nutrición a partir de fotos, sugerencias de entrenamiento, texto generado). El resultado de la IA puede ser inexacto, incompleto o engañoso. Eres responsable de verificar de forma independiente cualquier contenido generado por IA antes de confiar en él, especialmente cifras de calorías, nutrición, fitness o finanzas. No somos responsables por decisiones tomadas con base en contenido generado por IA.\n\n3. Datos y Privacidad. Almacenamos los datos que creas (metas, hábitos, fotos, diarios, métricas de salud) para operar la app. El contenido y las fotos que envías para funciones de IA pueden enviarse a proveedores externos de IA para su procesamiento, como se describe en nuestra Política de Privacidad. Si conectas Apple Health, los datos de HealthKit se usan solo para funciones dentro de la app (como sincronizar entrenamientos y actividad) — no los vendemos ni los usamos para publicidad. Usamos prácticas estándar de la industria pero ningún sistema es 100% seguro.\n\n4. Sin Responsabilidad por Filtraciones de Datos. En la máxima medida permitida por la ley, Alchemize, sus desarrolladores y afiliados NO son responsables por filtraciones de datos, brechas, pérdidas, acceso no autorizado o daños derivados del uso de la app o servicios de terceros (incluidos Apple, Google, Supabase, RevenueCat y nuestros proveedores de IA).\n\n5. Suscripciones. Los planes de pago, cuando se ofrecen, se facturan a través de App Store o Google Play y se renuevan automáticamente hasta que se cancelen. Puedes gestionar o cancelar tu suscripción en cualquier momento desde la configuración de tu cuenta de App Store o Google Play; los reembolsos los gestionan Apple/Google según sus políticas.\n\n6. Edad Mínima. Alchemize no está destinado a menores de 13 años (o la edad mínima requerida en tu país). No uses esta app si no cumples este requisito.\n\n7. Tu Responsabilidad. Eres responsable de mantener seguras tus credenciales y del contenido que subes. No compartas información médica, legal o financiera sensible que no quieras almacenada o procesada por IA.\n\n8. Cambios. Podemos actualizar estos Términos ocasionalmente; el uso continuado después de los cambios implica que los aceptas.\n\n9. Consentimiento. Al tocar "Acepto" confirmas que has leído, comprendido y aceptado estos términos y nuestra Política de Privacidad.\n\n—\n\nDesarrollado por FRC Enterprise\nPotenciado y Diseñado por Metallicv1',
    iAgree: 'Acepto y Continuar',
    decline: 'Rechazar',
  },
};

export default function AuthScreen() {
  const router = useRouter();
  const { login, signup, loginWithApple, resetPassword } = useAuth();
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable).catch(() => setAppleAuthAvailable(false));
    }
  }, []);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [checkingTerms, setCheckingTerms] = useState(true);

  const t = TRANSLATIONS[language];

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(TERMS_ACCEPTED_KEY);
        if (v === 'true') {
          setTermsAccepted(true);
        } else {
          setShowTermsModal(true);
        }
      } catch {
        setShowTermsModal(true);
      } finally {
        setCheckingTerms(false);
      }
    })();
  }, []);

  const acceptTerms = async () => {
    try {
      await AsyncStorage.setItem(TERMS_ACCEPTED_KEY, 'true');
    } catch {}
    setTermsAccepted(true);
    setShowTermsModal(false);
  };

  const declineTerms = () => {
    setShowTermsModal(false);
    setTermsAccepted(false);
  };

  const requireTerms = (): boolean => {
    if (!termsAccepted) {
      setShowTermsModal(true);
      setError(t.mustAgree);
      return false;
    }
    return true;
  };

  const handleAuth = async () => {
    if (!requireTerms()) return;
    if (!email || !password) {
      setError(t.fillFields);
      return;
    }

    if (mode === 'signup' && !name) {
      setError(t.enterName);
      return;
    }

    setIsLoading(true);
    setError('');

    const result =
      mode === 'login'
        ? await login(email, password, rememberMe)
        : await signup(email, password, name);

    setIsLoading(false);

    if (result.success) {
      router.replace('/');
    } else {
      setError(result.error || 'Authentication failed');
    }
  };

  const handleForgotPassword = () => {
    Alert.prompt
      ? Alert.prompt(
          t.resetTitle,
          t.resetMessage,
          async (resetEmail: string) => {
            if (!resetEmail) {
              Alert.alert('Error', t.enterEmail);
              return;
            }
            const result = await resetPassword(resetEmail);
            if (result.success) {
              Alert.alert(t.resetTitle, t.resetSent);
            } else {
              Alert.alert('Error', result.error || 'Failed to send reset link');
            }
          },
          'plain-text',
          email,
          'email-address'
        )
      : Alert.alert(
          t.resetTitle,
          t.resetMessage + '\n\n' + t.resetSent
        );
  };

  const showAppleNative = appleAuthAvailable && Platform.OS !== 'web';
  const showAppleWeb = Platform.OS === 'web';

  return (
    <View style={styles.container}>
      <Image
        source={CRYSTAL_BALL_IMAGE}
        style={styles.backgroundImage}
        contentFit="cover"
        cachePolicy="memory-disk"
        priority="high"
      />
      <LinearGradient
        colors={['transparent', 'rgba(8,2,20,0.6)', 'rgba(8,2,20,0.95)', '#080214']}
        locations={[0, 0.35, 0.55, 0.7]}
        style={styles.gradient}
      />

      <TouchableOpacity
        onPress={() => setLanguage(language === 'en' ? 'es' : 'en')}
        style={styles.langToggle}
        activeOpacity={0.7}
      >
        <Globe color="#c4b5fd" size={14} />
        <Text style={styles.langText}>{language === 'en' ? 'ES' : 'EN'}</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.spacer} />

          <View style={styles.brandSection}>
            <Text style={styles.title}>{t.transformTitle}</Text>
            <Text style={styles.subtitle}>{t.transformSubtitle}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, mode === 'login' && styles.tabActive]}
                onPress={() => { setMode('login'); setError(''); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabLabel, mode === 'login' && styles.tabLabelActive]}>
                  {t.login}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, mode === 'signup' && styles.tabActive]}
                onPress={() => { setMode('signup'); setError(''); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabLabel, mode === 'signup' && styles.tabLabelActive]}>
                  {t.signup}
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'signup' && (
              <View style={styles.field}>
                <User color="rgba(167,139,250,0.5)" size={16} style={styles.fieldIcon} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder={t.fullName}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.field}>
              <Mail color="rgba(167,139,250,0.5)" size={16} style={styles.fieldIcon} />
              <TextInput
                style={styles.fieldInput}
                placeholder={t.email}
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            <View style={styles.field}>
              <Lock color="rgba(167,139,250,0.5)" size={16} style={styles.fieldIcon} />
              <TextInput
                style={styles.fieldInput}
                placeholder={t.password}
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                activeOpacity={0.7}
              >
                {showPassword ? (
                  <EyeOff color="rgba(167,139,250,0.4)" size={16} />
                ) : (
                  <Eye color="rgba(167,139,250,0.4)" size={16} />
                )}
              </TouchableOpacity>
            </View>

            {mode === 'login' && (
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.check, rememberMe && styles.checkOn]}>
                    {rememberMe && <View style={styles.checkDot} />}
                  </View>
                  <Text style={styles.rememberLabel}>{t.rememberMe}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                  <Text style={styles.forgotLabel}>{t.forgotPassword}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.agreeRow}>
              <TouchableOpacity
                onPress={() => {
                  if (termsAccepted) {
                    setTermsAccepted(false);
                    AsyncStorage.removeItem(TERMS_ACCEPTED_KEY).catch(() => {});
                  } else {
                    setShowTermsModal(true);
                  }
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={[styles.check, termsAccepted && styles.checkOn]}>
                  {termsAccepted && <Check color="#fff" size={11} strokeWidth={3} />}
                </View>
              </TouchableOpacity>
              <Text style={styles.agreeText}>
                {t.agreeLabel}{' '}
                <Text
                  style={styles.agreeLink}
                  onPress={() => setShowTermsModal(true)}
                  suppressHighlighting={false}
                >
                  {t.termsLink}
                </Text>
              </Text>
            </View>

            {error ? <Text style={styles.errorMsg}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleAuth}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#8b5cf6', '#7c3aed', '#6d28d9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <View style={styles.submitInner}>
                    <Text style={styles.submitText}>
                      {mode === 'login' ? t.login : t.signup}
                    </Text>
                    <ChevronRight color="#fff" size={18} />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>{t.or}</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              {showAppleNative && (
                <View style={styles.socialBtn}>
                  {appleLoading ? (
                    <View style={styles.appleLoading}>
                      <ActivityIndicator color="#fff" size="small" />
                    </View>
                  ) : (
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                      cornerRadius={10}
                      style={styles.appleNativeBtn}
                      onPress={async () => {
                        setAppleLoading(true);
                        setError('');
                        const result = await loginWithApple();
                        setAppleLoading(false);
                        if (result.success) {
                          router.replace('/');
                        } else if (result.error && result.error !== 'Sign in was cancelled') {
                          setError(result.error);
                        }
                      }}
                    />
                  )}
                </View>
              )}

              {showAppleWeb && (
                <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8} disabled>
                  <Text style={styles.appleIcon}></Text>
                  <Text style={styles.socialLabel}>{t.signInWithApple}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showTermsModal && !checkingTerms}
        transparent
        animationType="fade"
        onRequestClose={declineTerms}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <ShieldAlert color="#fbbf24" size={22} />
              </View>
              <Text style={styles.modalTitle}>{t.termsTitle}</Text>
              <Text style={styles.modalIntro}>{t.termsIntro}</Text>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator
            >
              <Text style={styles.modalBody}>{t.termsBody}</Text>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.declineBtn}
                onPress={declineTerms}
                activeOpacity={0.8}
              >
                <Text style={styles.declineText}>{t.decline}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.agreeBtn}
                onPress={acceptTerms}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#8b5cf6', '#7c3aed', '#6d28d9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.agreeBtnGradient}
                >
                  <Check color="#fff" size={16} strokeWidth={3} />
                  <Text style={styles.agreeBtnText}>{t.iAgree}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080214',
  },
  flex: {
    flex: 1,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.55,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  langToggle: {
    position: 'absolute',
    top: 54,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.15)',
  },
  langText: {
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  spacer: {
    flex: 1,
    minHeight: 60,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: 2,
    textShadowColor: 'rgba(139,92,246,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(196,181,253,0.8)',
    letterSpacing: 1.5,
    fontWeight: '500' as const,
  },
  card: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(15,8,30,0.85)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.12)',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(139,92,246,0.08)',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: 'rgba(139,92,246,0.9)',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: 'rgba(196,181,253,0.45)',
  },
  tabLabelActive: {
    color: '#fff',
    fontWeight: '700' as const,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139,92,246,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.12)',
    marginBottom: 10,
    height: 46,
  },
  fieldIcon: {
    marginLeft: 14,
    marginRight: 2,
  },
  fieldInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 14,
    color: '#fff',
    height: '100%',
  },
  eyeBtn: {
    paddingHorizontal: 14,
    height: '100%',
    justifyContent: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 2,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  check: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.35)',
    marginRight: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkOn: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  checkDot: {
    width: 7,
    height: 7,
    backgroundColor: '#fff',
    borderRadius: 1.5,
  },
  rememberLabel: {
    fontSize: 11,
    color: 'rgba(196,181,253,0.6)',
    fontWeight: '500' as const,
  },
  forgotLabel: {
    fontSize: 11,
    color: '#a78bfa',
    fontWeight: '600' as const,
  },
  errorMsg: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  submitBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 16,
  },
  submitGradient: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(139,92,246,0.2)',
  },
  dividerLabel: {
    marginHorizontal: 12,
    fontSize: 11,
    color: 'rgba(196,181,253,0.35)',
    fontWeight: '500' as const,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  socialLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.85)',
  },
  appleLoading: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appleNativeBtn: {
    width: '100%',
    height: 44,
  },
  appleIcon: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600' as const,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  agreeText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(196,181,253,0.7)',
    lineHeight: 16,
  },
  agreeLink: {
    color: '#a78bfa',
    fontWeight: '700' as const,
    textDecorationLine: 'underline',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,1,12,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    backgroundColor: '#120824',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 14,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(139,92,246,0.18)',
  },
  modalIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalIntro: {
    fontSize: 12,
    color: 'rgba(196,181,253,0.7)',
    textAlign: 'center',
  },
  modalScroll: {
    maxHeight: SCREEN_HEIGHT * 0.42,
  },
  modalScrollContent: {
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  modalBody: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.82)',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(139,92,246,0.18)',
  },
  declineBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600' as const,
    fontSize: 14,
  },
  agreeBtn: {
    flex: 1.4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  agreeBtnGradient: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  agreeBtnText: {
    color: '#fff',
    fontWeight: '700' as const,
    fontSize: 14,
  },
});
