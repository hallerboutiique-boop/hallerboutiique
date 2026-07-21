import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  ApiError,
  fetchDashboard,
  fetchOrder,
  fetchOrders,
  login,
  registerPushToken,
  unregisterPushToken,
  updateOrderStatus,
} from "./src/api";
import { registerForOrderNotifications } from "./src/notifications";
import type { MobileOrder, MobileSession, OrderStatus, OrdersDashboard, OrdersFilter } from "./src/types";

const SESSION_KEY = "haller_mobile_admin_session";

const palette = {
  background: "#090909",
  surface: "#141414",
  surfaceRaised: "#1B1B1B",
  border: "#2A2A2A",
  gold: "#C9952E",
  goldLight: "#F0C469",
  goldMuted: "#72551D",
  text: "#F7F3EA",
  muted: "#A8A39A",
  green: "#54B985",
  greenDark: "#173A2B",
  red: "#EF6A6A",
  redDark: "#421F22",
  blue: "#75A7E8",
  blueDark: "#1B304B",
};

const statusTheme: Record<OrderStatus, { color: string; background: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Nuovo: { color: palette.goldLight, background: "#3B3019", icon: "time-outline" },
  Confermato: { color: palette.green, background: palette.greenDark, icon: "checkmark-circle-outline" },
  Rifiutato: { color: palette.red, background: palette.redDark, icon: "close-circle-outline" },
};

