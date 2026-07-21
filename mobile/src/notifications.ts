import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForOrderNotifications(): Promise<{
  pushToken: string;
  platform: string;
  deviceName: string;
  appVersion: string;
}> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("orders", {
      name: "Nuovi ordini",
      description: "Notifiche per i nuovi ordini ricevuti",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 180, 250],
      lightColor: "#C9952E",
      sound: "default",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") throw new Error("Permesso notifiche non concesso.");

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    throw new Error("Progetto EAS non ancora collegato: esegui eas init prima della build.");
  }

  const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return {
    pushToken,
    platform: Platform.OS,
    deviceName: Device.deviceName || Device.modelName || "Dispositivo",
    appVersion: Constants.expoConfig?.version || "1.0.0",
  };
}
