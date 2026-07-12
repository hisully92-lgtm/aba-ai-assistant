import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

function TabIcon({ icon, label, focused }: { icon: keyof typeof Ionicons.glyphMap; label: string; focused: boolean }) {
  const color = focused ? "#2563eb" : "#9ca3af";
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Ionicons name={icon} size={20} color={color} />
      <Text numberOfLines={1} style={{ fontSize: 10, color, fontWeight: focused ? "600" : "400" }}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarShowLabel: false,
      tabBarStyle: {
        backgroundColor: "#1a2234",
        borderTopWidth: 0,
        height: 70,
        paddingBottom: 8,
      },
    }}>
      <Tabs.Screen name="home" options={{
        tabBarIcon: ({ focused }) => <TabIcon icon="home" label="Home" focused={focused} />,
      }} />
      <Tabs.Screen name="calendar" options={{
        tabBarIcon: ({ focused }) => <TabIcon icon="calendar" label="Cal" focused={focused} />,
      }} />
      <Tabs.Screen name="session" options={{
        tabBarIcon: ({ focused }) => <TabIcon icon="clipboard" label="Session" focused={focused} />,
      }} />
      <Tabs.Screen name="notes" options={{
        tabBarIcon: ({ focused }) => <TabIcon icon="people" label="Parent" focused={focused} />,
      }} />
      <Tabs.Screen name="timers" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="timeentry" options={{ href: null }} />
    </Tabs>
  );
}
