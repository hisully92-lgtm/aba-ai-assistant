import { Tabs } from "expo-router";
import { View, Text } from "react-native";

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
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
        tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
      }} />
      <Tabs.Screen name="calendar" options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
      }} />
      <Tabs.Screen name="session" options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
      }} />
      <Tabs.Screen name="notes" options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="📝" focused={focused} />,
      }} />
      <Tabs.Screen name="chat" options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} />,
      }} />
      <Tabs.Screen name="parent" options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="👨‍👧" focused={focused} />,
      }} />
      <Tabs.Screen name="telehealth" options={{
        tabBarIcon: ({ focused }) => <TabIcon emoji="🎥" focused={focused} />,
      }} />
      <Tabs.Screen name="telehealth-history" options={{ href: null }} />
      <Tabs.Screen name="timers" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="timeentry" options={{ href: null }} />
    </Tabs>
  );
}