const filters: Array<{ key: OrdersFilter; label: string }> = [
  { key: "all", label: "Tutti" },
  { key: "new", label: "Nuovi" },
  { key: "confirmed", label: "Confermati" },
  { key: "rejected", label: "Rifiutati" },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function formatDate(value: string, includeTime = true) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function monthLabel(value: string) {
  const date = new Date(`${value}-01T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", { month: "short" }).format(date).replace(".", "");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operazione non riuscita.";
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Image
      source={require("./assets/logo-original.png")}
      style={[styles.logo, compact && styles.logoCompact]}
      resizeMode="contain"
      accessibilityLabel="Haller Boutique"
    />
  );
}

function LoginScreen({ onLogin }: { onLogin: (session: MobileSession) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async () => {
    if (!password.trim()) {
      setMessage("Inserisci la password amministratore.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const session = await login(password);
      await onLogin(session);
      setPassword("");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.loginSafeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.loginKeyboard}>
        <View style={styles.loginContent}>
          <View style={styles.loginLogoFrame}>
            <Logo />
          </View>
          <Text style={styles.loginEyebrow}>GESTIONE ORDINI</Text>
          <Text style={styles.loginTitle}>Il negozio, sempre con te.</Text>
          <Text style={styles.loginSubtitle}>
            Ricevi i nuovi ordini, controlla i dettagli e aggiorna lo stato da iPhone o Android.
          </Text>

          <View style={styles.loginCard}>
            <Text style={styles.inputLabel}>Password amministratore</Text>
            <View style={styles.inputShell}>
              <Ionicons name="lock-closed-outline" size={20} color={palette.muted} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Inserisci la password"
                placeholderTextColor="#69665F"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={submit}
                style={styles.input}
              />
            </View>
            {message ? <Text style={styles.formError}>{message}</Text> : null}
            <Pressable onPress={submit} disabled={loading} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, loading && styles.disabled]}>
              {loading ? <ActivityIndicator color="#171109" /> : <Text style={styles.primaryButtonText}>Accedi</Text>}
            </Pressable>
          </View>

          <View style={styles.secureNote}>
            <Ionicons name="shield-checkmark-outline" size={18} color={palette.goldLight} />
            <Text style={styles.secureNoteText}>Accesso cifrato e sessione salvata nel portachiavi sicuro del dispositivo.</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  const theme = statusTheme[status];
  return (
    <View style={[styles.statusPill, { backgroundColor: theme.background }]}>
      <Ionicons name={theme.icon} size={14} color={theme.color} />
      <Text style={[styles.statusPillText, { color: theme.color }]}>{status}</Text>
    </View>
  );
}

function OrderCard({ order, onPress }: { order: MobileOrder; onPress: () => void }) {
  const productCount = order.products.reduce((sum, product) => sum + product.quantity, 0);
  const productSummary = order.products.map((product) => product.name).join(", ") || "Prodotti non indicati";
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.orderCard, pressed && styles.cardPressed]}>
      <View style={styles.orderCardTop}>
        <View>
          <Text style={styles.orderCode}>{order.orderCode}</Text>
          <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
        </View>
        <StatusPill status={order.status} />
      </View>
      <View style={styles.orderCustomerRow}>
        <View style={styles.customerAvatar}>
          <Text style={styles.customerAvatarText}>{(order.customer.name || "C").slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.orderCustomerCopy}>
          <Text style={styles.customerName} numberOfLines={1}>{order.customer.name || "Cliente"}</Text>
          <Text style={styles.productSummary} numberOfLines={1}>{productCount} articoli · {productSummary}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6F6A60" />
      </View>
      <View style={styles.orderCardBottom}>
        <Text style={styles.paymentLabel}>{order.paymentMethod || "Pagamento non indicato"}</Text>
        <Text style={styles.orderTotal}>{order.total || formatMoney(order.totalValue)}</Text>
      </View>
    </Pressable>
  );
}

function EmptyOrders({ filter }: { filter: OrdersFilter }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="receipt-outline" size={30} color={palette.goldLight} />
      </View>
      <Text style={styles.emptyTitle}>Nessun ordine</Text>
      <Text style={styles.emptyText}>{filter === "all" ? "I nuovi ordini appariranno qui." : "Non ci sono ordini con questo stato."}</Text>
    </View>
  );
}

function SummaryStrip({ dashboard }: { dashboard: OrdersDashboard | null }) {
  return (
    <View style={styles.summaryStrip}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Da gestire</Text>
        <Text style={styles.summaryValue}>{dashboard?.counts.new ?? "—"}</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItemWide}>
        <Text style={styles.summaryLabel}>Incassi confermati</Text>
        <Text style={styles.summaryRevenue}>{dashboard ? formatMoney(dashboard.confirmedRevenue) : "—"}</Text>
      </View>
    </View>
  );
}

function RevenueScreen({ dashboard }: { dashboard: OrdersDashboard | null }) {
  if (!dashboard) return <ActivityIndicator color={palette.gold} style={styles.screenLoader} />;
  const maxRevenue = Math.max(...dashboard.monthlyRevenue.map((item) => item.revenue), 1);
  return (
    <ScrollView contentContainerStyle={styles.revenueContent} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#3B2B10", "#17130D"]} style={styles.revenueHero}>
        <View style={styles.revenueHeroIcon}>
          <Ionicons name="wallet-outline" size={25} color={palette.goldLight} />
        </View>
        <Text style={styles.revenueHeroLabel}>INCASSI CONFERMATI</Text>
        <Text style={styles.revenueHeroValue}>{formatMoney(dashboard.confirmedRevenue)}</Text>
        <Text style={styles.revenueHeroNote}>Sono esclusi gli ordini nuovi e rifiutati.</Text>
      </LinearGradient>

      <View style={styles.metricGrid}>
        <MetricCard icon="today-outline" label="Oggi" value={formatMoney(dashboard.todayRevenue)} />
        <MetricCard icon="analytics-outline" label="Ordine medio" value={formatMoney(dashboard.averageConfirmedOrder)} />
        <MetricCard icon="hourglass-outline" label="In attesa" value={formatMoney(dashboard.pendingRevenue)} />
        <MetricCard icon="checkmark-done-outline" label="Confermati" value={String(dashboard.counts.confirmed)} />
      </View>

      <View style={styles.chartCard}>
        <View style={styles.sectionHeadingRow}>
          <View>
            <Text style={styles.sectionEyebrow}>ANDAMENTO</Text>
            <Text style={styles.sectionTitle}>Ultimi mesi</Text>
          </View>
          <Ionicons name="bar-chart-outline" size={22} color={palette.goldLight} />
        </View>
        {dashboard.monthlyRevenue.length ? (
          <View style={styles.chart}>
            {dashboard.monthlyRevenue.map((item) => (
              <View key={item.month} style={styles.chartColumn}>
                <Text style={styles.chartValue}>{item.revenue >= 1000 ? `${Math.round(item.revenue / 100) / 10}k` : Math.round(item.revenue)}</Text>
                <View style={styles.chartTrack}>
                  <LinearGradient
                    colors={[palette.goldLight, palette.goldMuted]}
                    style={[styles.chartBar, { height: `${Math.max(8, (item.revenue / maxRevenue) * 100)}%` }]}
                  />
                </View>
                <Text style={styles.chartLabel}>{monthLabel(item.month)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.chartEmpty}>Conferma il primo ordine per vedere l’andamento.</Text>
        )}
      </View>

      <View style={styles.statusOverview}>
        <Text style={styles.sectionEyebrow}>ORDINI TOTALI</Text>
        <Text style={styles.sectionTitle}>{dashboard.counts.all} ordini ricevuti</Text>
        <View style={styles.statusOverviewRows}>
          <StatusCount color={palette.goldLight} label="Nuovi" value={dashboard.counts.new} />
          <StatusCount color={palette.green} label="Confermati" value={dashboard.counts.confirmed} />
          <StatusCount color={palette.red} label="Rifiutati" value={dashboard.counts.rejected} />
        </View>
      </View>
    </ScrollView>
  );
}

function MetricCard({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Ionicons name={icon} size={21} color={palette.goldLight} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function StatusCount({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View style={styles.statusCountRow}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={styles.statusCountLabel}>{label}</Text>
      <Text style={styles.statusCountValue}>{value}</Text>
    </View>
  );
}

function DetailLine({ icon, label, value, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  if (!value) return null;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.detailLine, pressed && onPress && styles.pressed]}>
      <View style={styles.detailLineIcon}>
        <Ionicons name={icon} size={19} color={palette.goldLight} />
      </View>
      <View style={styles.detailLineCopy}>
        <Text style={styles.detailLineLabel}>{label}</Text>
        <Text style={[styles.detailLineValue, onPress && styles.detailLineLink]}>{value}</Text>
      </View>
      {onPress ? <Ionicons name="open-outline" size={17} color={palette.muted} /> : null}
    </Pressable>
  );
}

function OrderDetailModal({
  order,
  visible,
  loading,
  onClose,
  onStatus,
}: {
  order: MobileOrder | null;
  visible: boolean;
  loading: boolean;
  onClose: () => void;
  onStatus: (status: OrderStatus) => Promise<void>;
}) {
  const requestStatus = (status: OrderStatus) => {
    const confirming = status === "Confermato";
    Alert.alert(
      confirming ? "Confermare l’ordine?" : "Rifiutare l’ordine?",
      confirming
        ? "L’ordine verrà conteggiato negli incassi confermati."
        : "L’ordine non verrà conteggiato e la disponibilità dei prodotti sarà ripristinata.",
      [
        { text: "Annulla", style: "cancel" },
        { text: confirming ? "Conferma" : "Rifiuta", style: confirming ? "default" : "destructive", onPress: () => void onStatus(status) },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.detailSafeArea}>
        <View style={styles.detailHeader}>
          <Pressable onPress={onClose} style={styles.iconButton} accessibilityLabel="Chiudi dettaglio ordine">
            <Ionicons name="close" size={24} color={palette.text} />
          </Pressable>
          <Text style={styles.detailHeaderTitle}>Dettaglio ordine</Text>
          <View style={styles.iconButtonPlaceholder} />
        </View>
        {order ? (
          <>
            <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
              <View style={styles.detailHero}>
                <View>
                  <Text style={styles.detailCode}>{order.orderCode}</Text>
                  <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                </View>
                <StatusPill status={order.status} />
                <Text style={styles.detailTotal}>{order.total || formatMoney(order.totalValue)}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Cliente</Text>
                <DetailLine icon="person-outline" label="Nome" value={order.customer.name || "Cliente"} />
                <DetailLine
                  icon="call-outline"
                  label="Telefono"
                  value={order.customer.phone}
                  onPress={order.customer.phone ? () => void Linking.openURL(`tel:${order.customer.phone.replace(/[^+\d]/g, "")}`) : undefined}
                />
                <DetailLine
                  icon="mail-outline"
                  label="Email"
                  value={order.customer.email}
                  onPress={order.customer.email ? () => void Linking.openURL(`mailto:${order.customer.email}`) : undefined}
                />
                <DetailLine
                  icon="location-outline"
                  label="Indirizzo"
                  value={[order.customer.address, order.customer.postalCode, order.customer.city].filter(Boolean).join(", ")}
                />
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Prodotti</Text>
                {order.products.map((product, index) => (
                  <View key={`${product.id}-${index}`} style={styles.productRow}>
                    <View style={styles.productIndex}><Text style={styles.productIndexText}>{product.quantity}×</Text></View>
                    <View style={styles.productCopy}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productMeta}>{[product.size ? `Taglia ${product.size}` : "", product.price].filter(Boolean).join(" · ")}</Text>
                    </View>
                    <Text style={styles.productValue}>{formatMoney(product.value)}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Pagamento</Text>
                <DetailLine icon="card-outline" label="Metodo" value={order.paymentMethod || "Non indicato"} />
                <DetailLine icon="pricetag-outline" label="Codice sconto" value={order.discountCode} />
                <DetailLine icon="key-outline" label="Hash transazione" value={order.txHash} />
              </View>

              {order.statusHistory.length ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Cronologia</Text>
                  {order.statusHistory.map((entry, index) => (
                    <View key={`${entry.status}-${entry.at}-${index}`} style={styles.historyRow}>
                      <View style={[styles.historyDot, { backgroundColor: statusTheme[entry.status].color }]} />
                      <Text style={styles.historyStatus}>{entry.status}</Text>
                      <Text style={styles.historyDate}>{formatDate(entry.at)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>

            {order.status === "Nuovo" ? (
              <View style={styles.detailActions}>
                <Pressable disabled={loading} onPress={() => requestStatus("Rifiutato")} style={({ pressed }) => [styles.rejectButton, pressed && styles.pressed, loading && styles.disabled]}>
                  <Ionicons name="close" size={20} color={palette.red} />
                  <Text style={styles.rejectButtonText}>Rifiuta</Text>
                </Pressable>
                <Pressable disabled={loading} onPress={() => requestStatus("Confermato")} style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed, loading && styles.disabled]}>
                  {loading ? <ActivityIndicator color="#171109" /> : <Ionicons name="checkmark" size={20} color="#171109" />}
                  <Text style={styles.confirmButtonText}>Conferma</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : (
          <ActivityIndicator color={palette.gold} style={styles.screenLoader} />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function AuthenticatedApp({ session, onLogout, onSessionExpired }: {
  session: MobileSession;
  onLogout: () => Promise<void>;
  onSessionExpired: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<"orders" | "revenue">("orders");
  const [filter, setFilter] = useState<OrdersFilter>("all");
  const [orders, setOrders] = useState<MobileOrder[]>([]);
  const [dashboard, setDashboard] = useState<OrdersDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<MobileOrder | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notificationState, setNotificationState] = useState("Attivazione notifiche…");
  const pushTokenRef = useRef("");
  const ordersRef = useRef<MobileOrder[]>([]);
  const handledNotificationRef = useRef("");

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const handleApiError = useCallback(async (caught: unknown) => {
    if (caught instanceof ApiError && caught.status === 401) {
      await onSessionExpired();
      return;
    }
    setError(errorMessage(caught));
  }, [onSessionExpired]);

  const loadData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      const [nextOrders, nextDashboard] = await Promise.all([
        fetchOrders(session.token),
        fetchDashboard(session.token),
      ]);
      setOrders(nextOrders);
      setDashboard(nextDashboard);
    } catch (caught) {
      await handleApiError(caught);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [handleApiError, session.token]);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  useEffect(() => {
    let active = true;
    registerForOrderNotifications()
      .then(async (registration) => {
        if (!active) return;
        pushTokenRef.current = registration.pushToken;
        await registerPushToken(
          session.token,
          registration.pushToken,
          registration.platform,
          registration.deviceName,
          registration.appVersion,
        );
        if (active) setNotificationState("Notifiche attive");
      })
      .catch((caught) => {
        if (active) setNotificationState(errorMessage(caught));
      });
    return () => { active = false; };
  }, [session.token]);

  const openOrderById = useCallback(async (orderId: string) => {
    if (!orderId) return;
    setDetailVisible(true);
    const local = ordersRef.current.find((order) => order.id === orderId);
    if (local) setSelectedOrder(local);
    try {
      const order = await fetchOrder(session.token, orderId);
      setSelectedOrder(order);
      await loadData(false);
    } catch (caught) {
      await handleApiError(caught);
    }
  }, [handleApiError, loadData, session.token]);

  useEffect(() => {
    const openFromNotification = (event: Notifications.NotificationResponse | null) => {
      const orderId = String(event?.notification.request.content.data?.orderId || "");
      const responseId = String(event?.notification.request.identifier || orderId);
      if (!orderId || handledNotificationRef.current === responseId) return;
      handledNotificationRef.current = responseId;
      void openOrderById(orderId);
    };
    const received = Notifications.addNotificationReceivedListener(() => {
      void loadData(false);
    });
    const response = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    Notifications.getLastNotificationResponseAsync().then(openFromNotification);
    return () => {
      received.remove();
      response.remove();
    };
  }, [loadData, openOrderById]);

  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void loadData(false);
    });
    return () => listener.remove();
  }, [loadData]);

  const visibleOrders = useMemo(() => orders.filter((order) => {
    if (filter === "new") return order.status === "Nuovo";
    if (filter === "confirmed") return order.status === "Confermato";
    if (filter === "rejected") return order.status === "Rifiutato";
    return true;
  }), [filter, orders]);

  const changeStatus = async (status: OrderStatus) => {
    if (!selectedOrder) return;
    setActionLoading(true);
    setError("");
    try {
      const updated = await updateOrderStatus(session.token, selectedOrder.id, status);
      setSelectedOrder(updated);
      setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
      setDashboard(await fetchDashboard(session.token));
    } catch (caught) {
      await handleApiError(caught);
    } finally {
      setActionLoading(false);
    }
  };

  const logout = async () => {
    if (pushTokenRef.current) {
      await unregisterPushToken(session.token, pushTokenRef.current).catch(() => undefined);
    }
    await onLogout();
  };

  return (
    <SafeAreaView style={styles.appSafeArea} edges={["top", "left", "right"]}>
      <StatusBar style="light" />
      <View style={styles.appHeader}>
        <Logo compact />
        <View style={styles.headerActions}>
          <Pressable onPress={() => void loadData(false)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} accessibilityLabel="Aggiorna">
            <Ionicons name="refresh" size={21} color={palette.text} />
          </Pressable>
          <Pressable onPress={() => Alert.alert("Uscire dall’app?", "Dovrai inserire nuovamente la password amministratore.", [
            { text: "Annulla", style: "cancel" },
            { text: "Esci", style: "destructive", onPress: () => void logout() },
          ])} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} accessibilityLabel="Esci">
            <Ionicons name="log-out-outline" size={21} color={palette.text} />
          </Pressable>
        </View>
      </View>

      <SummaryStrip dashboard={dashboard} />
      {error ? (
        <Pressable onPress={() => setError("")} style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color={palette.red} />
          <Text style={styles.errorBannerText}>{error}</Text>
          <Ionicons name="close" size={17} color={palette.muted} />
        </Pressable>
      ) : null}

      <View style={styles.contentArea}>
        {activeTab === "orders" ? (
          <>
            <View style={styles.screenHeading}>
              <View>
                <Text style={styles.sectionEyebrow}>ORDINI</Text>
                <Text style={styles.screenTitle}>Ordini ricevuti</Text>
              </View>
              <View style={styles.notificationBadge}>
                <View style={[styles.notificationDot, notificationState !== "Notifiche attive" && styles.notificationDotWarning]} />
                <Text style={styles.notificationBadgeText} numberOfLines={1}>{notificationState}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
              {filters.map((item) => (
                <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.filterChip, filter === item.key && styles.filterChipActive]}>
                  <Text style={[styles.filterChipText, filter === item.key && styles.filterChipTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {loading ? (
              <ActivityIndicator color={palette.gold} style={styles.screenLoader} />
            ) : (
              <FlatList
                data={visibleOrders}
                keyExtractor={(order) => order.id}
                renderItem={({ item }) => <OrderCard order={item} onPress={() => { setSelectedOrder(item); setDetailVisible(true); }} />}
                contentContainerStyle={[styles.ordersList, !visibleOrders.length && styles.ordersListEmpty]}
                ItemSeparatorComponent={() => <View style={styles.orderSeparator} />}
                ListEmptyComponent={<EmptyOrders filter={filter} />}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(false); }} tintColor={palette.gold} />}
                showsVerticalScrollIndicator={false}
              />
            )}
          </>
        ) : (
          <RevenueScreen dashboard={dashboard} />
        )}
      </View>

      <View style={styles.bottomNav}>
        <Pressable onPress={() => setActiveTab("orders")} style={styles.bottomNavItem}>
          <Ionicons name={activeTab === "orders" ? "receipt" : "receipt-outline"} size={22} color={activeTab === "orders" ? palette.goldLight : palette.muted} />
          <Text style={[styles.bottomNavLabel, activeTab === "orders" && styles.bottomNavLabelActive]}>Ordini</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab("revenue")} style={styles.bottomNavItem}>
          <Ionicons name={activeTab === "revenue" ? "wallet" : "wallet-outline"} size={22} color={activeTab === "revenue" ? palette.goldLight : palette.muted} />
          <Text style={[styles.bottomNavLabel, activeTab === "revenue" && styles.bottomNavLabelActive]}>Incassi</Text>
        </Pressable>
      </View>

      <OrderDetailModal
        order={selectedOrder}
        visible={detailVisible}
        loading={actionLoading}
        onClose={() => { setDetailVisible(false); setSelectedOrder(null); }}
        onStatus={changeStatus}
      />
    </SafeAreaView>
  );
}

export default function App() {
  const [session, setSession] = useState<MobileSession | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(SESSION_KEY)
      .then((stored) => {
        if (!stored) return;
        const parsed = JSON.parse(stored) as MobileSession;
        if (parsed.token && new Date(parsed.expiresAt).getTime() > Date.now()) setSession(parsed);
      })
      .catch(() => undefined)
      .finally(() => setRestoring(false));
  }, []);

  const storeSession = async (next: MobileSession) => {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  };

  const clearSession = async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
    setSession(null);
  };

  if (restoring) {
    return (
      <SafeAreaProvider>
        <View style={styles.restoreScreen}>
          <Logo />
          <ActivityIndicator color={palette.gold} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      {session ? (
        <AuthenticatedApp session={session} onLogout={clearSession} onSessionExpired={clearSession} />
      ) : (
        <LoginScreen onLogin={storeSession} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  restoreScreen: { flex: 1, backgroundColor: palette.background, alignItems: "center", justifyContent: "center", gap: 28 },
  logo: { width: 260, height: 62 },
  logoCompact: { width: 188, height: 42 },
  loginSafeArea: { flex: 1, backgroundColor: palette.background },
  loginKeyboard: { flex: 1 },
  loginContent: { flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingBottom: 20 },
  loginLogoFrame: { alignItems: "center", marginBottom: 24 },
  loginEyebrow: { color: palette.goldLight, fontSize: 12, fontWeight: "800", letterSpacing: 2.4, textAlign: "center" },
  loginTitle: { color: palette.text, fontSize: 31, lineHeight: 38, fontWeight: "800", textAlign: "center", marginTop: 10 },
  loginSubtitle: { color: palette.muted, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 12, marginBottom: 28 },
  loginCard: { backgroundColor: palette.surface, borderRadius: 22, borderWidth: 1, borderColor: palette.border, padding: 20 },
  inputLabel: { color: palette.text, fontSize: 13, fontWeight: "700", marginBottom: 9 },
  inputShell: { height: 54, borderWidth: 1, borderColor: "#34322E", borderRadius: 14, backgroundColor: "#0D0D0D", flexDirection: "row", alignItems: "center", paddingHorizontal: 15, gap: 11 },
  input: { flex: 1, color: palette.text, fontSize: 16, height: "100%" },
  formError: { color: palette.red, fontSize: 13, lineHeight: 18, marginTop: 10 },
  primaryButton: { height: 54, borderRadius: 14, backgroundColor: palette.goldLight, alignItems: "center", justifyContent: "center", marginTop: 16 },
  primaryButtonText: { color: "#171109", fontSize: 16, fontWeight: "800" },
  secureNote: { flexDirection: "row", justifyContent: "center", alignItems: "flex-start", gap: 9, marginTop: 20, paddingHorizontal: 16 },
  secureNoteText: { flex: 1, color: "#807B72", fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
  appSafeArea: { flex: 1, backgroundColor: palette.background },
  appHeader: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
  headerActions: { flexDirection: "row", gap: 8 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surfaceRaised, borderWidth: 1, borderColor: palette.border, alignItems: "center", justifyContent: "center" },
  iconButtonPlaceholder: { width: 40, height: 40 },
  summaryStrip: { marginHorizontal: 18, marginTop: 5, marginBottom: 15, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, paddingVertical: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center" },
  summaryItem: { width: 82 },
  summaryItemWide: { flex: 1, paddingLeft: 18 },
  summaryDivider: { width: 1, height: 37, backgroundColor: palette.border },
  summaryLabel: { color: palette.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7 },
  summaryValue: { color: palette.goldLight, fontSize: 25, fontWeight: "800", marginTop: 3 },
  summaryRevenue: { color: palette.text, fontSize: 21, fontWeight: "800", marginTop: 3 },
  errorBanner: { marginHorizontal: 18, marginBottom: 10, backgroundColor: palette.redDark, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  errorBannerText: { color: "#F4B5B5", fontSize: 12, lineHeight: 17, flex: 1 },
  contentArea: { flex: 1 },
  screenHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 18, marginBottom: 12 },
  sectionEyebrow: { color: palette.goldLight, fontSize: 10, fontWeight: "800", letterSpacing: 1.8 },
  screenTitle: { color: palette.text, fontSize: 24, fontWeight: "800", marginTop: 3 },
  notificationBadge: { maxWidth: 148, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: palette.surface, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  notificationDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.green },
  notificationDotWarning: { backgroundColor: palette.goldLight },
  notificationBadgeText: { color: palette.muted, fontSize: 10, flexShrink: 1 },
  filtersRow: { paddingHorizontal: 18, gap: 8, paddingBottom: 14 },
  filterChip: { height: 34, borderRadius: 17, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: 15, alignItems: "center", justifyContent: "center" },
  filterChipActive: { backgroundColor: palette.goldLight, borderColor: palette.goldLight },
  filterChipText: { color: palette.muted, fontSize: 13, fontWeight: "700" },
  filterChipTextActive: { color: "#171109" },
  ordersList: { paddingHorizontal: 18, paddingBottom: 28 },
  ordersListEmpty: { flexGrow: 1 },
  orderSeparator: { height: 10 },
  orderCard: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 15 },
  cardPressed: { opacity: 0.75, transform: [{ scale: 0.995 }] },
  orderCardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  orderCode: { color: palette.text, fontSize: 16, fontWeight: "800" },
  orderDate: { color: palette.muted, fontSize: 11, marginTop: 4 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 6 },
  statusPillText: { fontSize: 11, fontWeight: "800" },
  orderCustomerRow: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 16 },
  customerAvatar: { width: 39, height: 39, borderRadius: 13, backgroundColor: "#292115", alignItems: "center", justifyContent: "center" },
  customerAvatarText: { color: palette.goldLight, fontSize: 16, fontWeight: "800" },
  orderCustomerCopy: { flex: 1 },
  customerName: { color: palette.text, fontSize: 14, fontWeight: "700" },
  productSummary: { color: palette.muted, fontSize: 11, marginTop: 4 },
  orderCardBottom: { borderTopWidth: 1, borderTopColor: palette.border, marginTop: 14, paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  paymentLabel: { color: palette.muted, fontSize: 11, flex: 1 },
  orderTotal: { color: palette.goldLight, fontSize: 18, fontWeight: "800" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 70 },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: "#2E2515", alignItems: "center", justifyContent: "center", marginBottom: 15 },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: "800" },
  emptyText: { color: palette.muted, fontSize: 13, marginTop: 6 },
  screenLoader: { flex: 1, marginTop: 60 },
  bottomNav: { flexDirection: "row", borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: "#101010", paddingTop: 9, paddingBottom: Platform.OS === "ios" ? 7 : 10 },
  bottomNavItem: { flex: 1, alignItems: "center", gap: 4 },
  bottomNavLabel: { color: palette.muted, fontSize: 11, fontWeight: "700" },
  bottomNavLabelActive: { color: palette.goldLight },
  revenueContent: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 30 },
  revenueHero: { borderRadius: 22, borderWidth: 1, borderColor: "#59441C", padding: 20, overflow: "hidden" },
  revenueHeroIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.28)", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  revenueHeroLabel: { color: "#E5C77C", fontSize: 10, fontWeight: "800", letterSpacing: 1.7 },
  revenueHeroValue: { color: palette.text, fontSize: 36, fontWeight: "900", marginTop: 7 },
  revenueHeroNote: { color: "#BDAF91", fontSize: 11, marginTop: 8 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  metricCard: { width: "48.5%", backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 17, padding: 15, minHeight: 112 },
  metricLabel: { color: palette.muted, fontSize: 11, marginTop: 13 },
  metricValue: { color: palette.text, fontSize: 19, fontWeight: "800", marginTop: 4 },
  chartCard: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 19, padding: 17, marginTop: 12 },
  sectionHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: palette.text, fontSize: 19, fontWeight: "800", marginTop: 3 },
  chart: { height: 190, flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 18 },
  chartColumn: { flex: 1, height: "100%", alignItems: "center" },
  chartValue: { color: palette.muted, fontSize: 9, height: 18 },
  chartTrack: { flex: 1, width: "65%", backgroundColor: "#22201C", borderRadius: 7, justifyContent: "flex-end", overflow: "hidden" },
  chartBar: { width: "100%", borderRadius: 7 },
  chartLabel: { color: palette.muted, fontSize: 10, marginTop: 7, textTransform: "capitalize" },
  chartEmpty: { color: palette.muted, textAlign: "center", paddingVertical: 35, fontSize: 13 },
  statusOverview: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 19, padding: 17, marginTop: 12 },
  statusOverviewRows: { marginTop: 16, gap: 12 },
  statusCountRow: { flexDirection: "row", alignItems: "center" },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginRight: 10 },
  statusCountLabel: { flex: 1, color: palette.muted, fontSize: 13 },
  statusCountValue: { color: palette.text, fontSize: 14, fontWeight: "800" },
  detailSafeArea: { flex: 1, backgroundColor: palette.background },
  detailHeader: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: palette.border },
  detailHeaderTitle: { color: palette.text, fontSize: 16, fontWeight: "800" },
  detailContent: { padding: 18, paddingBottom: 35 },
  detailHero: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 20, padding: 18 },
  detailCode: { color: palette.text, fontSize: 22, fontWeight: "900" },
  detailTotal: { color: palette.goldLight, fontSize: 32, fontWeight: "900", marginTop: 22 },
  detailSection: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 16, marginTop: 12 },
  detailSectionTitle: { color: palette.text, fontSize: 15, fontWeight: "800", marginBottom: 12 },
  detailLine: { minHeight: 54, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "#242424", paddingVertical: 10 },
  detailLineIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#2C2417", alignItems: "center", justifyContent: "center", marginRight: 11 },
  detailLineCopy: { flex: 1 },
  detailLineLabel: { color: palette.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6 },
  detailLineValue: { color: palette.text, fontSize: 13, lineHeight: 18, marginTop: 3 },
  detailLineLink: { color: palette.goldLight },
  productRow: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "#242424", paddingVertical: 13 },
  productIndex: { width: 35, height: 35, borderRadius: 12, backgroundColor: "#2C2417", alignItems: "center", justifyContent: "center" },
  productIndexText: { color: palette.goldLight, fontSize: 12, fontWeight: "800" },
  productCopy: { flex: 1, paddingHorizontal: 11 },
  productName: { color: palette.text, fontSize: 13, fontWeight: "700" },
  productMeta: { color: palette.muted, fontSize: 11, marginTop: 4 },
  productValue: { color: palette.text, fontSize: 13, fontWeight: "800" },
  historyRow: { flexDirection: "row", alignItems: "center", minHeight: 37 },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  historyStatus: { color: palette.text, fontSize: 12, fontWeight: "700", flex: 1 },
  historyDate: { color: palette.muted, fontSize: 10 },
  detailActions: { borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: "#101010", flexDirection: "row", gap: 10, padding: 14 },
  rejectButton: { flex: 0.85, height: 52, borderRadius: 14, borderWidth: 1, borderColor: "#7D3339", backgroundColor: palette.redDark, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  rejectButtonText: { color: palette.red, fontSize: 14, fontWeight: "800" },
  confirmButton: { flex: 1.15, height: 52, borderRadius: 14, backgroundColor: palette.goldLight, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  confirmButtonText: { color: "#171109", fontSize: 14, fontWeight: "900" },
});
